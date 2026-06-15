import type { Ref } from "react";
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useMutation } from "convex/react";
import { CircleCheck, CirclePlus, Loader2 } from "lucide-react";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { useHypershelf } from "@hypershelf/lib/stores";

import type {
  FieldPropConfig,
  FieldRendererTableCellProps,
  TableCellEditorHandle,
} from "./_abstractType";
import { Button } from "../primitives/button";
import { toast } from "../Toast";

function InlineBoolean({
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
  const updateAsset = useMutation(api.assets.update);
  const [updating, setUpdating] = useState(false);
  const value = useHypershelf(
    (state) => state.assets[assetId]?.asset.metadata?.[fieldId],
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const applyValue = useCallback(
    (nextValue: boolean) => {
      setUpdating(true);
      setTimeout(() => {
        updateAsset({
          assetId,
          fieldId,
          value: nextValue,
        })
          .catch((e) => {
            console.error("Failed to update asset:", e);
            toast.error("Не смогли сохранить поле!");
          })
          .finally(() => {
            setUpdating(false);
            const locker = useHypershelf.getState().assetsLocker;
            void locker.release(assetId, fieldId);
            tableCell?.onModeChange("navigation");
          });
      }, 0);
    },
    [assetId, fieldId, tableCell, updateAsset],
  );

  const onClick = useCallback(() => {
    applyValue(!value);
  }, [applyValue, value]);

  useImperativeHandle(
    editorRef,
    (): TableCellEditorHandle => ({
      beginEdit: () => {
        tableCell?.onModeChange("editing");
        buttonRef.current?.click();
      },
      copyValue: () => ({
        text: value ? "true" : "false",
        type: "boolean",
        value: Boolean(value),
      }),
      focus: () => {
        buttonRef.current?.focus();
      },
      kind: "simple",
      pasteValue: ({ text, type, value: clipboardValue }) => {
        const nextValue =
          type === "boolean" && typeof clipboardValue === "boolean"
            ? clipboardValue
            : (() => {
                const normalized = text.trim().toLowerCase();
                if (["true", "1", "yes", "да"].includes(normalized))
                  return true;
                if (["false", "0", "no", "нет"].includes(normalized))
                  return false;
                return null;
              })();

        if (nextValue == null) return;
        applyValue(nextValue);
      },
    }),
    [applyValue, tableCell, value],
  );

  if (readonly) {
    return value ? (
      <CircleCheck className="size-4 text-green-500 inline-block" />
    ) : (
      <CirclePlus className="size-4 text-red-500 inline-block rotate-45" />
    );
  }

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      className="size-7 !bg-transparent"
      disabled={updating}
      onClick={onClick}
    >
      {updating ? (
        <Loader2 className="size-5 animate-spin" />
      ) : value ? (
        <CircleCheck className="size-5 text-green-500" />
      ) : (
        <CirclePlus className="size-5 text-red-500 rotate-45" />
      )}
      <VisuallyHidden>{value ? "Да" : "Нет"}</VisuallyHidden>
    </Button>
  );
}

const config = {
  cellClipboard: "enabled",
  key: "boolean",
  label: "Да/Нет",
  icon: "square-check",
  fieldProps: [],
  component: InlineBoolean,
} as const satisfies FieldPropConfig;

export default config;
