import type { RegisterableHotkey } from "@tanstack/hotkeys";
import type {
  HotkeysProviderProps,
  UseHotkeyDefinition,
  UseHotkeyOptions,
} from "@tanstack/react-hotkeys";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";

export type HotkeyScope =
  | "app"
  | "table"
  | "table-editor"
  | "markdown-editor"
  | "dialog"
  | "popover";

type HotkeyScopeState = {
  activeScopes: Set<HotkeyScope>;
  blockedScopes: Set<HotkeyScope>;
};

export type ScopedHotkeyDefinition = Omit<UseHotkeyDefinition, "hotkey"> & {
  hotkey: RegisterableHotkey | (string & {});
  scope?: HotkeyScope | HotkeyScope[];
  enabled?: boolean;
};

const HotkeyScopeContext = createContext<HotkeyScopeState>({
  activeScopes: new Set(["app"]),
  blockedScopes: new Set(),
});
const EMPTY_SCOPES: HotkeyScope[] = [];

function normalizeScopes(scope?: HotkeyScope | HotkeyScope[]) {
  if (!scope) return [];
  return Array.isArray(scope) ? scope : [scope];
}

export function HypershelfHotkeysProvider({
  children,
  defaultOptions,
}: HotkeysProviderProps) {
  return (
    <HotkeysProvider defaultOptions={defaultOptions}>
      <HotkeyScopeContext.Provider
        value={{
          activeScopes: new Set(["app"]),
          blockedScopes: new Set(),
        }}
      >
        {children}
      </HotkeyScopeContext.Provider>
    </HotkeysProvider>
  );
}

export function HotkeyScopeProvider({
  children,
  scope,
  active = true,
  blockScopes = EMPTY_SCOPES,
}: {
  children: ReactNode;
  scope: HotkeyScope;
  active?: boolean;
  blockScopes?: HotkeyScope[];
}) {
  const parent = useContext(HotkeyScopeContext);
  const blockedScopeKey = blockScopes.join("|");
  const normalizedBlockScopes = useMemo(
    () =>
      blockedScopeKey === ""
        ? EMPTY_SCOPES
        : (blockedScopeKey.split("|") as HotkeyScope[]),
    [blockedScopeKey],
  );
  const value = useMemo(() => {
    const activeScopes = new Set(parent.activeScopes);
    const blockedScopes = new Set(parent.blockedScopes);

    if (active) {
      activeScopes.add(scope);
      for (const blockedScope of normalizedBlockScopes) {
        blockedScopes.add(blockedScope);
      }
    }

    return {
      activeScopes,
      blockedScopes,
    };
  }, [
    active,
    normalizedBlockScopes,
    parent.activeScopes,
    parent.blockedScopes,
    scope,
  ]);

  return (
    <HotkeyScopeContext.Provider value={value}>
      {children}
    </HotkeyScopeContext.Provider>
  );
}

export function useScopedHotkeys(
  definitions: readonly ScopedHotkeyDefinition[],
  commonOptions?: UseHotkeyOptions,
) {
  const { activeScopes, blockedScopes } = useContext(HotkeyScopeContext);

  const activeDefinitions = definitions.flatMap((definition) => {
    const scopes = normalizeScopes(definition.scope);
    const enabledByScope =
      scopes.length === 0
        ? true
        : scopes.every(
            (scope) => activeScopes.has(scope) && !blockedScopes.has(scope),
          );

    if (!(definition.enabled ?? true) || !enabledByScope) {
      return [];
    }

    return [
      {
        hotkey: definition.hotkey as RegisterableHotkey,
        callback: definition.callback,
        options: definition.options,
      },
    ];
  });

  useHotkeys(activeDefinitions, commonOptions);
}
