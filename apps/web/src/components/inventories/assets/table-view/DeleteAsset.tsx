import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { PopoverClose } from "@radix-ui/react-popover";
import { useMutation } from "convex/react";
import { LoaderCircle, Trash } from "lucide-react";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type {
  FieldRendererTableCellProps,
  TableCellEditorHandle,
} from "@hypershelf/ui";
import { api } from "@hypershelf/convex/_generated/api";
import { cn } from "@hypershelf/lib/utils";
import { HotkeyScopeProvider, useScopedHotkeys } from "@hypershelf/ui/hotkeys";
import { Button } from "@hypershelf/ui/primitives/button";
import { ButtonWithKbd } from "@hypershelf/ui/primitives/kbd-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hypershelf/ui/primitives/popover";
import { TableCell } from "@hypershelf/ui/primitives/table";
import { toast } from "@hypershelf/ui/toast";

import { useTableCellProps, useTableKeyboard } from "./keyboard";

function DeleteAssetCell({
  assetId,
  tableCell,
  editorRef,
}: {
  assetId: Id<"assets">;
  editorRef?: React.Ref<TableCellEditorHandle>;
  tableCell: FieldRendererTableCellProps;
}) {
  const deleteAsset = useMutation(api.assets.remove);
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(
    editorRef,
    (): TableCellEditorHandle => ({
      beginEdit: () => {
        setOpen(true);
        buttonRef.current?.click();
      },
      cancel: () => {
        setOpen(false);
      },
      focus: () => {
        buttonRef.current?.focus();
      },
      kind: "action",
    }),
    [],
  );

  useEffect(() => {
    if (!open && tableCell.mode === "editing") {
      tableCell.onModeChange("navigation");
    }
  }, [open, tableCell]);

  useScopedHotkeys(
    [
      {
        hotkey: "Escape",
        callback: () => {
          setOpen(false);
          tableCell.onModeChange("navigation");
        },
        enabled: open && tableCell.active && tableCell.mode === "editing",
        scope: "table-editor",
      },
    ],
    {
      ignoreInputs: false,
      target: typeof document === "undefined" ? null : document,
    },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          size="sm"
          variant="ghost"
          className="group"
          tabIndex={-1}
        >
          <Trash className="size-4 group-hover:text-red-500 text-muted-foreground transition-colors duration-150" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[9999] w-fit">
        <div className="gap-2 flex flex-col">
          <p className="text-sm">Уверен, что хочешь удалить этот хост?</p>
          <div className="gap-2 flex">
            <PopoverClose asChild>
              <ButtonWithKbd
                size="sm"
                variant="outline"
                keys={["Esc"]}
                className="flex-auto"
              >
                Отмена
              </ButtonWithKbd>
            </PopoverClose>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                setIsDeleting(true);
                try {
                  await deleteAsset({ id: assetId });
                } catch (e) {
                  console.error("Failed to delete asset", e);
                  toast.error("Не смогли удалить хост!");
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting && (
                <LoaderCircle className="animate-spin text-red-300/70" />
              )}
              Удалить
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DeleteAsset({
  assetId,
  columnIndex,
  rowIndex,
}: {
  assetId: Id<"assets">;
  columnIndex: number;
  rowIndex: number;
}) {
  const tableKeyboard = useTableKeyboard();
  const editorRef = useRef<TableCellEditorHandle>(null);
  const tableCell = useTableCellProps(rowIndex, columnIndex);

  useEffect(() => {
    tableKeyboard.registerEditor(rowIndex, columnIndex, editorRef.current);
    return () => {
      tableKeyboard.registerEditor(rowIndex, columnIndex, null);
    };
  });

  return (
    <TableCell
      ref={(node) => {
        tableKeyboard.registerElement(rowIndex, columnIndex, node);
      }}
      data-table-cell-key={`${rowIndex}:${columnIndex}`}
      tabIndex={tableCell.active && tableCell.mode === "navigation" ? 0 : -1}
      role="gridcell"
      aria-selected={tableCell.active}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          tableKeyboard.setActiveCell(rowIndex, columnIndex);
          tableCell.onModeChange("editing");
          editorRef.current?.beginEdit();
        }
      }}
      onFocusCapture={(event) => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }

        if (event.target !== event.currentTarget) {
          tableKeyboard.setActiveCell(rowIndex, columnIndex);
          tableCell.onModeChange("editing");
        }
      }}
      onMouseDownCapture={(event) => {
        if (event.target !== event.currentTarget) return;
        tableKeyboard.setActiveCell(rowIndex, columnIndex);
        tableKeyboard.setMode("navigation");
      }}
      onFocus={(event) => {
        if (event.target !== event.currentTarget) return;
        tableKeyboard.setActiveCell(rowIndex, columnIndex);
      }}
      className={cn(
        "transition-shadow duration-75 outline-none focus:outline-none focus-visible:outline-none",
        tableCell.focused && "ring-2 ring-brand/50 ring-inset",
      )}
    >
      <HotkeyScopeProvider
        scope="table-editor"
        active={tableCell.active && tableCell.mode === "editing"}
        blockScopes={["table", "app"]}
      >
        <DeleteAssetCell
          assetId={assetId}
          editorRef={editorRef}
          tableCell={tableCell}
        />
      </HotkeyScopeProvider>
    </TableCell>
  );
}
