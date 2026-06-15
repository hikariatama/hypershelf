import type { IconName } from "lucide-react/dynamic";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { DynamicIcon } from "lucide-react/dynamic";

import { api } from "@hypershelf/convex/_generated/api";
import { FieldRenderer } from "@hypershelf/ui";

const Inner = ({ hostname }: { hostname: string | null }) => {
  const fields = useQuery(api.fields.get, {});
  const assets = useQuery(api.assets.get, {});
  const extensionPreferences = useQuery(api.extensionPreferences.get);
  const asset = useMemo(() => {
    if (!fields || !assets) return null;
    const hostField = fields.fields.find(
      (f) => f.field.type === "magic__hostname",
    );
    if (!hostField) return null;
    const fid = hostField.field._id;
    const row = assets.assets.find((a) => a.asset.metadata?.[fid] === hostname);
    return row ?? null;
  }, [fields, assets, hostname]);

  const notFound = useMemo(() => {
    if (!fields || !assets || !hostname) return false;
    const hostField = fields.fields.find(
      (f) => f.field.type === "magic__hostname",
    );
    if (!hostField) return false;
    const fid = hostField.field._id;
    if (assets.assets.length === 0) return false;
    const row = assets.assets.find((a) => a.asset.metadata?.[fid] === hostname);
    return row === undefined;
  }, [fields, assets, hostname]);
  const visibleFields = useMemo(() => {
    if (!fields) return [];
    const hiddenFields = new Set(extensionPreferences?.hiddenFields ?? []);
    const positions = new Map(
      (extensionPreferences?.fieldOrder ?? []).map(
        (fieldId, index) => [fieldId, index] as const,
      ),
    );

    return fields.fields
      .filter(({ field }) => !field.hidden && !hiddenFields.has(field._id))
      .sort((left, right) => {
        const leftPosition = positions.get(left.field._id);
        const rightPosition = positions.get(right.field._id);

        if (leftPosition == null && rightPosition == null) return 0;
        if (leftPosition == null) return 1;
        if (rightPosition == null) return -1;

        return leftPosition - rightPosition;
      });
  }, [fields, extensionPreferences]);

  if (notFound) {
    return (
      <div className="px-4 flex h-full w-full flex-col items-center justify-center text-center">
        <div className="text-4xl font-bold relative font-title text-foreground">
          404
          <div className="bottom-0 left-0 right-0 h-1 w-5 absolute mx-auto overflow-hidden">
            <div className="h-full w-full bg-brand" />
          </div>
        </div>
        <div className="mt-2 text-sm font-medium text-muted-foreground">
          Этого хоста нет в Hypershelf.
        </div>
      </div>
    );
  }

  if (!fields || !asset) {
    return (
      <div className="group text-3xl font-extrabold relative font-title text-foreground select-none">
        Hypershelf
        <div className="bottom-0 left-0 h-1 w-9 absolute overflow-hidden">
          <div className="h-full w-full animate-brand-load bg-brand" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <div className="gap-1 text-xs no-scrollbar p-2 flex h-full w-full flex-col overflow-scroll">
        {visibleFields.map(({ field }) => {
          if (!asset.asset.metadata) return null;
          return (
            <div
              key={field._id}
              className="px-2 py-1 text-sm rounded-md border border-border text-foreground leading-5"
            >
              <DynamicIcon
                name={(field.extra?.icon ?? "circle") as IconName}
                className="mr-1 inline-block size-3.5 align-[-2px] text-muted-foreground"
              />
              <span className="font-medium text-muted-foreground">
                {field.name}:
              </span>{" "}
              <FieldRenderer
                assetId={asset.asset._id}
                fieldId={field._id}
                readonly={true}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BlockWidget = ({ hostname }: { hostname: string | null }) => {
  return (
    <div className="h-38 mb-3 flex items-center justify-center rounded-md border-2 border-brand bg-background font-sans">
      <Inner hostname={hostname} />
    </div>
  );
};
