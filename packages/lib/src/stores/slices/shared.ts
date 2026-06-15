import type { ImmerStateCreator, SharedSlice } from "../types";

export const sharedSlice: ImmerStateCreator<SharedSlice> = (set, get) => ({
  setViewer: (viewer) => {
    set((state) => {
      if (state.viewer === viewer) return;
      state.viewer = viewer;
    });
    get().revalidateLocks();
  },
  init: () => {
    set((state) => {
      const storedHiding = localStorage.getItem("hiding");
      if (storedHiding === "0") {
        state.hiding = false;
      } else if (storedHiding === "1") {
        state.hiding = true;
      }

      const storedAssetsReadOnly = localStorage.getItem("assetsReadOnly");
      if (storedAssetsReadOnly === "0") {
        state.assetsReadOnly = false;
      } else if (storedAssetsReadOnly === "1") {
        state.assetsReadOnly = true;
      }

      const url = new URL(window.location.href);
      const rootMoidFromUrl = url.searchParams.get("rootMoid");
      if (rootMoidFromUrl) {
        state.rootMoid = rootMoidFromUrl;
        localStorage.setItem("rootMoid", rootMoidFromUrl);
      }
    });
  },
});
