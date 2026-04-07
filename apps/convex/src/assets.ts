import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalQuery, mutation, query } from "./_generated/server";
import { valueSchema } from "./schema";
import { validateField } from "./utils";

export const get = query({
  args: {
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { includeDeleted }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { assets: [] };
    }

    const assets = await ctx.db
      .query("assets")
      .order("asc")
      .filter((q) =>
        q.or(q.neq(q.field("deleted"), true), q.eq(includeDeleted, true)),
      )
      .collect();
    const locks = await Promise.all(
      assets.map((asset) =>
        ctx.db
          .query("assetLocks")
          .filter((q) => q.eq(q.field("assetId"), asset._id))
          .collect(),
      ),
    );
    const editors = await Promise.all(
      assets.map(async (asset, i) => {
        const assetLocks = locks[i];
        return await Promise.all(
          assetLocks?.map(async (lock) => {
            const user = await ctx.db.get(lock.userId);
            return {
              fieldId: lock.fieldId,
              holder: user
                ? { id: user._id, email: user.email }
                : { id: lock.userId, email: "Unknown User" },
              expires: lock.expires,
            };
          }) ?? [],
        );
      }),
    );

    return {
      assets: assets.map((asset, i) => ({
        asset,
        locks: editors[i],
      })),
    };
  },
});

export const create = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        errors: { _: "Not authenticated" },
        _logs: ["Failed to create asset: not authenticated"],
      };
    }

    const asset = {
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const assetId = await ctx.db.insert("assets", asset);
    await ctx.db.insert("wayback", {
      actor: userId,
      when: Date.now(),
      action: { type: "create_asset", assetId },
    });
    return {
      success: true,
      assetId,
      _logs: ["Asset created successfully"],
    };
  },
});

export const update = mutation({
  args: {
    assetId: v.id("assets"),
    fieldId: v.id("fields"),
    value: valueSchema,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        errors: { _: "Not authenticated" },
        _logs: ["Failed to update asset: not authenticated"],
      };
    }
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.deleted) {
      return {
        success: false,
        errors: { _: "Asset not found" },
        _logs: ["Failed to update asset: asset not found"],
      };
    }
    const existingLock = await ctx.db
      .query("assetLocks")
      .withIndex("by_assetId_fieldId", (q) =>
        q.eq("assetId", args.assetId).eq("fieldId", args.fieldId),
      )
      .unique();
    if (
      existingLock &&
      existingLock.userId !== userId &&
      existingLock.expires > Date.now()
    ) {
      return {
        success: false,
        errors: { _: "This property is being edited by someone else" },
        _logs: [
          "Failed to update asset: this property is being edited by someone else",
        ],
      };
    }
    const metadata = asset.metadata ?? {};
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      throw new Error(`Field with ID ${args.fieldId} not found`);
    }

    const error = validateField(field, args.value);
    if (error !== null) {
      return { success: false, error };
    }

    await ctx.db.insert("wayback", {
      actor: userId,
      when: Date.now(),
      action: {
        type: "update_asset",
        assetId: args.assetId,
        fieldId: args.fieldId,
        oldValue: metadata[args.fieldId] ?? null,
        newValue: args.value,
      },
    });

    metadata[args.fieldId] = args.value;

    await ctx.db.patch(args.assetId, {
      metadata,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      _logs: ["Asset updated successfully"],
    };
  },
});

export const remove = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to delete asset: not authenticated"],
      };
    }

    const asset = await ctx.db.get(id);
    if (!asset || asset.deleted) {
      return {
        success: false,
        error: "Asset not found",
        _logs: ["Failed to delete asset: asset not found"],
      };
    }

    await ctx.db.patch(id, { deleted: true });
    await ctx.db.insert("wayback", {
      actor: userId,
      when: Date.now(),
      action: { type: "delete_asset", assetId: id },
    });
    return { success: true, _logs: ["Asset deleted successfully"] };
  },
});

export const restore = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to restore asset: not authenticated"],
      };
    }

    const asset = await ctx.db.get(id);
    if (!asset) {
      return {
        success: false,
        error: "Asset not found",
        _logs: ["Failed to restore asset: asset not found"],
      };
    }
    if (!asset.deleted) {
      return {
        success: false,
        error: "Asset is not deleted",
        _logs: ["Failed to restore asset: asset is not deleted"],
      };
    }

    await ctx.db.patch(id, { deleted: false });
    await ctx.db.insert("wayback", {
      actor: userId,
      when: Date.now(),
      action: { type: "restore_asset", assetId: id },
    });
    return { success: true, _logs: ["Asset restored successfully"] };
  },
});

export const getMarkdown = internalQuery({
  args: { assetId: v.id("assets"), fieldId: v.id("fields") },
  handler: async (ctx, { assetId, fieldId }) => {
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.deleted) {
      return { content: null };
    }
    const field = await ctx.db.get(fieldId);
    if (field?.type !== "markdown") {
      return { content: null };
    }
    const value = asset.metadata?.[fieldId];
    if (typeof value !== "string") {
      return { content: null };
    }
    return { content: value };
  },
});
