import { isEqual } from "lodash";

import { useHypershelf } from ".";
import { filtersEqual } from "../utils/zustand";

export const useIsViewDirty = () => {
  return useHypershelf((state) => {
    const view = (state.activeViewId
      ? state.views[state.activeViewId]
      : null) ?? {
      _id: "",
      name: "Default",
      global: false,
      builtin: true,
      sorting: {},
      fieldOrder: [],
      hiddenFields: [],
      frozenFields: [],
      enableFiltering: false,
      filters: undefined,
    };

    return (
      !isEqual(view.sorting ?? {}, state.sorting) ||
      !isEqual(view.fieldOrder ?? [], state.fieldOrder) ||
      !isEqual(view.hiddenFields ?? [], state.hiddenFields) ||
      !isEqual(view.frozenFields ?? [], state.frozenFields) ||
      (view.enableFiltering ?? false) !== state.isFiltering ||
      !filtersEqual(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        view.filters ?? { combinator: "and", rules: [] },
        state.filters ?? { combinator: "and", rules: [] },
      )
    );
  });
};
