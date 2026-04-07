import type { IconName } from "lucide-react/dynamic";
import type { ReactNode, Ref } from "react";

import type { Id } from "@hypershelf/convex/_generated/dataModel";

export type TableCellMode = "navigation" | "editing";

export type TableCellEditorKind = "simple" | "complex" | "action";

export type FieldClipboardBehavior = "enabled" | "disabled";

export type TableCellEditorHandle = {
  beginEdit: () => void;
  cancel?: () => void;
  commit?: () => boolean | Promise<boolean>;
  copyValue?: () => { text: string; type: string; value: unknown };
  focus: () => void;
  kind: TableCellEditorKind;
  pasteValue?: (payload: {
    text: string;
    type?: string;
    value?: unknown;
  }) => void;
  quickSelectOption?: (index: number) => void;
  typeText?: (text: string) => void;
};

export type FieldRendererTableCellProps = {
  active: boolean;
  focused: boolean;
  mode: TableCellMode;
  move: (deltaX: number, deltaY?: number) => void;
  onModeChange: (mode: TableCellMode) => void;
  rowIndex: number;
  columnIndex: number;
};

interface SharedProps {
  cellClipboard: FieldClipboardBehavior;
  key: string;
  label: string;
  icon: IconName;
  fieldProps: string[];
  component: (args: {
    assetId: Id<"assets">;
    fieldId: Id<"fields">;
    editorRef?: Ref<TableCellEditorHandle>;
    readonly?: boolean;
    tableCell?: FieldRendererTableCellProps;
  }) => ReactNode;
}

export type FieldPropConfig =
  | ({
      icon: IconName;
      magic?: false;
    } & SharedProps)
  | ({
      magic: true;
    } & SharedProps);
