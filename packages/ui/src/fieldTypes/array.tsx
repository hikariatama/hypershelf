import type { Ref } from "react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation } from "convex/react";
import { isEqual } from "lodash";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { ValueType } from "@hypershelf/convex/schema";
import { api } from "@hypershelf/convex/_generated/api";
import { validateField } from "@hypershelf/convex/utils";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";

import type { TagInputHandle } from "../primitives/tag-input";
import type {
  FieldPropConfig,
  FieldRendererTableCellProps,
  TableCellEditorHandle,
} from "./_abstractType";
import { useScopedHotkeys } from "../hotkeys";
import { TagInput } from "../primitives/tag-input";
import { toast } from "../Toast";
import { ActionsRow } from "./_shared";

export function InlineArray({
  assetId,
  editorRef,
  fieldId,
  readonly = false,
  tableCell,
}: {
  assetId: Id<"assets">;
  editorRef?: Ref<TableCellEditorHandle>;
  fieldId: Id<"fields">;
  readonly?: boolean;
  tableCell?: FieldRendererTableCellProps;
}) {
  const fieldInfo = useStoreWithEqualityFn(
    useHypershelf,
    (state) => ({
      type: state.fields[fieldId]?.field.type ?? "array",
      extra: state.fields[fieldId]?.field.extra,
      required: state.fields[fieldId]?.field.required,
    }),
    isEqual,
  );
  const { placeholder } = fieldInfo.extra ?? {};
  const value = useStoreWithEqualityFn(
    useHypershelf,
    (state) => state.assets[assetId]?.asset.metadata?.[fieldId] ?? [],
    isEqual,
  );
  const lockedBy = useHypershelf(
    (state) => state.lockedFields[assetId]?.[fieldId],
  );
  const lazyError = useHypershelf(
    (state) => state.assetErrors[assetId]?.[fieldId],
  );

  const [val, setVal] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const measure = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<TagInputHandle>(null);

  useEffect(() => {
    if (!isDirty) {
      if (!isEqual(val, value)) {
        setVal(value);
        setError(null);
      }
    }
  }, [value, isDirty, val]);

  useEffect(() => {
    const locker = useHypershelf.getState().assetsLocker;
    if (isDirty || draftValue.trim().length > 0) {
      void locker.acquire(assetId, fieldId);
      return;
    }
    if (!updating) {
      void locker.release(assetId, fieldId);
    }
  }, [assetId, draftValue, fieldId, isDirty, updating]);

  const showButton = useMemo(
    () => isDirty || draftValue.trim().length > 0,
    [draftValue, isDirty],
  );
  const updateAsset = useMutation(api.assets.update);

  const handleSave = useCallback(async () => {
    const draftResult = tagInputRef.current?.commitDraft();
    if (draftResult?.status === "invalid") {
      setError(draftResult.error ?? "Неверное значение");
      return false;
    }

    const nextValue = draftResult?.tags ?? val;

    if (isEqual(nextValue, value)) {
      setIsDirty(false);
      return true;
    }

    const validationError = validateField(fieldInfo, nextValue);
    if (validationError) {
      setError(validationError);
      return false;
    }

    setError(null);
    setUpdating(true);

    try {
      await updateAsset({
        assetId,
        fieldId,
        value: nextValue,
      });
      setIsDirty(false);
      return true;
    } catch (e) {
      console.error("Failed to update asset:", e);
      toast.error("Не смогли сохранить поле!");
      return false;
    } finally {
      setUpdating(false);
      const locker = useHypershelf.getState().assetsLocker;
      void locker.release(assetId, fieldId);
    }
  }, [assetId, fieldId, fieldInfo, updateAsset, val, value]);

  const handleCancel = useCallback(() => {
    tagInputRef.current?.clearDraft();
    setVal(value);
    setError(null);
    setIsDirty(false);
    const locker = useHypershelf.getState().assetsLocker;
    void locker.release(assetId, fieldId);
  }, [assetId, fieldId, value]);

  const onChange = useCallback(
    (incoming: string[]) => {
      setVal(incoming);
      const dirty = !isEqual(incoming, value);
      setIsDirty(dirty);
      setError(validateField(fieldInfo, incoming));
    },
    [fieldInfo, value],
  );

  const validateTag = useCallback(
    (tag: string) => {
      return validateField(
        {
          type: fieldInfo.extra?.listObjectType ?? "string",
          extra: fieldInfo.extra?.listObjectExtra,
          required: false,
        },
        tag,
      );
    },
    [fieldInfo],
  );

  useImperativeHandle(
    editorRef,
    (): TableCellEditorHandle => ({
      beginEdit: () => {
        tableCell?.onModeChange("editing");
        tagInputRef.current?.focus();
      },
      cancel: handleCancel,
      commit: handleSave,
      copyValue: () => ({
        text: (val as string[]).join(", "),
        type: "array",
        value: val,
      }),
      focus: () => {
        tagInputRef.current?.focus();
      },
      kind: "complex",
      pasteValue: ({ text, type, value: clipboardValue }) => {
        const nextValue =
          type === "array" && Array.isArray(clipboardValue)
            ? clipboardValue.filter(
                (entry): entry is string => typeof entry === "string",
              )
            : text
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean);

        tableCell?.onModeChange("editing");
        setVal(nextValue);
        setIsDirty(!isEqual(nextValue, value));
        setError(validateField(fieldInfo, nextValue));
        tagInputRef.current?.focus();
      },
      typeText: (text) => {
        tableCell?.onModeChange("editing");
        const currentDraft = draftValue;
        tagInputRef.current?.setDraftText(`${currentDraft}${text}`);
      },
    }),
    [draftValue, fieldInfo, handleCancel, handleSave, tableCell, value, val],
  );

  useScopedHotkeys(
    [
      {
        hotkey: "Mod+S",
        callback: (event) => {
          event.preventDefault();
          void handleSave().then((saved) => {
            if (saved && tableCell) {
              tableCell.onModeChange("navigation");
            }
          });
        },
        enabled:
          (showButton || Boolean(error)) &&
          !updating &&
          (tableCell
            ? tableCell.active && tableCell.mode === "editing"
            : isFocused),
        scope: tableCell ? "table-editor" : "app",
      },
      {
        hotkey: "Escape",
        callback: (event) => {
          event.preventDefault();
          handleCancel();
          tableCell?.onModeChange("navigation");
          tagInputRef.current?.blur();
        },
        enabled:
          tableCell?.mode === "editing" ||
          showButton ||
          Boolean(error) ||
          Boolean(lazyError && isFocused),
        scope: tableCell ? "table-editor" : "app",
      },
    ],
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: measure,
    },
  );

  if (readonly) {
    return Array.isArray(val) && val.length > 0 ? (
      <div className="inline">{(val as ValueType[]).join(", ")}</div>
    ) : (
      <div className="inline text-muted-foreground/50 italic">пусто</div>
    );
  }

  return (
    <div className="gap-2 flex flex-col">
      <div ref={measure}>
        {lockedBy && (
          <span className="-mt-0.5 absolute -translate-y-full text-[10px] text-brand">
            {lockedBy}
          </span>
        )}
        <TagInput
          ref={tagInputRef}
          tags={val as string[]}
          setTags={onChange}
          placeholder={placeholder ?? "Добавить..."}
          className={cn(
            "py-1 text-sm relative h-auto !border-0 !bg-transparent",
            (error ?? (lazyError && !isDirty && isFocused)) &&
              "!ring-red-500 !ring-2",
            updating && "animate-pulse opacity-50",
            !val && "italic !placeholder-muted-foreground/50",
            lockedBy &&
              "cursor-not-allowed text-foreground/70 !opacity-100 ring-2 ring-brand",
            ((isDirty || error) ?? (lazyError && isFocused && !isDirty)) &&
              "z-50",
            lazyError &&
              !isDirty &&
              !isFocused &&
              "!border-red-500 rounded-br-none rounded-bl-none !border-b-2",
          )}
          draggable
          disabled={!!lockedBy || updating}
          validateTag={validateTag}
          onDraftChange={(nextDraft) => {
            setDraftValue(nextDraft);
            if (!nextDraft.trim() && isEqual(val, value)) {
              setError(null);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!draftValue.trim() && isEqual(val, value)) {
              setError(null);
            }
            setIsFocused(false);
          }}
        />
      </div>
      <ActionsRow
        showButton={
          showButton || !!error || (!!lazyError && isFocused && !isDirty)
        }
        error={error ?? (isFocused && !isDirty ? lazyError : null) ?? null}
        updating={updating}
        handleSave={handleSave}
        handleCancel={handleCancel}
        measure={measure}
      />
    </div>
  );
}

const config = {
  cellClipboard: "enabled",
  key: "array",
  label: "Список",
  icon: "brackets",
  fieldProps: [
    "placeholder",
    "minItems",
    "maxItems",
    "listObjectType",
    "listObjectExtra",
  ],
  component: InlineArray,
} as const satisfies FieldPropConfig;

export default config;
