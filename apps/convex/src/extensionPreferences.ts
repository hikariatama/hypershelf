import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const get = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { hiddenFields: [], fieldOrder: [] };
    }

    const preferences = await ctx.db
      .query("extensionPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return {
      hiddenFields: preferences?.hiddenFields ?? [],
      fieldOrder: preferences?.fieldOrder ?? [],
    };
  },
});

export const update = mutation({
  args: {
    hiddenFields: v.array(v.id("fields")),
    fieldOrder: v.array(v.id("fields")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    const preferences = await ctx.db
      .query("extensionPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const next = {
      hiddenFields: args.hiddenFields,
      fieldOrder: args.fieldOrder,
    };

    if (preferences) {
      await ctx.db.patch(preferences._id, next);
      return preferences._id;
    }

    return ctx.db.insert("extensionPreferences", {
      userId,
      ...next,
    });
  },
});
