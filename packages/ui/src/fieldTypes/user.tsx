import type { Ref } from "react";
import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { isEqual } from "lodash";
import { Check, Loader2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { toast } from "../Toast";
import { AnimateTransition } from "./_shared";

function InlineUser({
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
  const placeholder = useHypershelf(
    (state) => state.fields[fieldId]?.field.extra?.placeholder,
  );
  const value = useHypershelf(
    (state) =>
      state.assets[assetId]?.asset.metadata?.[fieldId] as
        | Id<"users">
        | undefined,
  );
  const lockedBy = useHypershelf(
    (state) => state.lockedFields[assetId]?.[fieldId],
  );
  const users = useStoreWithEqualityFn(
    useHypershelf,
    (state) => state.users,
    isEqual,
  );

  const [updating, setUpdating] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const updateAsset = useMutation(api.assets.update);

  const applyUserValue = useCallback(
    (selectedUser: string) => {
      setUpdating(true);
      updateAsset({
        assetId,
        fieldId,
        value: selectedUser,
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
    },
    [assetId, fieldId, tableCell, updateAsset],
  );

  const handleUserSelect = (selectedUser: string | undefined) => {
    setPopoverOpen(false);
    if (!selectedUser) return;

    const isSame = selectedUser === value;
    if (isSame) return;

    applyUserValue(selectedUser);
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (updating) return;
      setPopoverOpen(open);
      if (!open) {
        tableCell?.onModeChange("navigation");
      }
      const locker = useHypershelf.getState().assetsLocker;
      if (open) {
        void locker.acquire(assetId, fieldId);
      } else {
        void locker.release(assetId, fieldId);
      }
    },
    [assetId, fieldId, tableCell, updating],
  );

  useImperativeHandle(
    editorRef,
    (): TableCellEditorHandle => ({
      beginEdit: () => {
        tableCell?.onModeChange("editing");
        handleOpenChange(true);
      },
      cancel: () => {
        handleOpenChange(false);
      },
      copyValue: () => ({
        text: value && users[value] ? users[value] : "",
        type: "user",
        value: value ?? null,
      }),
      focus: () => {
        triggerRef.current?.focus();
      },
      kind: "simple",
      pasteValue: ({ text, type, value: clipboardValue }) => {
        const nextUser =
          type === "user" && typeof clipboardValue === "string"
            ? clipboardValue
            : Object.entries(users).find(
                ([, username]) => username === text,
              )?.[0];

        if (!nextUser) return;
        applyUserValue(nextUser);
      },
    }),
    [applyUserValue, handleOpenChange, tableCell, users, value],
  );

  useScopedHotkeys(
    [
      {
        hotkey: "Escape",
        callback: (event) => {
          event.preventDefault();
          handleOpenChange(false);
        },
        enabled: popoverOpen,
        scope: tableCell ? "table-editor" : "app",
      },
      {
        hotkey: "Tab",
        callback: (event) => {
          if (!tableCell) return;
          event.preventDefault();
          handleOpenChange(false);
          tableCell.move(1, 0);
        },
        enabled:
          popoverOpen && tableCell?.active && tableCell.mode === "editing",
        scope: "table-editor",
      },
      {
        hotkey: "Shift+Tab",
        callback: (event) => {
          if (!tableCell) return;
          event.preventDefault();
          handleOpenChange(false);
          tableCell.move(-1, 0);
        },
        enabled:
          popoverOpen && tableCell?.active && tableCell.mode === "editing",
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
          (!value || !users[value]) && "text-muted-foreground/50 italic",
        )}
      >
        {value ? (users[value] ?? "пусто") : "пусто"}
      </div>
    );
  }

  return (
    <div>
      {lockedBy && (
        <span className="-mt-0.5 absolute -translate-y-full text-[10px] whitespace-pre text-brand">
          {lockedBy}
        </span>
      )}
      <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="sm"
            role="combobox"
            aria-expanded={!!assetId}
            disabled={!!lockedBy || updating}
            className={cn(
              lockedBy &&
                "cursor-not-allowed text-foreground/70 !opacity-100 ring-2 ring-brand",
            )}
          >
            {updating && <Loader2 className="animate-spin" />}
            <AnimateTransition assetId={assetId} fieldId={fieldId}>
              {value ? (
                users[value]
              ) : (
                <span className="text-muted-foreground/50 italic">
                  {placeholder ?? "пусто"}
                </span>
              )}
            </AnimateTransition>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-fit">
          <Command
            className="!bg-transparent !backdrop-blur-none"
            value={value}
          >
            <CommandInput
              autoFocus
              placeholder="Поиск..."
              className="h-9"
              disabled={!!lockedBy || updating}
            />
            <CommandList>
              <CommandEmpty>Не нашли никого</CommandEmpty>
              <CommandGroup>
                {Object.entries(users).map(([id, email]) => {
                  return (
                    <CommandItem
                      key={id}
                      value={id}
                      keywords={[email]}
                      onSelect={handleUserSelect}
                      disabled={!!lockedBy || updating}
                    >
                      {email}
                      <Check
                        className={cn(
                          "ml-auto",
                          value === id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
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
  key: "user",
  label: "Юзер",
  icon: "circle-user",
  fieldProps: ["placeholder"],
  component: InlineUser,
} as const satisfies FieldPropConfig;

export default config;
