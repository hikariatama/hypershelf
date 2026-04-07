import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { ExtendedViewType } from "./schema";
import { mutation, query } from "./_generated/server";
import { viewSchema } from "./schema";

export const get = query({
  args: {
    ignoreImmutable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        views: [],
      };
    }

    const views = await ctx.db
      .query("views")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    const globalViews = await ctx.db
      .query("views")
      .filter((q) => q.eq(q.field("global"), true))
      .filter((q) => q.neq(q.field("userId"), userId))
      .collect();

    return {
      views: [...views, ...globalViews]
        .map((v) => ({
          ...v,
          immutable: v.userId !== userId && v.global,
        }))
        .filter((v) => {
          if (!args.ignoreImmutable) return true;
          return !v.immutable;
        }) as ExtendedViewType[],
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    hiddenFields: v.optional(v.array(v.id("fields"))),
    frozenFields: v.optional(v.array(v.id("fields"))),
    fieldOrder: v.optional(v.array(v.id("fields"))),
    sorting: v.optional(
      v.record(v.id("fields"), v.union(v.literal("asc"), v.literal("desc"))),
    ),
    filters: v.optional(v.any()),
    enableFiltering: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    const view = await ctx.db.insert("views", {
      userId,
      name: args.name,
      hiddenFields: args.hiddenFields ?? [],
      frozenFields: args.frozenFields ?? [],
      fieldOrder: args.fieldOrder ?? [],
      sorting: args.sorting ?? {},
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      filters: args.filters ?? null,
      enableFiltering: args.enableFiltering ?? false,
      global: false,
      builtin: false,
    });

    return view;
  },
});

export const update = mutation({
  args: {
    viewId: v.id("views"),
    ...viewSchema,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { viewId, name, global, builtin, ...other } = args;
    const view = await ctx.db.get(viewId);
    if (view === null) {
      throw new Error("View not found");
    }

    if (view.userId !== userId) {
      throw new Error("You can only update your own views");
    }

    await ctx.db.patch(args.viewId, {
      ...other,
      ...(name && { name: name }),
    });

    return view;
  },
});

export const remove = mutation({
  args: {
    viewId: v.id("views"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    const view = await ctx.db.get(args.viewId);
    if (view === null) {
      throw new Error("View not found");
    }

    if (view.userId !== userId) {
      throw new Error("You can only delete your own views");
    }

    await ctx.db.delete(args.viewId);

    return view;
  },
});

export const makeGlobal = mutation({
  args: {
    viewId: v.id("views"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    const view = await ctx.db.get(args.viewId);
    if (view === null) {
      throw new Error("View not found");
    }

    if (view.global) {
      throw new Error("View is already global");
    }

    if (view.userId !== userId) {
      throw new Error("You can only make your own views global");
    }

    await ctx.db.patch(args.viewId, { global: true });

    return view;
  },
});
