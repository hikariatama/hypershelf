"use client";

import type { Edge, Position } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  useReactFlow,
} from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";

import type { RFNodeInternal } from "@hypershelf/lib/types";
import { useHypershelf } from "@hypershelf/lib/stores";
import { cn } from "@hypershelf/lib/utils";

import { getEdgeParams } from "~/lib/utils/flow";

export function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  data,
}: Edge<Record<string, unknown>>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const translucent = useHypershelf(
    (state) =>
      !state.selectedVmNodesNetworkTopologyView[source] &&
      !state.selectedVmNodesNetworkTopologyView[target],
  );
  const dimmed = useHypershelf(
    (state) =>
      state.highlightLink &&
      (state.highlightLink.from !== source ||
        state.highlightLink.to !== target),
  );
  const highlighted = useHypershelf(
    (state) =>
      state.highlightLink?.from === source && state.highlightLink.to === target,
  );
  const setHighlightLink = useHypershelf((state) => state.setHighlightLink);
  const [labelX, setLabelX] = useState(0);
  const [labelY, setLabelY] = useState(0);
  const hitboxRef = useRef<SVGPathElement | null>(null);

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode as RFNodeInternal,
    targetNode as RFNodeInternal,
  ) as {
    sx: number;
    sy: number;
    tx: number;
    ty: number;
    sourcePos: Position;
    targetPos: Position;
  };

  const [edgePath, flowLabelX, flowLabelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  const baseStroke = useMemo(() => {
    const sw = style?.strokeWidth;
    return Number.isFinite(sw) ? Number(sw) : 1;
  }, [style]);

  const reactFlowViewportRef = useRef<HTMLDivElement | null>(null);

  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const viewport = document.querySelector(".react-flow__viewport");
    if (viewport && !reactFlowViewportRef.current) {
      reactFlowViewportRef.current = viewport as HTMLDivElement;
    }
    return () => {
      reactFlowViewportRef.current = null;
    };
  }, []);

  const setOpen = useCallback(
    (open: boolean) => {
      setHighlightLink(
        open
          ? {
              from: source,
              to: target,
              label: data?.label as string | string[],
            }
          : null,
      );
    },
    [setHighlightLink, source, target, data],
  );

  if (!sourceNode || !targetNode) return null;

  const hasLabel =
    (Array.isArray(data?.label) && data.label.length > 0) ||
    (data?.label as string | undefined);

  return (
    <>
      <path
        id={id}
        className={cn(
          "react-flow__edge-path transition-opacity duration-200",
          dimmed && "opacity-40",
          translucent && "opacity-0",
        )}
        d={edgePath}
        markerEnd={markerEnd as string}
        style={{ ...style, pointerEvents: "none" }}
      />
      {hasLabel && !translucent && (
        <PopoverPrimitive.Root open={highlighted} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <path
              ref={hitboxRef}
              d={edgePath}
              fill="none"
              stroke="transparent"
              className="cursor-pointer"
              style={{ strokeDasharray: "0" }}
              pointerEvents="stroke"
              strokeWidth={baseStroke + 4}
              onClick={(e) => {
                if (!highlighted) {
                  const { x, y } = screenToFlowPosition({
                    x: e.clientX,
                    y: e.clientY,
                  });
                  setLabelX(x);
                  setLabelY(y);
                }
                setOpen(!highlighted);
              }}
            />
          </PopoverPrimitive.Trigger>
          <EdgeLabelRenderer>
            <div className="absolute z-50 [&>[data-radix-popper-content-wrapper]]:!transform-none">
              <PopoverPrimitive.Content
                side="bottom"
                align="center"
                className="-translate-x-1 absolute size-fit translate-y-[calc(-100%+0.25rem)]"
                style={{
                  left: labelX || flowLabelX,
                  top: labelY || flowLabelY,
                }}
                forceMount={true}
              >
                <AnimatePresence>
                  {highlighted && (
                    <>
                      <svg
                        viewBox="0 0 43.71 43.71"
                        className="bottom-0 left-0 w-10 absolute"
                      >
                        <motion.circle
                          cx="5"
                          cy="38.71"
                          r="4"
                          fill="none"
                          stroke="#f55"
                          strokeMiterlimit="10"
                          strokeWidth="2"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.16 }}
                          exit={{ pathLength: 0 }}
                        />
                        <motion.line
                          x1="7.83"
                          y1="35.88"
                          x2="43"
                          y2=".71"
                          fill="none"
                          stroke="#f55"
                          strokeMiterlimit="10"
                          strokeWidth="2"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.16 }}
                          exit={{ pathLength: 0 }}
                        />
                      </svg>
                      <motion.div
                        className="min-w-16 -translate-x-1 translate-y-1 p-1.5 backdrop-blur-lg relative rounded-md bg-background/60"
                        initial={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                        animate={{
                          x: "2.5rem",
                          y: "-2.5rem",
                          scale: 1,
                          opacity: 1,
                        }}
                        exit={{ x: 0, y: 0, scale: 0.2, opacity: 0 }}
                        transition={{
                          type: "spring",
                          duration: 0.3,
                          bounce: 0.3,
                        }}
                      >
                        {Array.isArray(data?.label) ? (
                          data.label.map((l, i) => (
                            <div key={i} className="text-xs">
                              {l}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs">{data?.label as string}</div>
                        )}
                        <svg className="inset-0 pointer-events-none absolute h-full w-full">
                          <motion.rect
                            x="1"
                            y="1"
                            width="calc(100% - 2px)"
                            height="calc(100% - 2px)"
                            rx="4"
                            ry="4"
                            fill="none"
                            stroke="#f55"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.16 }}
                            exit={{ pathLength: 0 }}
                          />
                        </svg>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </PopoverPrimitive.Content>
            </div>
          </EdgeLabelRenderer>
        </PopoverPrimitive.Root>
      )}
    </>
  );
}
