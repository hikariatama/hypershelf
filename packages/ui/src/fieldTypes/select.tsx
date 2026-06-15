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
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";

import type {
  FieldPropConfig,
  FieldRendererTableCellProps,
  TableCellEditorHandle,
} from "./_abstractType";
import { useScopedHotkeys } from "../hotkeys";
import { Button } from "../primitives/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/command";
import { Kbd } from "../primitives/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { toast } from "../Toast";
import { AnimateTransition } from "./_shared";

function InlineSelect({
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
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const draftValueRef = useRef<string[]>([]);

  const value = useStoreWithEqualityFn(
    useHypershelf,
    (state) => {
      const curr = state.assets[assetId]?.asset.metadata?.[fieldId] as
        | string
        | string[];
      if (Array.isArray(curr)) return curr;
      if (curr) return [String(curr)];
      return [];
    },
    isEqual,
  );
  const options = useStoreWithEqualityFn(
    useHypershelf,
    (state) => state.fields[fieldId]?.field.extra?.options ?? [],
    isEqual,
  );
  const multiselect = useHypershelf(
    (state) => state.fields[fieldId]?.field.extra?.multiselect ?? false,
  );

  const lockedBy = useHypershelf(
    (state) => state.lockedFields[assetId]?.[fieldId],
  );
  const lazyError = useHypershelf(
    (state) => state.assetErrors[assetId]?.[fieldId],
  );
  const disabled = useMemo(
    () => (!open && !!lockedBy) || (!multiselect && updating),
    [lockedBy, multiselect, open, updating],
  );

  useEffect(() => {
    if (!multiselect || !open) {
      setDraftValue(value);
      draftValueRef.current = value;
    }
  }, [multiselect, open, value]);

  useEffect(() => {
    draftValueRef.current = draftValue;
  }, [draftValue]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        commandInputRef.current?.focus();
      });
    }
  }, [open]);

  const queueSave = useCallback(
    (finalValue: string | string[]) => {
      saveChainRef.current = saveChainRef.current
        .catch(() => undefined)
        .then(async () => {
          setUpdating(true);

          try {
            await updateAsset({
              assetId,
              fieldId,
              value: Array.isArray(finalValue)
                ? finalValue.filter((v) => options.includes(v))
                : options.includes(finalValue)
                  ? finalValue
                  : null,
            });
          } catch (e) {
            console.error("Failed to update asset:", e);
            toast.error("Не смогли сохранить поле!");
          } finally {
            setUpdating(false);
          }
        });
    },
    [assetId, fieldId, options, updateAsset],
  );

  const applySingleValue = useCallback(
    (nextValue: string) => {
      setUpdating(true);
      setTimeout(() => {
        void updateAsset({
          assetId,
          fieldId,
          value: options.includes(nextValue) ? nextValue : null,
        })
          .catch((e) => {
            console.error("Failed to update asset:", e);
            toast.error("Не смогли сохранить поле!");
          })
          .finally(() => {
            setUpdating(false);
            tableCell?.onModeChange("navigation");
            const locker = useHypershelf.getState().assetsLocker;
            void locker.release(assetId, fieldId);
          });
      }, 0);
    },
    [assetId, fieldId, options, tableCell, updateAsset],
  );

  const onValueChange = useCallback(
    (newValue: string) => {
      if (!multiselect) {
        setOpen(false);
        applySingleValue(newValue);
        return;
      }

      const currentValue = draftValueRef.current;
      const nextValue = currentValue.includes(newValue)
        ? currentValue.filter((v) => v !== newValue)
        : [...currentValue, newValue];

      setDraftValue(nextValue);
      draftValueRef.current = nextValue;
      queueSave(nextValue);
      requestAnimationFrame(() => {
        commandInputRef.current?.focus();
      });
    },
    [assetId, fieldId, multiselect, options, queueSave, tableCell, updateAsset],
  );

  const onOpenChange = useCallback(
    (o: boolean) => {
      setOpen(o);
      if (!o) {
        tableCell?.onModeChange("navigation");
      }
      const locker = useHypershelf.getState().assetsLocker;
      if (!o) {
        void saveChainRef.current.finally(() => {
          void locker.release(assetId, fieldId);
        });
      } else {
        void locker.acquire(assetId, fieldId);
      }
    },
    [assetId, fieldId, tableCell],
  );

  const displayValue = useMemo(() => {
    const currentValue = multiselect && open ? draftValue : value;

    if (currentValue.length === 0) {
      return <span className="text-muted-foreground/50 italic">{"пусто"}</span>;
    }
    if (multiselect) {
      return (
        <div className="gap-1 flex flex-wrap items-center">
          {currentValue.map((v) => (
            <span
              key={v}
              className="px-1.5 py-0.5 text-xs rounded-sm bg-muted text-muted-foreground"
            >
              {v}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="gap-1.5 flex items-center">
        {currentValue[0]}
        <ChevronDown className="opacity-50" />
      </div>
    );
  }, [draftValue, multiselect, open, value]);

  useImperativeHandle(
    editorRef,
    (): TableCellEditorHandle => ({
      beginEdit: () => {
        tableCell?.onModeChange("editing");
        setOpen(true);
        requestAnimationFrame(() => {
          if (multiselect) {
            commandInputRef.current?.focus();
          } else {
            triggerRef.current?.focus();
          }
        });
      },
      cancel: () => {
        onOpenChange(false);
      },
      copyValue: () => ({
        text: value.join(", "),
        type: multiselect ? "multiselect" : "select",
        value: multiselect ? value : (value[0] ?? null),
      }),
      focus: () => {
        triggerRef.current?.focus();
      },
      kind: "simple",
      pasteValue: ({ text, type, value: clipboardValue }) => {
        if (multiselect) {
          const nextValue =
            type === "multiselect" && Array.isArray(clipboardValue)
              ? clipboardValue.filter(
                  (entry): entry is string =>
                    typeof entry === "string" && options.includes(entry),
                )
              : text
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(
                    (entry) => entry.length > 0 && options.includes(entry),
                  );

          setDraftValue(nextValue);
          draftValueRef.current = nextValue;
          queueSave(nextValue);
          return;
        }

        const nextValue =
          type === "select" && typeof clipboardValue === "string"
            ? clipboardValue
            : text.trim();

        if (!options.includes(nextValue)) return;
        applySingleValue(nextValue);
      },
      quickSelectOption: (index) => {
        const option = options[index];
        if (!option || lockedBy) return;
        if (multiselect) {
          const currentValue =
            draftValueRef.current.length > 0 ? draftValueRef.current : value;
          const nextValue = currentValue.includes(option)
            ? currentValue.filter((entry) => entry !== option)
            : [...currentValue, option];
          setDraftValue(nextValue);
          draftValueRef.current = nextValue;
          const locker = useHypershelf.getState().assetsLocker;
          void locker.acquire(assetId, fieldId);
          queueSave(nextValue);
          return;
        }
        const locker = useHypershelf.getState().assetsLocker;
        void locker.acquire(assetId, fieldId);
        applySingleValue(option);
      },
    }),
    [
      applySingleValue,
      assetId,
      fieldId,
      lockedBy,
      multiselect,
      onOpenChange,
      options,
      queueSave,
      tableCell,
      value,
    ],
  );

  useScopedHotkeys(
    Array.from({ length: 9 }, (_, index) => ({
      hotkey: `Mod+${index + 1}`,
      callback: (event) => {
        const option = options[index];
        if (!option || (!open && !!lockedBy)) return;
        event.preventDefault();
        onValueChange(option);
      },
      enabled: open,
      scope: tableCell ? "table-editor" : "app",
    })),
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: typeof document === "undefined" ? null : document,
    },
  );

  useScopedHotkeys(
    [
      {
        hotkey: "Escape",
        callback: (event) => {
          event.preventDefault();
          setDraftValue(value);
          draftValueRef.current = value;
          onOpenChange(false);
        },
        enabled: open,
        scope: tableCell ? "table-editor" : "app",
      },
      {
        hotkey: "Tab",
        callback: (event) => {
          if (!tableCell) return;
          event.preventDefault();
          onOpenChange(false);
          tableCell.move(1, 0);
        },
        enabled: open && tableCell?.active && tableCell.mode === "editing",
        scope: "table-editor",
      },
      {
        hotkey: "Shift+Tab",
        callback: (event) => {
          if (!tableCell) return;
          event.preventDefault();
          onOpenChange(false);
          tableCell.move(-1, 0);
        },
        enabled: open && tableCell?.active && tableCell.mode === "editing",
        scope: "table-editor",
      },
    ],
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
      target: typeof document === "undefined" ? null : document,
    },
  );

  if (readonly) {
    return (
      <div
        className={cn(
          "inline",
          value.length === 0 && "text-muted-foreground/50 italic",
        )}
      >
        {value.length > 0
          ? multiselect
            ? value.join(", ")
            : value[0]
          : "пусто"}
      </div>
    );
  }

  return (
    <div className="relative">
      {lockedBy && (
        <span className="top-0 -mt-0.5 absolute -translate-y-full text-[10px] whitespace-pre text-brand">
          {lockedBy}
        </span>
      )}
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            role="combobox"
            aria-expanded={!!assetId}
            disabled={!!lockedBy}
            className={cn(
              "h-auto min-h-[2.25rem]",
              lockedBy &&
                "cursor-not-allowed text-foreground/70 !opacity-100 ring-2 ring-brand",
              lazyError &&
                !open &&
                "!border-red-500 rounded-br-none rounded-bl-none !border-b-2",
            )}
          >
            {updating && (
              <Loader2 className="left-0 animate-spin absolute -translate-x-1/2 text-muted-foreground" />
            )}
            <AnimateTransition assetId={assetId} fieldId={fieldId}>
              {displayValue}
            </AnimateTransition>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-fit">
          <Command
            className="!bg-transparent !backdrop-blur-none"
            value={multiselect ? "" : value[0]}
          >
            <CommandInput
              ref={commandInputRef}
              autoFocus
              placeholder="Поиск..."
              className="h-9"
              disabled={disabled}
            />
            <CommandList>
              <CommandEmpty>Не нашли ничего</CommandEmpty>
              <CommandGroup>
                {options.map((option, idx) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={onValueChange}
                    disabled={disabled}
                  >
                    <div className="gap-1.5 flex items-center">
                      {idx <= 9 && (
                        <Kbd keys={["Meta", String(idx + 1)]} variant="ghost" />
                      )}
                      {option}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto",
                        (multiselect && open ? draftValue : value).includes(
                          option,
                        )
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const config = {
  cellClipboard: "enabled",
  key: "select",
  label: "Выбор",
  icon: "list-todo",
  fieldProps: ["options", "multiselect"],
  component: InlineSelect,
} as const satisfies FieldPropConfig;

export default config;
