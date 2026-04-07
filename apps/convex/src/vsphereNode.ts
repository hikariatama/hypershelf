"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type {
  FolderTree,
  NetworkTopology,
  VMTopology,
} from "./lib/integrations/vsphere";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { env } from "./lib/env";
import {
  fetchHost,
  fetchTopology,
  fetchTopologyStructure,
  fetchVmDetailsForRoot,
} from "./lib/integrations/vsphere";
import { getClient } from "./lib/redis";

const createBadRequestError = (message: string) => {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
};

export const fetchHostAction = internalAction({
  args: {
    id: v.optional(v.id("assets")),
  },
  handler: async (ctx, args) => {
    // ! IMPORTANT: If convex chokes on resources, it might call
    // ! cron jobs in parallel. Debounce calls, so that in such
    // ! a case we don't spam the vSphere API.
    await new Promise((r) => setTimeout(r, Math.random() * 14000 + 1000));

    const data = await ctx.runQuery(internal.vsphere.getVsphereData, args);
    if (!data) return;

    const redis = getClient(env.REDIS_URL, env.REDIS_PASSWORD);
    const { cacheKey, id, hostname, ip } = data;
    console.log(`Fetching vSphere data for ${hostname} (${ip})...`);

    const incoming = await fetchHost({ hostname, ip }, redis);
    await ctx.runMutation(internal.vsphere.markAsIndexed, {
      id,
      cache_key: cacheKey,
    });
    if (incoming.length === 0) {
      console.log(`No vSphere data found for ${hostname} (${ip})`);
      return;
    }
    const batchSize = 50;
    for (let i = 0; i < incoming.length; i += batchSize) {
      const batch = incoming.slice(i, i + batchSize);
      await ctx.runMutation(internal.vsphere.applyIndexing, {
        incoming: batch,
      });
    }
    console.log(`Applied vSphere data for asset ${id}`);
  },
});

export const indexVSphereAction = internalAction({
  handler: async (ctx) => {
    if (!env.VSPHERE_TOPOLOGY_ROOT_MOID_FOR_INDEXING) return -1;
    const redis = getClient(env.REDIS_URL, env.REDIS_PASSWORD);
    const incoming = await fetchVmDetailsForRoot(
      env.VSPHERE_TOPOLOGY_ROOT_MOID_FOR_INDEXING,
      redis,
    );
    const batchSize = 50;
    for (let i = 0; i < incoming.length; i += batchSize) {
      const batch = incoming.slice(i, i + batchSize);
      await ctx.runMutation(internal.vsphere.applyIndexing, {
        incoming: batch,
      });
    }
    return incoming.length;
  },
});

export const fetchTopologyAction = action({
  args: {
    rootMoid: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const userId = await getAuthUserId(_ctx);
    if (userId === null) {
      return null;
    }

    if (env.USE_MOCKS) {
      console.warn("Using mock data for vSphere topology");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const topology = (
        await import("./lib/integrations/vsphere/mocks/vsphere-topology.json")
      ).default;
      return {
        routers: topology.routers,
        vms: topology.vms,
        fetchTime: new Date().toISOString(),
        cached: false,
      };
    }

    const redis = getClient(env.REDIS_URL, env.REDIS_PASSWORD);
    const cacheKey = `topology:${args.rootMoid}`;

    if (!args.force) {
      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) {
        return {
          ...(JSON.parse(cachedRaw) as VMTopology),
          cached: true,
        };
      }
    }

    const topology = {
      ...(await fetchTopology(args.rootMoid, redis)),
      fetchTime: new Date().toISOString(),
    };
    await redis.set(cacheKey, JSON.stringify(topology), { EX: 3 * 60 });

    return {
      ...topology,
      cached: false,
    };
  },
});

export const fetchNetworkTopologyAction = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const redis = getClient(env.REDIS_URL, env.REDIS_PASSWORD);
    const networkTopologyRaw = await redis.get("network-topology");

    if (!networkTopologyRaw || env.USE_MOCKS) {
      console.warn("Using mock data for network topology");
      return (
        await import("./lib/integrations/vsphere/mocks/network-topology.json")
      ).default;
    }

    return JSON.parse(networkTopologyRaw) as NetworkTopology;
  },
});

export const uploadNetworkTopologyAction = action({
  args: {
    data: v.string(),
  },
  handler: async (_ctx, args) => {
    const userId = await getAuthUserId(_ctx);
    if (userId === null) {
      return null;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(args.data);
    } catch {
      throw createBadRequestError("Invalid JSON format");
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw createBadRequestError(
        "Invalid topology format: root must be an object.",
      );
    }

    const topology = parsed as NetworkTopology;

    if (!Array.isArray(topology.hosts)) {
      throw createBadRequestError(
        "Invalid topology format: 'hosts' property is missing or not an array.",
      );
    }

    const hosts = topology.hosts
      .map((host) => {
        if (typeof host !== "object") {
          return;
        }

        const typedHost = host;

        if (typeof typedHost.id !== "string") {
          return;
        }

        if (typeof typedHost.hostname !== "string") {
          return;
        }

        if (!Array.isArray(typedHost.neighbors)) {
          return;
        }

        for (const neighbor of typedHost.neighbors) {
          if (typeof neighbor !== "object") {
            return;
          }

          if (typeof neighbor.id !== "string") {
            return;
          }
        }

        return {
          id: typedHost.id,
          hostname: typedHost.hostname,
          neighbors: typedHost.neighbors.map((neighbor) => ({
            id: neighbor.id,
            attributes: neighbor.attributes
              ? neighbor.attributes.map((attribute) => String(attribute))
              : [],
          })),
        };
      })
      .filter((host): host is NonNullable<typeof host> => host !== undefined);

    const redis = getClient(env.REDIS_URL, env.REDIS_PASSWORD);
    await redis.set("network-topology", JSON.stringify({ hosts }));

    return { success: true };
  },
});

export const fetchTopologyStructureAction = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    if (env.USE_MOCKS) {
      console.warn("Using mock data for vSphere topology structure");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        structure: (
          await import("./lib/integrations/vsphere/mocks/vsphere-topology-structure.json")
        ).default,
        fetchTime: new Date().toISOString(),
      };
    }

    const rootMoid = env.VSPHERE_TOPOLOGY_ROOT_MOID;

    if (!rootMoid) {
      throw createBadRequestError("VSPHERE_TOPOLOGY_ROOT_MOID is not set");
    }

    const redis = getClient(env.REDIS_URL, env.REDIS_PASSWORD);
    const cacheKey = `topology-structure:${rootMoid}`;
    const cachedRaw = await redis.get(cacheKey);

    if (cachedRaw) {
      return JSON.parse(cachedRaw) as {
        structure: FolderTree;
        fetchTime: string;
      };
    }

    const topology = {
      structure: await fetchTopologyStructure(rootMoid, redis),
      fetchTime: new Date().toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(topology), { EX: 10 * 60 * 60 });

    return topology;
  },
});
