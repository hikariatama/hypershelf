import type { Transition } from "framer-motion";
import type { IconName } from "lucide-react/dynamic";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { isEqual } from "lodash";
import { Ellipsis, GripVertical, X } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { Button } from "@hypershelf/ui/primitives/button";
import { TableHead } from "@hypershelf/ui/primitives/table";

import { useTableFreeze } from "./freeze";
import { FreezeButton } from "./FreezeButton";
import { SortButton } from "./SortButton";
import { VisibilityButton } from "./VisibilityButton";

const TRANSITION = { type: "spring", bounce: 0.2, duration: 0.3 } as Transition;

export function HeaderCell({ fieldId }: { fieldId: Id<"fields"> }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: fieldId });
  const {
    firstRightFrozenFieldId,
    lastLeftFrozenFieldId,
    registerHeaderCell,
    modeByFieldId,
    leftOffsetByFieldId,
    rightOffsetByFieldId,
  } = useTableFreeze();
  const fieldInfo = useStoreWithEqualityFn(
    useHypershelf,
    (state) => {
      const field = state.fields[fieldId];
      if (!field) return null;
      return {
        type: field.field.type,
        name: field.field.name,
        icon: field.field.extra?.icon,
      };
    },
    isEqual,
  );
  const canSort = useMemo(() => {
    return (
      fieldInfo?.type &&
      [
        "string",
        "number",
        "boolean",
        "select",
        "url",
        "ip",
        "user",
        "date",
        "email",
        "magic__hostname",
        "magic__ip",
      ].includes(fieldInfo.type)
    );
  }, [fieldInfo?.type]);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const isSorted = useHypershelf((state) => state.sorting[fieldId]);
  const isHidden = useHypershelf((state) =>
    state.hiddenFields.includes(fieldId),
  );
  const isFrozen = useHypershelf((state) =>
    state.frozenFields.includes(fieldId),
  );
  const frozenMode = modeByFieldId[fieldId] ?? "inline";
  const isLeftFrozenEdge =
    frozenMode === "left" && lastLeftFrozenFieldId === fieldId;
  const isRightFrozenEdge =
    frozenMode === "right" && firstRightFrozenFieldId === fieldId;
  const style: CSSProperties = {
    transform: `translate3d(${transform?.x ?? 0}px, ${transform?.y ?? 0}px, 0)`,
    transition,
  };

  if (frozenMode === "left") {
    style.left = leftOffsetByFieldId[fieldId] ?? 0;
  } else if (frozenMode === "right") {
    style.right = rightOffsetByFieldId[fieldId] ?? 0;
  }

  const handleRef = useCallback(
    (node: HTMLTableCellElement | null) => {
      setNodeRef(node);
      registerHeaderCell(fieldId, node);
    },
    [fieldId, registerHeaderCell, setNodeRef],
  );

  if (!fieldInfo) return null;

  return (
    <TableHead
      ref={handleRef}
      style={style}
      className={cn(
        "!h-auto border-l border-border",
        frozenMode !== "inline" && "sticky z-[120] border-b bg-background",
        isLeftFrozenEdge &&
          "border-r border-border shadow-[6px_0_16px_-8px_rgba(0,0,0,0.8)]",
        isRightFrozenEdge && "shadow-[-6px_0_16px_-8px_rgba(0,0,0,0.8)]",
      )}
    >
      <div className="flex items-center justify-center">
        <div className="gap-1 px-2 flex items-center">
          <div
            className={cn("gap-1 flex items-center", isHidden && "opacity-50")}
          >
            {fieldInfo.icon && (
              <DynamicIcon
                name={fieldInfo.icon as IconName}
                className="mr-1 size-4 opacity-50"
              />
            )}
            {fieldInfo.name}
          </div>
          <div className="flex items-center">
            <AnimatePresence>
              {(isSorted ?? (canSort && actionsExpanded)) && (
                <motion.div
                  initial={{ opacity: 0, x: 20, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: 20, width: 0 }}
                  transition={TRANSITION}
                >
                  <SortButton fieldId={fieldId} isSorted={isSorted ?? false} />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {(isHidden || actionsExpanded) && (
                <motion.div
                  initial={{ opacity: 0, x: 20, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: 20, width: 0 }}
                  transition={TRANSITION}
                >
                  <VisibilityButton fieldId={fieldId} isHidden={isHidden} />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {(isFrozen || actionsExpanded) && (
                <motion.div
                  initial={{ opacity: 0, x: 20, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: 20, width: 0 }}
                  transition={TRANSITION}
                >
                  <FreezeButton fieldId={fieldId} isFrozen={isFrozen} />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {actionsExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: 20, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: 20, width: 0 }}
                  transition={TRANSITION}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!p-1 !size-auto cursor-grab active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                  >
                    <GripVertical className="size-4 opacity-50" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div transition={TRANSITION}>
              <Button
                variant="ghost"
                size="sm"
                className="!p-1 !size-auto"
                onClick={() => setActionsExpanded(!actionsExpanded)}
              >
                <motion.div transition={TRANSITION}>
                  {actionsExpanded ? (
                    <X className="size-4 opacity-50" />
                  ) : (
                    <Ellipsis className="size-4 opacity-50" />
                  )}
                </motion.div>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </TableHead>
  );
}
