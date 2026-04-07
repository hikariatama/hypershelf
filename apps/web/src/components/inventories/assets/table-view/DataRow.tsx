import { memo, useEffect, useRef } from "react";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { TableCellEditorHandle } from "@hypershelf/ui";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { FieldRenderer, getFieldTypeConfig } from "@hypershelf/ui";
import { HotkeyScopeProvider } from "@hypershelf/ui/hotkeys";
import { TableCell, TableRow } from "@hypershelf/ui/primitives/table";

import { DeleteAsset } from "./DeleteAsset";
import { useTableFreeze } from "./freeze";
import { useTableCellProps, useTableKeyboard } from "./keyboard";

const CELL_CLIPBOARD_MIME = "application/x-hypershelf-cell";

function DataCell({
  assetId,
  fieldId,
  isError,
  columnIndex,
  rowIndex,
}: {
  assetId: Id<"assets">;
  isError: boolean;
  columnIndex: number;
  fieldId: Id<"fields">;
  rowIndex: number;
}) {
  const {
    firstRightFrozenFieldId,
    lastLeftFrozenFieldId,
    modeByFieldId,
    leftOffsetByFieldId,
    rightOffsetByFieldId,
  } = useTableFreeze();
  const tableKeyboard = useTableKeyboard();
  const fieldType = useHypershelf((state) => state.fields[fieldId]?.field.type);
  const isHidden = useHypershelf((state) =>
    state.hiddenFields.includes(fieldId),
  );
  const clipboardEnabled =
    fieldType != null &&
    getFieldTypeConfig(fieldType)?.cellClipboard === "enabled";
  const frozenMode = modeByFieldId[fieldId] ?? "inline";
  const isLeftFrozenEdge =
    frozenMode === "left" && lastLeftFrozenFieldId === fieldId;
  const isRightFrozenEdge =
    frozenMode === "right" && firstRightFrozenFieldId === fieldId;
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
      key={`${assetId}-${fieldId}`}
      tabIndex={tableCell.active && tableCell.mode === "navigation" ? 0 : -1}
      role="gridcell"
      aria-selected={tableCell.active}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (tableCell.mode !== "navigation") return;
        if ((event.ctrlKey || event.metaKey) && /^\d$/.test(event.key)) {
          const index = Number(event.key) - 1;
          if (index >= 0) {
            editorRef.current?.quickSelectOption?.(index);
            event.preventDefault();
          }
          return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key.length !== 1) return;
        if (!editorRef.current?.typeText) return;
        editorRef.current.typeText(event.key);
        event.preventDefault();
      }}
      onCopy={(event) => {
        if (event.target !== event.currentTarget) return;
        if (tableCell.mode !== "navigation") return;
        if (!clipboardEnabled) return;
        const payload = editorRef.current?.copyValue?.();
        if (!payload) return;
        event.clipboardData.setData("text/plain", payload.text);
        event.clipboardData.setData(
          CELL_CLIPBOARD_MIME,
          JSON.stringify(payload),
        );
        event.preventDefault();
      }}
      onPaste={(event) => {
        if (event.target !== event.currentTarget) return;
        if (tableCell.mode !== "navigation") return;
        if (!clipboardEnabled) return;
        const pastedText = event.clipboardData.getData("text");
        if (!pastedText) return;
        const structuredPayload =
          event.clipboardData.getData(CELL_CLIPBOARD_MIME);
        if (editorRef.current?.pasteValue) {
          let parsedPayload:
            | { text: string; type?: string; value?: unknown }
            | undefined;
          if (structuredPayload) {
            try {
              parsedPayload = JSON.parse(structuredPayload) as {
                text: string;
                type?: string;
                value?: unknown;
              };
            } catch {
              parsedPayload = undefined;
            }
          }
          editorRef.current.pasteValue(
            parsedPayload ?? {
              text: pastedText,
            },
          );
          event.preventDefault();
          return;
        }
        if (!editorRef.current?.typeText) return;
        editorRef.current.typeText(pastedText);
        event.preventDefault();
      }}
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
      style={{
        left:
          frozenMode === "left"
            ? (leftOffsetByFieldId[fieldId] ?? 0)
            : undefined,
        right:
          frozenMode === "right"
            ? (rightOffsetByFieldId[fieldId] ?? 0)
            : undefined,
      }}
      className={cn(
        "px-2 py-1 relative border-l border-border transition-shadow duration-100 outline-none focus:outline-none focus-visible:outline-none",
        tableCell.focused && "ring-2 ring-brand/50 ring-inset",
        isHidden && "opacity-50",
        frozenMode !== "inline" &&
          cn(
            "sticky z-20",
            isError
              ? "bg-[#220E0F] group-hover/row:!bg-[#371212]"
              : "bg-background",
          ),
        isLeftFrozenEdge &&
          "border-r border-border shadow-[6px_0_16px_-8px_rgba(0,0,0,0.8)]",
        isRightFrozenEdge && "shadow-[-6px_0_16px_-8px_rgba(0,0,0,0.8)]",
      )}
    >
      <HotkeyScopeProvider
        scope="table-editor"
        active={tableCell.active && tableCell.mode === "editing"}
        blockScopes={["table", "app"]}
      >
        <div className="max-w-sm m-auto flex w-max items-center justify-center break-words break-all hyphens-auto whitespace-normal">
          <FieldRenderer
            assetId={assetId}
            editorRef={editorRef}
            fieldId={fieldId}
            tableCell={tableCell}
          />
        </div>
      </HotkeyScopeProvider>
    </TableCell>
  );
}

function DataRow({
  assetId,
  rowIndex,
}: {
  assetId: Id<"assets">;
  rowIndex: number;
}) {
  const { orderedVisibleFieldIds } = useTableFreeze();
  const isError = useHypershelf(
    (state) => !!Object.keys(state.assetErrors[assetId] ?? {}).length,
  );

  return (
    <TableRow
      className={cn("group/row animate-in fade-in relative", {
        "bg-red-500/10 hover:!bg-red-500/15": isError,
      })}
      id={`asset-row-${assetId}`}
      role="row"
    >
      <DeleteAsset assetId={assetId} columnIndex={0} rowIndex={rowIndex} />
      {orderedVisibleFieldIds.map((fieldId, index) => (
        <DataCell
          key={fieldId}
          assetId={assetId}
          isError={isError}
          columnIndex={index + 1}
          fieldId={fieldId}
          rowIndex={rowIndex}
        />
      ))}
    </TableRow>
  );
}

export const DataRowStable = memo(DataRow, (prevProps, nextProps) => {
  return (
    prevProps.assetId === nextProps.assetId &&
    prevProps.rowIndex === nextProps.rowIndex
  );
});
