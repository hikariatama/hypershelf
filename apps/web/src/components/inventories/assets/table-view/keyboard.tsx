import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import type {
  FieldRendererTableCellProps,
  TableCellEditorHandle,
  TableCellMode,
} from "@hypershelf/ui";
import { HotkeyScopeProvider, useScopedHotkeys } from "@hypershelf/ui/hotkeys";

type TableCellRegistration = {
  editor: TableCellEditorHandle | null;
  element: HTMLElement | null;
};

type TableKeyboardState = {
  activeColumnIndex: number;
  activeRowIndex: number;
  focusedCellKey: string | null;
  mode: TableCellMode;
};

type TableKeyboardContextValue = {
  beginEdit: () => void;
  getState: () => TableKeyboardState;
  move: (deltaX: number, deltaY?: number) => void;
  moveByPage: (direction: -1 | 1) => void;
  moveToEdge: (edge: "start" | "end") => void;
  registerEditor: (
    rowIndex: number,
    columnIndex: number,
    editor: TableCellEditorHandle | null,
  ) => void;
  registerElement: (
    rowIndex: number,
    columnIndex: number,
    element: HTMLElement | null,
  ) => void;
  setActiveCell: (rowIndex: number, columnIndex: number) => void;
  setMode: (mode: TableCellMode) => void;
  subscribe: (listener: () => void) => () => void;
};

const TableKeyboardContext = createContext<TableKeyboardContextValue | null>(
  null,
);

