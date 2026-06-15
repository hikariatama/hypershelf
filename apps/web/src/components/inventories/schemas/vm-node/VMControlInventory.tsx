"use client";

import type { IconName } from "lucide-react/dynamic";
import { useState } from "react";
import { PopoverPortal } from "@radix-ui/react-popover";
import { isEqual } from "lodash";
import { DynamicIcon } from "lucide-react/dynamic";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { ValueType } from "@hypershelf/convex/schema";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { FieldRenderer } from "@hypershelf/ui";
import { HypershelfIcon } from "@hypershelf/ui/icons";
import { IconButton } from "@hypershelf/ui/primitives/button";
import {
  Popover,
  PopoverContentNoPortal,
  PopoverTrigger,
} from "@hypershelf/ui/primitives/popover";

export function VMControlInventory({
  hostname,
  ip,
  reactFlowViewportRef,
}: {
  hostname: string;
  ip: string | undefined;
  reactFlowViewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [open, isOpen] = useState(false);
  const invNode = useStoreWithEqualityFn(
    useHypershelf,
    (state) => state.lookupAsset({ hostname, ip }),
    isEqual,
  );
  const fields = useStoreWithEqualityFn(
    useHypershelf,
    (state) =>
      Object.values(state.fields).map((f) => ({
        id: f.field._id,
        name: f.field.name,
        icon: f.field.extra?.icon ?? "circle",
      })),
    isEqual,
  );

  return (
    <Popover open={open} onOpenChange={isOpen}>
      <PopoverTrigger asChild>
        <div className="flex">
          <IconButton selected={open} onClick={() => null}>
            <HypershelfIcon className={cn("size-4", open && "text-brand")} />
          </IconButton>
        </div>
      </PopoverTrigger>
      <PopoverPortal container={reactFlowViewportRef.current} forceMount>
        <PopoverContentNoPortal className="max-w-xl min-w-64 pointer-events-auto w-fit select-auto">
          {invNode && (
            <div className="gap-1.5 text-xs flex w-full flex-col text-muted-foreground">
              {fields.map((field) => {
                if (!invNode.asset.metadata) return null;
                const value = invNode.asset.metadata[field.id] as ValueType;
                if (!value) return null;
                return (
                  <div key={field.id} className="leading-5">
                    <DynamicIcon
                      name={field.icon as IconName}
                      className="mr-1 inline-block size-4 align-[-3px]"
                    />
                    <span className="font-medium whitespace-pre">
                      {field.name}:
                    </span>{" "}
                    <FieldRenderer
                      assetId={invNode.asset._id}
                      fieldId={field.id}
                      readonly={true}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContentNoPortal>
      </PopoverPortal>
    </Popover>
  );
}
