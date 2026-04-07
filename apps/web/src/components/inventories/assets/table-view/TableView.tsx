import type { DragEndEvent } from "@dnd-kit/core";
import { useCallback, useRef } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { apply as jlApply } from "json-logic-js";
import { isEqual } from "lodash";
import { SearchSlash } from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type { IndexedVM, ValueType } from "@hypershelf/convex/schema";
import { useHypershelf } from "@hypershelf/lib/stores";
import { Table, TableBody, TableHeader } from "@hypershelf/ui/primitives/table";

import { formatQuery } from "~/components/query-builder";
import { DataRowStable } from "./DataRow";
import { TableFreezeProvider, useTableFreezeLayoutValue } from "./freeze";
import { TableKeyboardProvider } from "./keyboard";
import { SmartHeader } from "./SmartHeader";

export function TableView() {
  const freezeLayout = useTableFreezeLayoutValue();
  const { setContainerNode } = freezeLayout;
  const containerRef = useRef<HTMLDivElement>(null);
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      setContainerNode(node);
    },
    [setContainerNode],
  );
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );
  const sortedAssetIds = useStoreWithEqualityFn(
    useHypershelf,
    (state) => {
      const {
        sorting,
        assets,
        assetIds,
        isFiltering,
        filters,
        createdAssets,
        search,
        searchResults,
        indexedVMs,
        magicFields,
      } = state;

      let sorted = [];

      if (search) {
        sorted = [
          ...createdAssets.filter((id) => assetIds.includes(id)),
          ...searchResults.filter((id) => assetIds.includes(id)),
        ];
      } else {
        sorted = [...assetIds];
        sorted.sort((a, b) => {
          if (createdAssets.includes(a) && !createdAssets.includes(b)) {
            return -1;
          }
          if (!createdAssets.includes(a) && createdAssets.includes(b)) {
            return 1;
          }

          if (Object.keys(sorting).length === 0) return 0;

          const assetA = assets[a];
          const assetB = assets[b];

          for (const [fieldId, order] of Object.entries(sorting)) {
            const valueA = assetA?.asset.metadata?.[
              fieldId as Id<"fields">
            ] as ValueType;
            const valueB = assetB?.asset.metadata?.[
              fieldId as Id<"fields">
            ] as ValueType;

            if (valueA === valueB) continue;

            if (valueA == null && valueB == null) continue;
            if (valueA == null) return order === "asc" ? 1 : -1;
            if (valueB == null) return order === "asc" ? -1 : 1;

            if (valueA < valueB) return order === "asc" ? -1 : 1;
            if (valueA > valueB) return order === "asc" ? 1 : -1;
          }

          return 0;
        });
      }

      if (isFiltering && filters && filters.rules.length > 0) {
        const query = formatQuery(filters);
        return sorted.filter((assetId) => {
          const hostnameFieldId = magicFields.magic__hostname;
          const ipFieldId = magicFields.magic__ip;
          let linkedVSphereAsset: IndexedVM | undefined;
          if (hostnameFieldId && ipFieldId) {
            linkedVSphereAsset = indexedVMs.find(
              (vm) =>
                vm.hostname ===
                  assets[assetId]?.asset.metadata?.[hostnameFieldId] ||
                vm.ips?.includes(
                  String(assets[assetId]?.asset.metadata?.[ipFieldId]),
                ),
            );
          }
          return (
            createdAssets.includes(assetId) ||
            jlApply(query, {
              ...assets[assetId]?.asset.metadata,
              vsphere__hostname: linkedVSphereAsset?.hostname,
              vsphere__cluster: linkedVSphereAsset?.cluster,
              vsphere__guestOs: linkedVSphereAsset?.guestOs,
              vsphere__cpuCores: linkedVSphereAsset?.cpuCores,
              vsphere__memoryMb: linkedVSphereAsset?.memoryMb,
              vsphere__ips: linkedVSphereAsset?.ips ?? [],
              vsphere__primaryIp: linkedVSphereAsset?.primaryIp,
              vsphere__portgroup: linkedVSphereAsset?.portgroup,
            })
          );
        });
      }

      return sorted;
    },
    isEqual,
  );
  const reorderField = useHypershelf((state) => state.reorderField);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.id !== over?.id) {
        reorderField(active.id as Id<"fields">, over?.id as Id<"fields">);
      }
    },
    [reorderField],
  );

  return (
    <TableFreezeProvider value={freezeLayout}>
      {sortedAssetIds.length ? (
        <div className="backdrop-blur-lg absolute z-[99] h-[calc(2rem+1px)] w-[calc(100vw-1rem)] rounded-tl-md rounded-tr-md border border-border bg-background/70" />
      ) : null}
      <div
        ref={setContainerRef}
        className="relative h-[calc(100dvh-3.5rem)] overflow-auto overscroll-none rounded-md border outline-none focus:outline-none focus-visible:outline-none"
      >
        {sortedAssetIds.length ? (
          <TableKeyboardProvider
            columnCount={freezeLayout.orderedVisibleFieldIds.length + 1}
            containerRef={containerRef}
            rowCount={sortedAssetIds.length}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table
                className="border-spacing-0 table-auto border-separate"
                role="grid"
              >
                <TableHeader
                  className="top-0 sticky z-[100] !border-0"
                  role="rowgroup"
                >
                  <SmartHeader />
                </TableHeader>
                <TableBody className="relative" role="rowgroup">
                  {sortedAssetIds.map((assetId, rowIndex) => (
                    <DataRowStable
                      key={assetId}
                      assetId={assetId}
                      rowIndex={rowIndex}
                    />
                  ))}
                </TableBody>
              </Table>
            </DndContext>
          </TableKeyboardProvider>
        ) : (
          <div className="p-12 gap-2 mt-4 max-w-lg mx-auto flex flex-col items-center rounded-xl border border-border text-center">
            <div className="size-10 mb-2 flex items-center justify-center rounded-md bg-muted">
              <SearchSlash className="size-6" />
            </div>
            <div className="text-lg font-medium">Нет результатов</div>
            <div className="text-sm/relaxed text-muted-foreground">
              Попробуй изменить фильтры или поменять вид, чтобы увидеть больше
              результатов.
            </div>
          </div>
        )}
      </div>
    </TableFreezeProvider>
  );
}
