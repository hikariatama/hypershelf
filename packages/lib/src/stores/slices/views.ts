import { isEqual } from "lodash";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { ExtendedViewType } from "@hypershelf/convex/schema";

import type { ImmerStateCreator, ViewsSlice } from "../types";

export const viewsSlice: ImmerStateCreator<ViewsSlice> = (set, get) => ({
  setActiveViewId: (activeView) => {
    const state = get();
    if (state.activeViewId === activeView) return false;
    if (activeView && !state.views[activeView]) {
      console.warn("Tried to set unknown view as active:", activeView);
      return false;
    }
    set((state) => {
      state.activeViewId = activeView;
      if (activeView) localStorage.setItem("activeViewId", activeView);
      else localStorage.removeItem("activeViewId");
    });
    if (activeView) get().applyView(activeView);
    return true;
  },
  applyView: (viewId) => {
    const state = get();
    if (viewId === "builtin:all") {
      set((state) => {
        state.sorting = {};
        state.filters = { combinator: "and", rules: [] };
        state.isFiltering = false;
        state.hiddenFields = [];
        state.frozenFields = [];
        state.fieldOrder = [];
      });
      return;
    }
    if (!state.views[viewId]) {
      console.warn("Tried to apply unknown view:", viewId);
      return;
    }
    const view = state.views[viewId];
    set((state) => {
      state.sorting = { ...view.sorting };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      state.filters = view.filters ?? null;
      state.isFiltering = view.enableFiltering ?? false;
      state.hiddenFields = [...(view.hiddenFields ?? [])];
      state.frozenFields = [...(view.frozenFields ?? [])];
      state.fieldOrder = [...(view.fieldOrder ?? [])];
      state.createdAssets = [];
    });
  },
  setViews: (views) =>
    set((state) => {
      for (const [id, view] of Object.entries(views) as [
        Id<"views">,
        ExtendedViewType,
      ][]) {
        if (state.views[id] && isEqual(state.views[id], view)) continue;
        state.views[id] = view;
      }
      for (const id of Object.keys(state.views)) {
        if (!views[id as Id<"views">]) {
          delete state.views[id as Id<"views">];
          if (state.activeViewId === id) {
            state.activeViewId = null;
          }
        }
      }
    }),
});
