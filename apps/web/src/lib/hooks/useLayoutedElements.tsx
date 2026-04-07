import { useEffect, useRef } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";

import type { RFNode } from "@hypershelf/lib/types";

export const useLayoutedElements = (setNodes: (nodes: RFNode[]) => void) => {
  const nodesInitialized = useNodesInitialized();
  const { getNodes, fitView, getViewport, setViewport } =
    useReactFlow<RFNode>();
  const isLayingOut = useRef(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!nodesInitialized) return;
    if (isLayingOut.current) return;

    isLayingOut.current = true;

    const rfNodes = getNodes();
    const groupNodes = rfNodes.filter((n) => n.type === "vmGroup");
    const vmNodes = rfNodes.filter((n) => n.type === "vm");

    const groupMargin = 16;
    const vmMargin = 8;
    const maxVMsPerRow = 3;
    const headerH = 22;

    groupNodes.forEach((group) => {
      const childVMs = vmNodes.filter((vm) => vm.parentId === group.id);
      let vmX = vmMargin;
      let vmY = vmMargin * 2 + headerH;
      let vmsInCurrentRow = 0;
      let maxRowWidth = 0;
      let fullHeight = 0;
      let maxHCurrentRow = 0;

      childVMs.forEach((vm) => {
        const vmWidth = vm.measured?.width ?? 100;
        const vmHeight = vm.measured?.height ?? 100;
        if (vmsInCurrentRow >= maxVMsPerRow) {
          vmsInCurrentRow = 0;
          vmX = vmMargin;
          vmY += maxHCurrentRow + vmMargin;
          fullHeight += maxHCurrentRow + vmMargin;
          maxHCurrentRow = 0;
        }
        vm.position = { x: vmX, y: vmY };
        vmX += vmWidth + vmMargin;
        vmsInCurrentRow++;
        maxRowWidth = Math.max(maxRowWidth, vmX);
        maxHCurrentRow = Math.max(maxHCurrentRow, vmHeight);
      });

      group.width = Math.max(group.measured?.width ?? 0, maxRowWidth);
      group.height = fullHeight + maxHCurrentRow + vmMargin * 3 + headerH;
    });

    const W = Math.max(320, window.innerWidth);
    const H = Math.max(240, window.innerHeight);
    const groupsSorted = groupNodes
      .slice()
      .sort(
        (a, b) =>
          (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0),
      );

    const largestW = Math.max(
      ...groupsSorted.map((g) => Math.ceil(g.width ?? 200)),
    );
    const totalArea = groupsSorted.reduce((acc, g) => {
      const w = Math.ceil((g.width ?? 200) + groupMargin);
      const h = Math.ceil((g.height ?? 150) + groupMargin);
      return acc + w * h;
    }, 0);

    const candidates = new Set<number>();
    candidates.add(Math.max(largestW + groupMargin, W));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 0.8)));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 0.9)));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 1.1)));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 1.2)));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 1.4)));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 0.6)));
    candidates.add(Math.max(largestW + groupMargin, Math.floor(W * 1.6)));
    const areaDriven = Math.max(
      largestW + groupMargin,
      Math.floor(totalArea / H),
    );
    candidates.add(areaDriven);

    for (let i = 6; i <= 14; i++) {
      const c = Math.max(largestW + groupMargin, Math.floor((i / 10) * W));
      candidates.add(c);
    }

    const pack = (availableWidth: number) => {
      let segments: { x: number; y: number; w: number }[] = [
        { x: 0, y: 0, w: availableWidth },
      ];
      const merge = () => {
        const out: typeof segments = [];
        for (const s of segments) {
          const last = out[out.length - 1];
          if (last?.y === s.y && last.x + last.w === s.x) last.w += s.w;
          else out.push({ ...s });
        }
        segments = out;
      };
      const firstFit = (w: number) => {
        let best = { i: -1, x: 0, y: Number.POSITIVE_INFINITY };
        for (let i = 0; i < segments.length; i++) {
          let widthLeft = w;
          const x = segments[i]?.x ?? 0;
          let y = segments[i]?.y ?? 0;
          let j = i;
          while (widthLeft > 0 && j < segments.length) {
            y = Math.max(y, segments[j]?.y ?? 0);
            widthLeft -= segments[j]?.w ?? 0;
            j++;
          }
          if (widthLeft <= 0) {
            if (y < best.y || (y === best.y && x < best.x)) best = { i, x, y };
          }
        }
        return best.i >= 0 ? best : null;
      };
      const place = (w: number, h: number) => {
        const fit = firstFit(w + groupMargin);
        if (!fit) {
          const y = Math.max(...segments.map((s) => s.y));
          segments = [{ x: 0, y, w: availableWidth }];
          return place(w, h);
        }
        let widthToCover = w + groupMargin;
        const i = fit.i;
        const newY = fit.y + h + groupMargin;
        const idx = i;
        while (widthToCover > 0 && idx < segments.length) {
          const seg = segments[idx];
          if (widthToCover >= (seg?.w ?? 0)) {
            widthToCover -= seg?.w ?? 0;
            segments.splice(idx, 1);
          } else if (seg) {
            seg.x += widthToCover;
            seg.w -= widthToCover;
            widthToCover = 0;
          }
        }
        segments.splice(i, 0, { x: fit.x, y: newY, w: w + groupMargin });
        segments.sort((a, b) => a.x - b.x || a.y - b.y);
        merge();
        return { x: fit.x, y: fit.y };
      };
      const positions = new Map<string, { x: number; y: number }>();
      for (const group of groupsSorted) {
        const w = Math.ceil(group.width ?? 200);
        const h = Math.ceil(group.height ?? 150);
        const p = place(w, h);
        positions.set(group.id, p);
      }
      let maxX = 0;
      let maxY = 0;
      for (const g of groupsSorted) {
        const p = positions.get(g.id);
        maxX = Math.max(maxX, (p?.x ?? 0) + Math.ceil(g.width ?? 200));
        maxY = Math.max(maxY, (p?.y ?? 0) + Math.ceil(g.height ?? 150));
      }
      return { positions, width: Math.ceil(maxX), height: Math.ceil(maxY) };
    };

    let best = {
      width: Number.MAX_SAFE_INTEGER,
      height: Number.MAX_SAFE_INTEGER,
      positions: new Map<string, { x: number; y: number }>(),
      score: Number.POSITIVE_INFINITY,
      candidate: 0,
    };
    for (const avail of Array.from(candidates).sort((a, b) => a - b)) {
      const res = pack(avail);
      const score = Math.abs(res.width - W) / W + Math.abs(res.height - H) / H;
      if (
        score < best.score ||
        (score === best.score &&
          Math.abs(res.width - W) < Math.abs(best.width - W))
      ) {
        best = {
          width: res.width,
          height: res.height,
          positions: res.positions,
          score,
          candidate: avail,
        };
      }
    }

    for (const g of groupNodes) {
      const p = best.positions.get(g.id);
      if (p) g.position = p;
    }

    setNodes([...groupNodes, ...vmNodes]);

    const zoom = Math.min(
      window.innerWidth / (best.width + 16 + groupMargin),
      window.innerHeight / (best.height + 56 + groupMargin),
      1,
    );

    isLayingOut.current = false;
    if (!isInitialized.current) {
      void fitView({ padding: 8, minZoom: zoom, maxZoom: zoom }).then(() => {
        const viewport = getViewport();
        void setViewport(
          { x: viewport.x + 8, y: viewport.y + 16, zoom },
          { duration: 0 },
        );
      });
    }
    isInitialized.current = true;
  }, [nodesInitialized, getNodes, setNodes, fitView, getViewport, setViewport]);
};
