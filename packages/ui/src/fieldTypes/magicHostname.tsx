import type { Ref } from "react";
import { useMutation } from "convex/react";
import { formatDistanceToNowStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { isEqual } from "lodash";
import { Clock } from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import { api } from "@hypershelf/convex/_generated/api";
import { matchesVsphereCacheKey } from "@hypershelf/convex/lib/vsphereCacheKey";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";

import type {
  FieldPropConfig,
  FieldRendererTableCellProps,
  TableCellEditorHandle,
} from "./_abstractType";
import VSphereIcon from "../icons/VSphereIcon";
import { Button } from "../primitives/button";
import {
  Tooltip,
  TooltipContentNoPortal,
  TooltipTrigger,
} from "../primitives/tooltip";
import { toast } from "../Toast";
import { InlineString } from "./_shared";

function InlineHostnameStatus({
  assetId,
  fieldId,
}: {
  assetId: Id<"assets">;
  fieldId: Id<"fields">;
}) {
  const vsphereStatus = useStoreWithEqualityFn(
    useHypershelf,
    (state) => {
      const asset = state.assets[assetId]?.asset;
      if (!asset) return { status: "not_found" };
      const magicIP = state.magicFields.magic__ip;
      const assetHostname = asset.metadata?.[fieldId] as string | null;
      const assetIp = (magicIP ? asset.metadata?.[magicIP] : null) as
        | string
        | null;
      const linkedVM = state.indexedVMs.find(
        (vm) =>
          vm.hostname === assetHostname ||
          (magicIP && assetIp && vm.ips?.includes(assetIp)),
      );
      if (!linkedVM) return { status: "not_found" };
      if (!assetHostname || !assetIp) return { status: "none" };
      if (!asset.vsphereLastSync) return { status: "not_synced" };
      if (
        !matchesVsphereCacheKey(asset.vsphereCacheKey, {
          hostname: assetHostname,
          ip: assetIp,
        })
      )
        return { status: "not_synced" };
      if (
        linkedVM.hostname === assetHostname &&
        linkedVM.ips?.includes(assetIp)
      )
        return { status: "matched" };
      return {
        status: "mismatched",
        vsphereHostname: linkedVM.hostname,
        vsphereIp: linkedVM.primaryIp,
        vsphereIps: linkedVM.ips,
        hostnameMatched: linkedVM.hostname === assetHostname,
        assetIp: assetIp,
      };
    },
    isEqual,
  );
  const vsphereLastSync = useHypershelf(
    (state) => state.assets[assetId]?.asset.vsphereLastSync,
  );
  const requestRefetch = useMutation(api.vsphere.requestRefetch);

  if (vsphereStatus.status === "none") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="top-1 right-1 absolute text-[10px] text-muted-foreground">
          {vsphereStatus.status === "matched" ? (
            <VSphereIcon className="size-4" colored={true} />
          ) : vsphereStatus.status === "mismatched" ? (
            <VSphereIcon className="size-4 text-red-500" />
          ) : vsphereStatus.status === "not_found" ? (
            <VSphereIcon className="size-4 text-yellow-500" />
          ) : (
            <Clock className="size-3 text-muted-foreground" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContentNoPortal
        className="px-3 py-2 z-[9999] rounded-md whitespace-pre"
        side="right"
      >
        <div>
          Последняя проверка:{" "}
          {vsphereLastSync
            ? formatDistanceToNowStrict(new Date(vsphereLastSync), {
                addSuffix: true,
                locale: ru,
              })
            : "никогда"}
        </div>
        <div>
          {vsphereStatus.status === "matched" ? (
            <span className="text-green-500">Данные совпадают со сферой</span>
          ) : vsphereStatus.status === "mismatched" ? (
            <span className="text-red-500">Данные не совпадают со сферой</span>
          ) : vsphereStatus.status === "not_found" ? (
            <span className="text-yellow-500">Не найден в сфере</span>
          ) : (
            "Ожидает перепроверки"
          )}
          {vsphereStatus.status === "mismatched" && (
            <div className="mt-1 pt-1 border-t border-border">
              <div className="font-bold">Информация со сферы</div>
              <div className="gap-1 flex items-center">
                <div className="font-semibold">Хостнейм:</div>
                <div
                  className={cn(
                    vsphereStatus.hostnameMatched
                      ? "text-green-500"
                      : "font-bold text-red-500",
                  )}
                >
                  {vsphereStatus.vsphereHostname}
                </div>
              </div>
              <div className="gap-1 flex items-center">
                <div className="font-semibold">Основной IP:</div>
                <div
                  className={cn(
                    vsphereStatus.vsphereIp === vsphereStatus.assetIp
                      ? "text-green-500"
                      : "font-bold text-red-500",
                  )}
                >
                  {vsphereStatus.vsphereIp ?? "Неизвестен"}
                </div>
              </div>
              <div className="gap-0.5 flex flex-col">
                <div className="font-semibold">Все IP:</div>
                <div className="gap-x-3 gap-y-1 pl-4 flex flex-wrap">
                  {vsphereStatus.vsphereIps &&
                  vsphereStatus.vsphereIps.length > 0 ? (
                    vsphereStatus.vsphereIps.map((ip) => (
                      <div
                        key={ip}
                        className={cn(
                          ip === vsphereStatus.assetIp
                            ? "text-green-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {ip}
                      </div>
                    ))
                  ) : (
                    <div>Неизвестны</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {vsphereStatus.status !== "not_synced" && (
            <div className="mt-2">
              <Button
                className="py-1 text-xs h-auto"
                size="sm"
                variant="outline"
                onClick={() => {
                  requestRefetch({ id: assetId }).catch((e) => {
                    console.error("Failed to request vsphere refetch", e);
                    toast.error("Не смогли запросить повторную проверку!");
                  });
                }}
              >
                Запросить повторную проверку
              </Button>
            </div>
          )}
        </div>
      </TooltipContentNoPortal>
    </Tooltip>
  );
}

function InlineHostname({
  assetId,
  editorRef,
  fieldId,
  readonly,
  tableCell,
}: {
  assetId: Id<"assets">;
  editorRef?: Ref<TableCellEditorHandle>;
  fieldId: Id<"fields">;
  readonly?: boolean;
  tableCell?: FieldRendererTableCellProps;
}) {
  if (readonly) {
    return (
      <InlineString
        assetId={assetId}
        editorRef={editorRef}
        fieldId={fieldId}
        maxRows={1}
        readonly={readonly}
        tableCell={tableCell}
      />
    );
  }

  return (
    <div className="px-2">
      <InlineHostnameStatus assetId={assetId} fieldId={fieldId} />
      <InlineString
        assetId={assetId}
        editorRef={editorRef}
        fieldId={fieldId}
        maxRows={1}
        readonly={readonly}
        tableCell={tableCell}
      />
    </div>
  );
}

const config = {
  cellClipboard: "enabled",
  key: "magic__hostname",
  label: "Хостнейм",
  icon: "globe",
  fieldProps: ["placeholder", "regex", "regexError"],
  magic: true,
  component: InlineHostname,
} as const satisfies FieldPropConfig;

export default config;
