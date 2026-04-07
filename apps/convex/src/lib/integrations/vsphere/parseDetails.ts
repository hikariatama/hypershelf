import { DOMParser } from "@xmldom/xmldom";

import type { XmlElement } from "./utils";
import {
  childrenByLocalName,
  elementsByLocalName,
  firstChildByLocalName,
  parseIsoToMillis,
  text,
} from "./utils";

export type VSphereDisk = { sizeGb: number; thin: boolean; datastore: string };
export type VSphereSnap = {
  name: string;
  description: string;
  createTime: number;
  withMemory: boolean;
};
export type VSphereDetails = {
  moid: string;
  hostname?: string;
  primaryIp?: string;
  ips?: string[];
  cpuCores: number;
  memoryMb: number;
  guestOs?: string;
  portgroup?: string;
  cluster: string;
  drives: VSphereDisk[];
  snaps?: VSphereSnap[];
};

function readMor(el: XmlElement | null): string {
  if (!el) return "";
  const mor = firstChildByLocalName(el, "ManagedObjectReference");
  return text(mor ?? el).trim();
}

export function parseVmDetailsFromPages(
  pages: readonly string[],
): VSphereDetails[] {
  const computeNames: Record<string, string> = {};
  const hostToCompute: Record<string, string> = {};
  const byVm: Record<string, VSphereDetails> = {};
  const hostRefByVm: Record<string, string> = {};

  for (const xml of pages) {
    const d = new DOMParser().parseFromString(xml, "text/xml");
    const objs = elementsByLocalName(d, "objects");
    for (const obj of objs) {
      const objEl = firstChildByLocalName(obj, "obj");
      if (!objEl) continue;
      const typeAttr = objEl.getAttribute("type") ?? "";
      const moid = text(objEl).trim();
      if (
        typeAttr === "ComputeResource" ||
        typeAttr === "ClusterComputeResource"
      ) {
        const ps = elementsByLocalName(obj, "propSet");
        for (const p of ps) {
          const n = firstChildByLocalName(p, "name");
          if (!n || text(n).trim() !== "name") continue;
          const v = firstChildByLocalName(p, "val");
          if (v) computeNames[moid] = text(v).trim();
        }
      } else if (typeAttr === "HostSystem") {
        const ps = childrenByLocalName(obj, "propSet");
        for (const p of ps) {
          const n = firstChildByLocalName(p, "name");
          if (!n || text(n).trim() !== "parent") continue;
          const v = firstChildByLocalName(p, "val");
          if (v) hostToCompute[moid] = text(v).trim();
        }
      } else if (typeAttr === "VirtualMachine") {
        const vmId = moid;
        byVm[vmId] ??= {
          moid: vmId,
          cpuCores: 0,
          memoryMb: 0,
          cluster: "",
          drives: [],
        };
        const acc = byVm[vmId];
        const snapshotsWithMemory = new Set<string>();
        const pendingSnaps: {
          mor: string;
          name: string;
          description: string;
          createTime: number;
        }[] = [];

        const ps = elementsByLocalName(obj, "propSet");
        for (const p of ps) {
          const nameEl = firstChildByLocalName(p, "name");
          if (!nameEl) continue;
          const pname = text(nameEl).trim();
          const valEl = firstChildByLocalName(p, "val");

          if (pname === "summary.guest.hostName")
            acc.hostname = valEl
              ? text(valEl).trim() || undefined
              : acc.hostname;
          else if (pname === "guest.ipAddress") {
            const ip = valEl ? text(valEl).trim() : "";
            if (ip) acc.primaryIp = ip;
          } else if (pname === "guest.net" && valEl) {
            const ips: string[] = acc.ips ? acc.ips.slice() : [];
            let chosen: string | undefined;
            const nics = elementsByLocalName(valEl, "GuestNicInfo");
            for (const nic of nics) {
              const connectedEl = firstChildByLocalName(nic, "connected");
              const connected = connectedEl
                ? text(connectedEl).trim() === "true"
                : false;
              const netEl = firstChildByLocalName(nic, "network");
              const net = netEl ? text(netEl).trim() : "";
              const ipCfgEl = firstChildByLocalName(nic, "ipConfig");
              if (ipCfgEl) {
                const ipAddrs = elementsByLocalName(ipCfgEl, "ipAddress");
                for (const ia of ipAddrs) {
                  const ipEl = firstChildByLocalName(ia, "ipAddress");
                  const ip = ipEl ? text(ipEl).trim() : "";
                  if (ip && !ips.includes(ip)) ips.push(ip);
                }
              }
              if (!chosen && connected && net.length > 0) chosen = net;
            }
            if (ips.length) acc.ips = ips;
            if (chosen) acc.portgroup = chosen;
          } else if (pname === "summary.config.numCpu") {
            acc.cpuCores = valEl
              ? parseInt(text(valEl).trim(), 10)
              : acc.cpuCores;
          } else if (pname === "config.hardware.memoryMB") {
            acc.memoryMb = valEl
              ? parseInt(text(valEl).trim(), 10)
              : acc.memoryMb;
          } else if (pname === "guest.guestFullName") {
            acc.guestOs = valEl ? text(valEl).trim() || undefined : acc.guestOs;
          } else if (pname === "config.hardware.device" && valEl) {
            const devs = elementsByLocalName(valEl, "VirtualDevice");
            for (const dev of devs) {
              const t = dev.getAttribute("xsi:type") ?? "";
              if (!t.startsWith("VirtualDisk")) continue;
              const byEl = firstChildByLocalName(dev, "capacityInBytes");
              const kbEl = firstChildByLocalName(dev, "capacityInKB");
              const bytes = byEl
                ? parseInt(text(byEl).trim(), 10)
                : kbEl
                  ? parseInt(text(kbEl).trim(), 10) * 1024
                  : 0;
              const sizeGb = bytes > 0 ? bytes / 1024 ** 3 : 0;
              const backing = firstChildByLocalName(dev, "backing");
              let thin = false;
              let datastore = "";
              if (backing) {
                const thinEl = firstChildByLocalName(
                  backing,
                  "thinProvisioned",
                );
                thin = thinEl ? text(thinEl).trim() === "true" : thin;
                const fileEl = firstChildByLocalName(backing, "fileName");
                if (fileEl) {
                  const fn = text(fileEl).trim();
                  const m = /^\[(.*?)\]/.exec(fn);
                  if (m?.[1]) datastore = m[1];
                }
              }
              acc.drives.push({ sizeGb, thin, datastore });
            }
          } else if (pname === "layoutEx" && valEl) {
            const layouts = childrenByLocalName(valEl, "snapshot");
            for (const layout of layouts) {
              const keyEl = firstChildByLocalName(layout, "key");
              const mor = keyEl ? text(keyEl).trim() : "";
              let hasMem = false;
              for (const el of childrenByLocalName(layout, "memoryFileKey")) {
                const n = parseInt(text(el).trim(), 10);
                if (Number.isFinite(n) && n >= 0) {
                  hasMem = true;
                  break;
                }
              }
              if (!hasMem) {
                for (const el of childrenByLocalName(layout, "memoryKey")) {
                  const n = parseInt(text(el).trim(), 10);
                  if (Number.isFinite(n) && n >= 0) {
                    hasMem = true;
                    break;
                  }
                }
              }
              if (mor && hasMem) snapshotsWithMemory.add(mor);
            }
          } else if (pname === "snapshot.rootSnapshotList" && valEl) {
            const stack = [
              ...childrenByLocalName(valEl, "VirtualMachineSnapshotTree"),
            ];
            while (stack.length) {
              const tree = stack.pop();
              if (!tree) continue;
              const morEl = firstChildByLocalName(tree, "snapshot");
              const nameEl = firstChildByLocalName(tree, "name");
              const descEl = firstChildByLocalName(tree, "description");
              const timeEl = firstChildByLocalName(tree, "createTime");

              const mor = morEl ? text(morEl).trim() : "";
              if (mor) {
                pendingSnaps.push({
                  mor,
                  name: nameEl ? text(nameEl).trim() : "",
                  description: descEl ? text(descEl).trim() : "",
                  createTime: parseIsoToMillis(
                    timeEl ? text(timeEl).trim() : "",
                  ),
                });
              }

              const childLists = childrenByLocalName(tree, "childSnapshotList");
              for (const cl of childLists) {
                const children = childrenByLocalName(
                  cl,
                  "VirtualMachineSnapshotTree",
                );
                for (const c of children) stack.push(c);
              }
            }
          } else if (pname === "runtime.host" && valEl) {
            const hostRef = readMor(valEl);
            if (hostRef) hostRefByVm[vmId] = hostRef;
          }
        }

        if (pendingSnaps.length) {
          acc.snaps = pendingSnaps.map((s) => ({
            name: s.name,
            description: s.description,
            createTime: s.createTime,
            withMemory: snapshotsWithMemory.has(s.mor),
          }));
        }
        if (!acc.primaryIp && acc.ips && acc.ips.length > 0)
          acc.primaryIp = acc.ips[0];
      }
    }
  }

  for (const [vmId, acc] of Object.entries(byVm)) {
    const hostRef = hostRefByVm[vmId];
    if (!hostRef) continue;
    const compRef = hostToCompute[hostRef];
    if (!compRef) continue;
    const name = computeNames[compRef];
    if (name) acc.cluster = name;
  }

  return Object.values(byVm);
}
