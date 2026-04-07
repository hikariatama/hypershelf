"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isEqual } from "lodash";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { State } from "@hypershelf/lib/stores/types";
import { useHypershelf } from "@hypershelf/lib/stores";

export type FrozenColumnMode = "inline" | "left" | "right";

type FrozenLayoutState = {
  firstRightFrozenFieldId?: Id<"fields">;
  lastLeftFrozenFieldId?: Id<"fields">;
  modeByFieldId: Partial<Record<Id<"fields">, FrozenColumnMode>>;
  leftOffsetByFieldId: Partial<Record<Id<"fields">, number>>;
  rightOffsetByFieldId: Partial<Record<Id<"fields">, number>>;
};

type TableFreezeContextValue = FrozenLayoutState & {
  orderedVisibleFieldIds: Id<"fields">[];
  setContainerNode: (node: HTMLDivElement | null) => void;
  registerLeadingHeaderCell: (node: HTMLTableCellElement | null) => void;
  registerHeaderCell: (
    fieldId: Id<"fields">,
    node: HTMLTableCellElement | null,
  ) => void;
};

const TableFreezeContext = createContext<TableFreezeContextValue | null>(null);

export function getOrderedVisibleFieldIds(state: State) {
  const positions = new Map(
    state.fieldOrder.map((fieldId, index) => [fieldId, index] as const),
  );

  return state.fieldIds
    .filter(
      (fieldId) =>
        !state.fields[fieldId]?.field.hidden &&
        (!state.hiding || !state.hiddenFields.includes(fieldId)),
    )
    .sort((left, right) => {
      const leftPosition = positions.get(left);
      const rightPosition = positions.get(right);

      if (leftPosition == null && rightPosition == null) return 0;
      if (leftPosition == null) return 1;
      if (rightPosition == null) return -1;

      return leftPosition - rightPosition;
    });
}