function getCellKey(rowIndex: number, columnIndex: number) {
  return `${rowIndex}:${columnIndex}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type FocusActiveCellOptions = {
  preserveScroll?: boolean;
};

export function TableKeyboardProvider({
  children,
  columnCount,
  containerRef,
  rowCount,
}: {
  children: ReactNode;
  columnCount: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  rowCount: number;
}) {
  const cellsRef = useRef(new Map<string, TableCellRegistration>());
  const listenersRef = useRef(new Set<() => void>());
  const focusFrameRef = useRef<number | null>(null);
  const hadFocusWithinTableRef = useRef(false);
  const rowCountRef = useRef(rowCount);
  const columnCountRef = useRef(columnCount);
  const stateRef = useRef<TableKeyboardState>({
    activeColumnIndex: 0,
    activeRowIndex: 0,
    focusedCellKey: null,
    mode: "navigation",
  });

  rowCountRef.current = rowCount;
  columnCountRef.current = columnCount;

  const focusActiveCell = useCallback(
    ({ preserveScroll = false }: FocusActiveCellOptions = {}) => {
      const { activeColumnIndex, activeRowIndex } = stateRef.current;
      const cell = cellsRef.current.get(
        getCellKey(activeRowIndex, activeColumnIndex),
      );

      if (!cell?.element) return;

      cell.element.focus({ preventScroll: preserveScroll });
      if (!preserveScroll) {
        cell.element.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
      }
    },
    [],
  );

  const scheduleFocusActiveCell = useCallback(
    (options?: FocusActiveCellOptions) => {
      if (focusFrameRef.current != null) {
        cancelAnimationFrame(focusFrameRef.current);
      }

      focusFrameRef.current = requestAnimationFrame(() => {
        focusFrameRef.current = null;
        focusActiveCell(options);
      });
    },
    [focusActiveCell],
  );

  const emit = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const updateState = useCallback(
    (
      updater:
        | TableKeyboardState
        | ((state: TableKeyboardState) => TableKeyboardState),
    ) => {
      const current = stateRef.current;
      const next = typeof updater === "function" ? updater(current) : updater;

      if (
        current.activeRowIndex === next.activeRowIndex &&
        current.activeColumnIndex === next.activeColumnIndex &&
        current.focusedCellKey === next.focusedCellKey &&
        current.mode === next.mode
      ) {
        return current;
      }

      stateRef.current = next;
      emit();
      return next;
    },
    [emit],
  );

  const registerElement = useCallback(
    (rowIndex: number, columnIndex: number, element: HTMLElement | null) => {
      const key = getCellKey(rowIndex, columnIndex);
      const current = cellsRef.current.get(key) ?? {
        editor: null,
        element: null,
      };

      if (element == null && current.editor == null) {
        cellsRef.current.delete(key);
        return;
      }

      cellsRef.current.set(key, {
        ...current,
        element,
      });
    },
    [],
  );

  const registerEditor = useCallback(
    (
      rowIndex: number,
      columnIndex: number,
      editor: TableCellEditorHandle | null,
    ) => {
      const key = getCellKey(rowIndex, columnIndex);
      const current = cellsRef.current.get(key) ?? {
        editor: null,
        element: null,
      };

      if (editor == null && current.element == null) {
        cellsRef.current.delete(key);
        return;
      }

      cellsRef.current.set(key, {
        ...current,
        editor,
      });
    },
    [],
  );

  const setMode = useCallback(
    (mode: TableCellMode) => {
      updateState((current) => ({
        ...current,
        mode,
      }));
      if (mode === "navigation") {
        scheduleFocusActiveCell();
      }
    },
    [scheduleFocusActiveCell, updateState],
  );

  const setActiveCell = useCallback(
    (rowIndex: number, columnIndex: number) => {
      updateState((current) => ({
        ...current,
        activeRowIndex: clamp(
          rowIndex,
          0,
          Math.max(rowCountRef.current - 1, 0),
        ),
        activeColumnIndex: clamp(
          columnIndex,
          0,
          Math.max(columnCountRef.current - 1, 0),
        ),
      }));
    },
    [updateState],
  );

  const move = useCallback(
    (deltaX: number, deltaY = 0) => {
      updateState((current) => ({
        ...current,
        activeRowIndex: clamp(
          current.activeRowIndex + deltaY,
          0,
          Math.max(rowCountRef.current - 1, 0),
        ),
        activeColumnIndex: clamp(
          current.activeColumnIndex + deltaX,
          0,
          Math.max(columnCountRef.current - 1, 0),
        ),
        mode: "navigation",
      }));
      scheduleFocusActiveCell();
    },
    [scheduleFocusActiveCell, updateState],
  );

  const moveToEdge = useCallback(
    (edge: "start" | "end") => {
      updateState((current) => ({
        ...current,
        activeColumnIndex:
          edge === "start" ? 0 : Math.max(columnCountRef.current - 1, 0),
        mode: "navigation",
      }));
      scheduleFocusActiveCell();
    },
    [scheduleFocusActiveCell, updateState],
  );

  const moveByPage = useCallback(
    (direction: -1 | 1) => {
      const { activeColumnIndex, activeRowIndex } = stateRef.current;
      const cell = cellsRef.current.get(
        getCellKey(activeRowIndex, activeColumnIndex),
      );
      const container = containerRef.current;
      const pageSize =
        container && cell?.element
          ? Math.max(
              1,
              Math.floor(container.clientHeight / cell.element.offsetHeight),
            )
          : 10;

      move(0, pageSize * direction);
    },
    [containerRef, move],
  );

  const beginEdit = useCallback(() => {
    const { activeColumnIndex, activeRowIndex } = stateRef.current;
    const editor = cellsRef.current.get(
      getCellKey(activeRowIndex, activeColumnIndex),
    )?.editor;

    if (!editor) return;

    updateState((current) => ({
      ...current,
      mode: "editing",
    }));
    editor.beginEdit();
  }, [updateState]);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (rowCount === 0 || columnCount === 0) return;

    updateState((current) => ({
      ...current,
      activeRowIndex: clamp(current.activeRowIndex, 0, rowCount - 1),
      activeColumnIndex: clamp(current.activeColumnIndex, 0, columnCount - 1),
    }));
  }, [columnCount, rowCount, updateState]);

  useEffect(() => {
    if (rowCount === 0 || columnCount === 0) return;

    const container = containerRef.current;

    if (!container) return;

    const activeElement = document.activeElement;

    if (
      activeElement &&
      activeElement !== document.body &&
      activeElement !== document.documentElement &&
      !container.contains(activeElement)
    ) {
      return;
    }

    hadFocusWithinTableRef.current = true;
    scheduleFocusActiveCell();
  }, [columnCount, containerRef, rowCount, scheduleFocusActiveCell]);

  useEffect(() => {
    return () => {
      if (focusFrameRef.current != null) {
        cancelAnimationFrame(focusFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!container.contains(event.target)) return;
      hadFocusWithinTableRef.current = true;

      const focusedCellKey =
        event.target instanceof Element
          ? (event.target.closest<HTMLElement>("[data-table-cell-key]")?.dataset
              .tableCellKey ?? null)
          : null;

      updateState((current) => ({
        ...current,
        focusedCellKey,
      }));

      if (event.target === container) {
        container.blur();
        scheduleFocusActiveCell({ preserveScroll: true });
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!container.contains(event.target)) return;

      const nextTarget = event.relatedTarget;

      if (nextTarget instanceof Node && container.contains(nextTarget)) {
        return;
      }

      updateState((current) => ({
        ...current,
        focusedCellKey: null,
      }));

      if (nextTarget != null) {
        hadFocusWithinTableRef.current = false;
      }
    };

    const handleWindowFocus = () => {
      if (!hadFocusWithinTableRef.current) return;
      if (stateRef.current.mode !== "navigation") return;
      requestAnimationFrame(() => {
        if (document.activeElement === container) {
          container.blur();
        }
        scheduleFocusActiveCell({ preserveScroll: true });
      });
    };

    const handleContainerKeyDown = (event: KeyboardEvent) => {
      if (event.target !== container) return;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          move(-1, 0);
          return;
        case "ArrowRight":
          event.preventDefault();
          move(1, 0);
          return;
        case "ArrowUp":
          event.preventDefault();
          move(0, -1);
          return;
        case "ArrowDown":
          event.preventDefault();
          move(0, 1);
          return;
        case "Home":
          event.preventDefault();
          moveToEdge("start");
          return;
        case "End":
          event.preventDefault();
          moveToEdge("end");
          return;
        case "PageUp":
          event.preventDefault();
          moveByPage(-1);
          return;
        case "PageDown":
          event.preventDefault();
          moveByPage(1);
          return;
        case "Enter":
        case "F2":
        case " ":
          event.preventDefault();
          beginEdit();
          return;
        default:
          break;
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("focusout", handleFocusOut);
    container.addEventListener("keydown", handleContainerKeyDown);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      container.removeEventListener("focusin", handleFocusIn);
      container.removeEventListener("focusout", handleFocusOut);
      container.removeEventListener("keydown", handleContainerKeyDown);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [
    beginEdit,
    containerRef,
    move,
    moveByPage,
    moveToEdge,
    scheduleFocusActiveCell,
    updateState,
  ]);

  const value = useMemo<TableKeyboardContextValue>(
    () => ({
      beginEdit,
      getState: () => stateRef.current,
      move,
      moveByPage,
      moveToEdge,
      registerEditor,
      registerElement,
      setActiveCell,
      setMode,
      subscribe,
    }),
    [
      beginEdit,
      move,
      moveByPage,
      moveToEdge,
      registerEditor,
      registerElement,
      setActiveCell,
      setMode,
      subscribe,
    ],
  );

  return (
    <TableKeyboardContext.Provider value={value}>
      <TableKeyboardScopes containerRef={containerRef} rowCount={rowCount}>
        {children}
      </TableKeyboardScopes>
    </TableKeyboardContext.Provider>
  );
}

function TableKeyboardScopes({
  children,
  containerRef,
  rowCount,
}: {
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  rowCount: number;
}) {
  const mode = useTableKeyboardMode();

  return (
    <HotkeyScopeProvider
      scope="table"
      active={rowCount > 0}
      blockScopes={mode === "editing" ? ["app"] : []}
    >
      <TableKeyboardShortcuts containerRef={containerRef} rowCount={rowCount} />
      {children}
    </HotkeyScopeProvider>
  );
}

function TableKeyboardShortcuts({
  containerRef,
  rowCount,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  rowCount: number;
}) {
  const { beginEdit, move, moveByPage, moveToEdge } = useTableKeyboard();
  const mode = useTableKeyboardMode();

  useScopedHotkeys(
    [
      {
        hotkey: "ArrowLeft",
        callback: (event) => {
          event.preventDefault();
          move(-1, 0);
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "ArrowRight",
        callback: (event) => {
          event.preventDefault();
          move(1, 0);
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "ArrowUp",
        callback: (event) => {
          event.preventDefault();
          move(0, -1);
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "ArrowDown",
        callback: (event) => {
          event.preventDefault();
          move(0, 1);
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "Home",
        callback: (event) => {
          event.preventDefault();
          moveToEdge("start");
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "End",
        callback: (event) => {
          event.preventDefault();
          moveToEdge("end");
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "PageUp",
        callback: (event) => {
          event.preventDefault();
          moveByPage(-1);
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "PageDown",
        callback: (event) => {
          event.preventDefault();
          moveByPage(1);
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "Enter",
        callback: (event) => {
          event.preventDefault();
          beginEdit();
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "F2",
        callback: (event) => {
          event.preventDefault();
          beginEdit();
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
      {
        hotkey: "Space",
        callback: (event) => {
          event.preventDefault();
          beginEdit();
        },
        enabled: rowCount > 0 && mode === "navigation",
        scope: "table",
      },
    ],
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
      target: containerRef,
    },
  );

  return null;
}

export function useTableKeyboard() {
  const context = useContext(TableKeyboardContext);

  if (!context) {
    throw new Error(
      "useTableKeyboard must be used within TableKeyboardProvider",
    );
  }

  return context;
}

export function useTableKeyboardMode() {
  const { getState, subscribe } = useTableKeyboard();

  return useSyncExternalStore(
    subscribe,
    () => getState().mode,
    () => "navigation",
  );
}

export function useTableCellProps(
  rowIndex: number,
  columnIndex: number,
): FieldRendererTableCellProps {
  const { getState, move, setMode, subscribe } = useTableKeyboard();
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const state = getState();
      const cellKey = getCellKey(rowIndex, columnIndex);

      if (
        state.activeRowIndex === rowIndex &&
        state.activeColumnIndex === columnIndex
      ) {
        return `1:${state.focusedCellKey === cellKey ? "1" : "0"}:${state.mode}` as const;
      }

      if (state.focusedCellKey === cellKey) {
        return "0:1:navigation" as const;
      }

      return "0:0:navigation" as const;
    },
    () => "0:0:navigation" as const,
  );

  const [activeSnapshot, focusedSnapshot, modeSnapshot] = snapshot.split(":");
  const active = activeSnapshot === "1";
  const focused = focusedSnapshot === "1";
  const mode = active ? (modeSnapshot as TableCellMode) : "navigation";

  return useMemo(
    () => ({
      active,
      columnIndex,
      focused,
      mode,
      move,
      onModeChange: setMode,
      rowIndex,
    }),
    [active, columnIndex, focused, mode, move, rowIndex, setMode],
  );
}
