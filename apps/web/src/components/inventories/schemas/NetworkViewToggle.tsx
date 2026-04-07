import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { isEqual } from "lodash";
import { Loader2, Network, UploadCloud } from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";

import { api } from "@hypershelf/convex/_generated/api";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";
import { IconButton } from "@hypershelf/ui/primitives/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@hypershelf/ui/primitives/popover";
import { toast } from "@hypershelf/ui/toast";

function JsonUploader({ onUploaded }: { onUploaded: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const uploadNetworkTopologyAction = useAction(
    api.vsphereNode.uploadNetworkTopologyAction,
  );
  const uploadNetworkTopology = useMutation({
    mutationFn: uploadNetworkTopologyAction,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (file?.type === "application/json") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result;
          if (typeof content === "string") {
            setIsLoading(true);
            uploadNetworkTopology.mutate(
              { data: content },
              {
                onSuccess: () => {
                  onUploaded();
                },
                onError: () => {
                  console.error("Failed to upload network topology");
                  toast.error("Не смогли загрузить топологию сети!");
                },
                onSettled: () => {
                  setIsLoading(false);
                },
              },
            );
          }
        };
        reader.readAsText(file);
      } else if (file) {
        console.error("Invalid file type. Please upload a JSON file.");
      }
    },
    [uploadNetworkTopology, onUploaded],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile],
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      className={cn(
        "group p-4 relative flex cursor-pointer flex-col items-center justify-center rounded-lg transition-colors",
        isDragging ? "bg-muted text-primary" : "text-border",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      whileHover={{ y: -1 }}
      whileTap={{ y: 1 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.2 }}
    >
      <svg
        className="inset-0 pointer-events-none absolute h-full w-full rounded-lg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2"
          y="2"
          width="calc(100% - 4px)"
          height="calc(100% - 4px)"
          rx="12"
          ry="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="8 8"
          className="group-hover:animate-dash"
        />
      </svg>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {isLoading ? (
        <Loader2 className="mb-2 size-8 animate-spin text-muted-foreground" />
      ) : (
        <UploadCloud className="mb-2 size-8 text-muted-foreground" />
      )}
      <p className="text-sm text-center text-muted-foreground">
        Drop JSON file here or click to upload
      </p>
    </motion.div>
  );
}

export function NetworkViewToggle() {
  const toggleVmNodeNetworkTopologyView = useHypershelf(
    (state) => state.toggleVmNodeNetworkTopologyView,
  );
  const vmIds = useStoreWithEqualityFn(
    useHypershelf,
    (state) => state.vms.map((v) => v.id),
    isEqual,
  );
  const linksAvailable = useHypershelf((state) => state.links.length > 0);
  const rootMoidSelected = useHypershelf((state) => !!state.rootMoid);
  const networkView = useHypershelf(
    (state) =>
      Object.keys(state.selectedVmNodesNetworkTopologyView).length > 0 &&
      state.links.length > 0,
  );

  const [isPopoverOpen, setPopoverOpen] = useState(false);

  const queryClient = useQueryClient();

  const handleClick = useCallback(() => {
    if (!linksAvailable) return;
    vmIds.forEach((id) => toggleVmNodeNetworkTopologyView(id, !networkView));
  }, [vmIds, toggleVmNodeNetworkTopologyView, networkView, linksAvailable]);

  const onUploaded = useCallback(() => {
    void queryClient.refetchQueries({
      queryKey: ["vsphere-network-topology"],
    });
    vmIds.forEach((id) => toggleVmNodeNetworkTopologyView(id, true));
    setPopoverOpen(false);
  }, [vmIds, toggleVmNodeNetworkTopologyView, queryClient]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPopoverOpen(true);
  }, []);

  if (!rootMoidSelected) {
    return null;
  }

  return (
    <div className="flex">
      <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverAnchor asChild>
          <IconButton
            selected={networkView}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            {...(!linksAvailable && { whileTap: {} })}
          >
            <Network
              className={cn(
                "size-4",
                networkView && "text-[#55f]",
                !linksAvailable && "text-muted-foreground",
              )}
            />
          </IconButton>
        </PopoverAnchor>
        <PopoverContent className="w-60">
          <JsonUploader onUploaded={onUploaded} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
