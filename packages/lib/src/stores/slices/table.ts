import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { IndexedVM } from "@hypershelf/convex/schema";

import type { ImmerStateCreator, TableSlice } from "../types";
import { compactFieldOrder, getEffectiveFieldOrder } from "../fieldOrder";

export const tableSlice: ImmerStateCreator<TableSlice> = (set) => ({
  toggleHiding: () => {
    set((state) => {
      state.hiding = !state.hiding;
      localStorage.setItem("hiding", state.hiding ? "1" : "0");
    });
  },
  toggleAssetsReadOnly: () => {
    set((state) => {
      state.assetsReadOnly = !state.assetsReadOnly;
      localStorage.setItem("assetsReadOnly", state.assetsReadOnly ? "1" : "0");
    });
  },
  setSorting: (sorting) => {
    set((state) => {
      for (const [fieldId, order] of Object.entries(sorting) as [
        Id<"fields">,
        "asc" | "desc",
      ][]) {
        if (state.sorting[fieldId] !== order) {
          state.sorting[fieldId] = order;
        }
      }
      for (const fieldId of Object.keys(state.sorting)) {
        if (!sorting[fieldId as Id<"fields">]) {
          delete state.sorting[fieldId as Id<"fields">];
        }
      }
    });
  },
  toggleSorting: (fieldId) => {
    set((state) => {
      const current = state.sorting[fieldId];
      if (current === "asc") {
        state.sorting[fieldId] = "desc";
      } else if (current === "desc") {
        delete state.sorting[fieldId];
      } else {
        state.sorting[fieldId] = "asc";
      }
    });
  },
  toggleVisibility: (fieldId) => {
    set((state) => {
      if (state.hiddenFields.includes(fieldId)) {
        for (let i = 0; i < state.hiddenFields.length; i++) {
          if (state.hiddenFields[i] === fieldId) {
            state.hiddenFields.splice(i, 1);
            break;
          }
        }
      } else {
        state.hiddenFields.push(fieldId);
      }
    });
  },
  toggleFrozen: (fieldId) => {
    set((state) => {
      if (state.frozenFields.includes(fieldId)) {
        for (let i = 0; i < state.frozenFields.length; i++) {
          if (state.frozenFields[i] === fieldId) {
            state.frozenFields.splice(i, 1);
            break;
          }
        }
      } else {
        state.frozenFields.push(fieldId);
      }
    });
  },
  reorderField: (from, to) =>
    set((state) => {
      const nextFieldOrder = getEffectiveFieldOrder(
        state.fieldIds,
        state.fieldOrder,
      );
      const fromIndex = nextFieldOrder.indexOf(from);
      const toIndex = nextFieldOrder.indexOf(to);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      nextFieldOrder.splice(fromIndex, 1);
      nextFieldOrder.splice(toIndex, 0, from);
      state.fieldOrder = compactFieldOrder(state.fieldIds, nextFieldOrder);
    }),
  setFilters: (filters) => {
    set((state) => {
      state.filters = filters;
      state.createdAssets = [];
    });
  },
  setIsFiltering: (isFiltering) => {
    set((state) => {
      state.isFiltering = isFiltering;
      state.createdAssets = [];
    });
  },
  resetFilters: () => {
    set((state) => {
      const view = state.activeViewId && state.views[state.activeViewId];
      if (view) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        state.filters = view.filters ?? null;
        state.isFiltering = view.enableFiltering ?? false;
      } else {
        state.filters = null;
        state.isFiltering = false;
      }
    });
  },
  setSearch: (search) => {
    set((state) => {
      state.search = search;
      if (!search) {
        state.searchResults = [];
        state.searchResultsVSphere = [];
        return;
      }

      const lower = search.toLowerCase().trim();
      const qLen = lower.length;
      const threshold =
        qLen <= 1
          ? 0.6
          : qLen === 2
            ? 0.62
            : qLen <= 4
              ? 0.58
              : qLen <= 7
                ? 0.5
                : 0.45;

      const split = (x: string) =>
        x
          .toLowerCase()
          .trim()
          .split(/[\s._\-:/\\]+/)
          .filter(Boolean);
      const leftBias = (tokens: string[], idx: number) =>
        Math.max(0.8, 1 - idx * 0.06);

      const damerauLevenshtein = (a: string, b: string): number => {
        const n = a.length;
        const m = b.length;
        if (n === 0) return m;
        if (m === 0) return n;
        const dp: number[][] = Array.from({ length: n + 1 }, (_, i) =>
          Array.from({ length: m + 1 }, (_, j) =>
            i === 0 ? j : j === 0 ? i : 0,
          ),
        );
        for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= m; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const row = dp[i];
            const prevRow = dp[i - 1];
            if (!row || !prevRow) continue;
            row[j] = Math.min(
              (prevRow[j] ?? 0) + 1,
              (row[j - 1] ?? 0) + 1,
              (prevRow[j - 1] ?? 0) + cost,
            );
            if (
              i > 1 &&
              j > 1 &&
              a[i - 1] === b[j - 2] &&
              a[i - 2] === b[j - 1]
            ) {
              row[j] = Math.min(row[j] ?? 0, (dp[i - 2]?.[j - 2] ?? 0) + 1);
            }
          }
        }
        return dp[n]?.[m] ?? 0;
      };

      const trigrams = (s: string): Set<string> => {
        const x = `  ${s} `;
        const g = new Set<string>();
        for (let i = 0; i < x.length - 2; i++) g.add(x.slice(i, i + 3));
        return g;
      };

      const jaccard = (a: Set<string>, b: Set<string>): number => {
        let inter = 0;
        for (const t of a) if (b.has(t)) inter++;
        const denom = a.size + b.size - inter;
        return denom === 0 ? 0 : inter / denom;
      };

      const qTokens = split(lower);
      const qTri = trigrams(lower);

      const baseSim = (s: string): number => {
        if (!s) return 0;
        if (s === lower) return 1;
        let score = 0;
        if (s.includes(lower)) {
          const pos = s.indexOf(lower);

          const lenPenalty =
            Math.abs(s.length - lower.length) /
            Math.max(s.length, lower.length);
          const posBonus = 1 - Math.min(pos / Math.max(1, s.length), 0.9);
          score = Math.max(score, 0.75 + 0.25 * (1 - lenPenalty) * posBonus);
        }
        const dist = damerauLevenshtein(s, lower);
        score = Math.max(
          score,
          Math.max(0, 1 - dist / Math.max(s.length, lower.length)) * 0.7,
        );
        score = Math.max(score, jaccard(trigrams(s), qTri) * 0.85);
        return Math.min(1, score);
      };

      const tokenGate = (vTokens: string[]): boolean => {
        if (qTokens.length === 0) {
          if (qLen <= 2) return vTokens.some((t) => t.startsWith(lower));
          return vTokens.some(
            (t) =>
              t.includes(lower) ||
              1 -
                damerauLevenshtein(t, lower) /
                  Math.max(t.length, lower.length) >=
                0.7,
          );
        }
        let passes = 0;
        for (const q of qTokens) {
          let ok = false;
          for (const t of vTokens) {
            const ed =
              1 - damerauLevenshtein(t, q) / Math.max(t.length, q.length);
            if (t.startsWith(q)) {
              ok = true;
              break;
            }
            if (t.includes(q) && q.length >= 2) {
              ok = true;
              break;
            }
            if (ed >= 0.72) {
              ok = true;
              break;
            }
            if (jaccard(trigrams(t), trigrams(q)) >= 0.38) {
              ok = true;
              break;
            }
          }
          if (ok) passes++;
        }
        return passes === qTokens.length;
      };

      const textScore = (val: string): number => {
        const s = String(val).toLowerCase().trim();
        if (!s) return 0;
        const vTokens = split(s);
        if (!tokenGate(vTokens)) return 0;
        let bestToken = 0;
        for (let i = 0; i < vTokens.length; i++) {
          const vt = vTokens[i];
          if (!vt) continue;
          const bias = leftBias(vTokens, i);
          if (qTokens.length === 0) {
            const pfx = vt.startsWith(lower)
              ? Math.max(0.7, lower.length / Math.max(1, vt.length))
              : 0;
            bestToken = Math.max(bestToken, pfx * bias);
          } else {
            for (const qt of qTokens) {
              let s1 = 0;
              if (vt === qt) s1 = 1;
              else if (vt.startsWith(qt) || qt.startsWith(vt))
                s1 =
                  0.9 *
                  (Math.min(vt.length, qt.length) /
                    Math.max(vt.length, qt.length));
              else if (vt.includes(qt) || qt.includes(vt))
                s1 =
                  0.7 *
                  (Math.min(vt.length, qt.length) /
                    Math.max(vt.length, qt.length));
              const ed =
                1 - damerauLevenshtein(vt, qt) / Math.max(vt.length, qt.length);
              const tri = jaccard(trigrams(vt), trigrams(qt));
              const local = Math.max(s1, ed * 0.9, tri * 0.85);
              bestToken = Math.max(bestToken, local * bias);
            }
          }
        }
        return Math.max(bestToken, baseSim(s));
      };

      const upsertBest = <T extends string>(
        arr: { id: T; score: number }[],
        id: T,
        score: number,
      ) => {
        const existing = arr.find((x) => x.id === id);
        if (!existing) arr.push({ id, score });
        else if (score > existing.score) existing.score = score;
      };

      const assetCandidates: { id: Id<"assets">; score: number }[] = [];
      const vmCandidates: { vm: IndexedVM; score: number }[] = [];
      const magicHostname = state.magicFields.magic__hostname;
      const magicIP = state.magicFields.magic__ip;

      for (const asset of Object.values(state.assets)) {
        let bestScore = 0;

        const boost = (score: number, weight: number) =>
          Math.min(1, score * weight);

        for (const [key, v] of Object.entries(asset.asset.metadata ?? {})) {
          const s = String(v ?? "").toLowerCase();
          if (!s) continue;
          let weight = 1;
          if (key === state.magicFields.magic__hostname) weight = 1.3;
          else if (key === state.magicFields.magic__ip) weight = 1.22;
          else {
            const field = Object.values(state.fields).find(
              (f) => f.field._id === key,
            );
            if (field?.field.type === "markdown") weight = 0.5;
          }
          const base = textScore(s);
          bestScore = Math.max(bestScore, boost(base, weight));
          if (bestScore >= 1) break;
        }

        if (bestScore < 1 && magicHostname && magicIP) {
          const linkedVSphereAsset = state.indexedVMs.find(
            (vm) =>
              vm.hostname === asset.asset.metadata?.[magicHostname] ||
              vm.ips?.includes(String(asset.asset.metadata?.[magicIP])),
          );
          const searchKeys = {
            hostname: 1.18,
            primaryIp: 1.12,
            ips: 1.1,
            guestOs: 1.0,
            portgroup: 1.0,
            snaps: 0.8,
            moid: 0.8,
            cluster: 1.0,
            drives: 0.7,
          } as const satisfies Partial<Record<keyof IndexedVM, number>>;
          for (const [key, weight] of Object.entries(searchKeys) as [
            keyof IndexedVM,
            number,
          ][]) {
            const value = linkedVSphereAsset?.[key];
            let s: string[] = [];
            if (typeof value === "object") {
              if (key === "snaps" && Array.isArray(value)) {
                for (const snap of value as NonNullable<IndexedVM["snaps"]>) {
                  if (snap.name) s.push(String(snap.name).toLowerCase());
                  if (snap.description)
                    s.push(String(snap.description).toLowerCase());
                }
              } else if (key === "drives" && Array.isArray(value)) {
                for (const drive of value as NonNullable<IndexedVM["drives"]>) {
                  if (drive.datastore)
                    s.push(String(drive.datastore).toLowerCase());
                }
              }
            } else s = [String(value).toLowerCase()];
            if (s.length === 0) continue;
            for (const str of s) {
              const base = textScore(str);
              bestScore = Math.max(bestScore, boost(base, weight));
              if (bestScore >= 1) break;
            }
          }
        }

        if (bestScore >= threshold)
          upsertBest(assetCandidates, asset.asset._id, Math.min(1, bestScore));
      }

      for (const vm of state.indexedVMs) {
        const hostnameScore = vm.hostname ? textScore(vm.hostname) : 0;
        const ipScore = vm.ips?.length
          ? Math.max(...vm.ips.map((ip) => textScore(ip)))
          : 0;
        const guestScore = vm.guestOs ? textScore(vm.guestOs) : 0;
        let bestSnapsScore = 0;
        if (vm.snaps) {
          for (const snap of vm.snaps) {
            const snapScore = textScore(snap.name) * 0.8;
            bestSnapsScore = Math.max(bestSnapsScore, snapScore);
            if (bestSnapsScore >= 1) break;
          }
        }

        const score = Math.max(
          hostnameScore * 1.0,
          ipScore * 0.96,
          guestScore * 0.68,
          bestSnapsScore * 0.65,
        );

        const hostnameField = state.magicFields.magic__hostname;
        const ipField = state.magicFields.magic__ip;
        if (hostnameField && ipField) {
          const asset = Object.values(state.assets).find(
            (a) =>
              (a.asset.metadata?.[hostnameField] &&
                a.asset.metadata[hostnameField] === vm.hostname) ??
              (a.asset.metadata?.[ipField] &&
                vm.ips?.includes(String(a.asset.metadata[ipField]))),
          );
          if (asset) {
            upsertBest(
              assetCandidates,
              asset.asset._id,
              Math.max(score * 0.98, 0.5),
            );
          }
        }
        if (score >= threshold) vmCandidates.push({ vm, score });
      }

      assetCandidates.sort((a, b) => b.score - a.score);
      vmCandidates.sort((a, b) => b.score - a.score);

      const filteredAssetCandidates = assetCandidates.filter(
        (x, i) => x.score >= threshold || i < 200,
      );
      const filteredVMCandidates = vmCandidates.filter(
        (x, i) => x.score >= threshold || i < 200,
      );

      state.searchResults = filteredAssetCandidates.map((x) => x.id);
      state.searchResultsVSphere = filteredVMCandidates.map((x) => x.vm);
    });
  },
  setIndexedVMs: (vms) => {
    set((state) => {
      state.indexedVMs = vms;
    });
  },
});