export function useTableFreezeLayoutValue(): TableFreezeContextValue {
  const orderedVisibleFieldIds = useStoreWithEqualityFn(
    useHypershelf,
    getOrderedVisibleFieldIds,
    isEqual,
  );
  const frozenVisibleFieldIds = useStoreWithEqualityFn(
    useHypershelf,
    (state) =>
      getOrderedVisibleFieldIds(state).filter((fieldId) =>
        state.frozenFields.includes(fieldId),
      ),
    isEqual,
  );
  const orderedVisibleFieldIdsKey = useMemo(
    () => orderedVisibleFieldIds.join("|"),
    [orderedVisibleFieldIds],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leadingHeaderCellRef = useRef<HTMLTableCellElement | null>(null);
  const headerCellsRef = useRef<Map<Id<"fields">, HTMLTableCellElement | null>>(
    new Map(),
  );
  const frameRef = useRef<number | null>(null);
  const orderedVisibleFieldIdsRef = useRef(orderedVisibleFieldIds);
  const frozenVisibleFieldIdsRef = useRef(frozenVisibleFieldIds);
  const [registryVersion, setRegistryVersion] = useState(0);
  const [layout, setLayout] = useState<FrozenLayoutState>({
    modeByFieldId: {},
    leftOffsetByFieldId: {},
    rightOffsetByFieldId: {},
  });

  orderedVisibleFieldIdsRef.current = orderedVisibleFieldIds;
  frozenVisibleFieldIdsRef.current = frozenVisibleFieldIds;

  const measure = useCallback(() => {
    if (!containerRef.current) {
      setLayout((current) => {
        const next = {
          firstRightFrozenFieldId: undefined,
          lastLeftFrozenFieldId: undefined,
          modeByFieldId: {},
          leftOffsetByFieldId: {},
          rightOffsetByFieldId: {},
        };

        return isEqual(current, next) ? current : next;
      });

      return;
    }

    const container = containerRef.current;
    const viewportStart = container.scrollLeft;
    const viewportEnd = viewportStart + container.clientWidth;

    const leadingWidth = leadingHeaderCellRef.current?.offsetWidth ?? 0;

    const modeByFieldId: Partial<Record<Id<"fields">, FrozenColumnMode>> = {};
    const leftOffsetByFieldId: Partial<Record<Id<"fields">, number>> = {};
    const rightOffsetByFieldId: Partial<Record<Id<"fields">, number>> = {};
    const leftFloating: Id<"fields">[] = [];
    const rightFloating: Id<"fields">[] = [];
    const orderedMetrics: {
      fieldId: Id<"fields">;
      start: number;
      width: number;
      end: number;
    }[] = [];
    const metricsByFieldId = new Map<
      Id<"fields">,
      { start: number; width: number; end: number }
    >();
    let contentOffset = leadingWidth;

    for (const fieldId of orderedVisibleFieldIdsRef.current) {
      const cell = headerCellsRef.current.get(fieldId);
      const width = cell?.offsetWidth ?? 0;
      const start = contentOffset;
      const end = start + width;
      const metrics = { start, width, end };

      orderedMetrics.push({
        fieldId,
        ...metrics,
      });
      metricsByFieldId.set(fieldId, metrics);
      contentOffset += width;
    }

    let leftOffset = 0;

    for (const fieldId of frozenVisibleFieldIdsRef.current) {
      const metrics = metricsByFieldId.get(fieldId);

      if (!metrics) continue;

      if (metrics.start < viewportStart + leftOffset) {
        modeByFieldId[fieldId] = "left";
        leftOffsetByFieldId[fieldId] = leftOffset;
        leftFloating.push(fieldId);
        leftOffset += Math.max(metrics.width - 1, 0);
      }
    }

    let rightOffset = 0;

    for (
      let index = frozenVisibleFieldIdsRef.current.length - 1;
      index >= 0;
      index--
    ) {
      const fieldId = frozenVisibleFieldIdsRef.current[index];

      if (!fieldId || modeByFieldId[fieldId] === "left") continue;

      const metrics = metricsByFieldId.get(fieldId);

      if (!metrics) continue;

      if (metrics.end > viewportEnd - rightOffset) {
        modeByFieldId[fieldId] = "right";
        rightOffsetByFieldId[fieldId] = rightOffset;
        rightFloating.unshift(fieldId);
        rightOffset += Math.max(metrics.width - 1, 0);
      }
    }

    for (const { fieldId } of orderedMetrics) {
      modeByFieldId[fieldId] ??= "inline";
    }

    setLayout((current) => {
      const next = {
        firstRightFrozenFieldId: rightFloating[0],
        lastLeftFrozenFieldId: leftFloating[leftFloating.length - 1],
        modeByFieldId,
        leftOffsetByFieldId,
        rightOffsetByFieldId,
      };

      return isEqual(current, next) ? current : next;
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    scheduleMeasure();

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleMeasure]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      scheduleMeasure();
    });

    const container = containerRef.current;

    if (container) {
      observer.observe(container);
    }

    if (leadingHeaderCellRef.current) {
      observer.observe(leadingHeaderCellRef.current);
    }

    for (const fieldId of orderedVisibleFieldIdsRef.current) {
      const cell = headerCellsRef.current.get(fieldId);

      if (cell) observer.observe(cell);
    }

    const handleScroll = () => {
      scheduleMeasure();
    };

    container?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container?.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [orderedVisibleFieldIdsKey, registryVersion, scheduleMeasure]);

  const setContainerNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (containerRef.current === node) return;
      containerRef.current = node;
      scheduleMeasure();
    },
    [scheduleMeasure],
  );

  const registerLeadingHeaderCell = useCallback(
    (node: HTMLTableCellElement | null) => {
      if (leadingHeaderCellRef.current === node) return;
      leadingHeaderCellRef.current = node;
      setRegistryVersion((value) => value + 1);
    },
    [],
  );

  const registerHeaderCell = useCallback(
    (fieldId: Id<"fields">, node: HTMLTableCellElement | null) => {
      const current = headerCellsRef.current.get(fieldId) ?? null;

      if (current === node) return;

      if (node) {
        headerCellsRef.current.set(fieldId, node);
      } else {
        headerCellsRef.current.delete(fieldId);
      }

      setRegistryVersion((value) => value + 1);
    },
    [],
  );

  return useMemo(
    () => ({
      orderedVisibleFieldIds,
      firstRightFrozenFieldId: layout.firstRightFrozenFieldId,
      lastLeftFrozenFieldId: layout.lastLeftFrozenFieldId,
      modeByFieldId: layout.modeByFieldId,
      leftOffsetByFieldId: layout.leftOffsetByFieldId,
      rightOffsetByFieldId: layout.rightOffsetByFieldId,
      setContainerNode,
      registerLeadingHeaderCell,
      registerHeaderCell,
    }),
    [
      layout.leftOffsetByFieldId,
      layout.firstRightFrozenFieldId,
      layout.lastLeftFrozenFieldId,
      layout.modeByFieldId,
      layout.rightOffsetByFieldId,
      orderedVisibleFieldIds,
      registerLeadingHeaderCell,
      registerHeaderCell,
      setContainerNode,
    ],
  );
}

export function TableFreezeProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: TableFreezeContextValue;
}) {
  return (
    <TableFreezeContext.Provider value={value}>
      {children}
    </TableFreezeContext.Provider>
  );
}

export function useTableFreeze() {
  const value = useContext(TableFreezeContext);

  if (!value) {
    throw new Error("useTableFreeze must be used within TableFreezeProvider");
  }

  return value;
}
