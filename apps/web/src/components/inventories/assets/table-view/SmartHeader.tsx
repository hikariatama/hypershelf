import { useCallback } from "react";
import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";

import { TableHead, TableRow } from "@hypershelf/ui/primitives/table";

import { useTableFreeze } from "./freeze";
import { HeaderCell } from "./HeaderCell";

export function SmartHeader() {
  const { orderedVisibleFieldIds, registerLeadingHeaderCell } =
    useTableFreeze();
  const handleLeadingHeaderRef = useCallback(
    (node: HTMLTableCellElement | null) => {
      registerLeadingHeaderCell(node);
    },
    [registerLeadingHeaderCell],
  );

  return (
    <TableRow className="h-8 relative !border-0 hover:bg-transparent">
      <TableHead ref={handleLeadingHeaderRef} className="!h-auto !border-0" />
      <SortableContext
        items={orderedVisibleFieldIds}
        strategy={horizontalListSortingStrategy}
      >
        {orderedVisibleFieldIds.map((fieldId) => (
          <HeaderCell key={fieldId} fieldId={fieldId} />
        ))}
      </SortableContext>
    </TableRow>
  );
}
