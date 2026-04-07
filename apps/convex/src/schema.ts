import type { FunctionReturnType } from "convex/server";
import type { Infer } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import type { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

export const fieldSchema = {
  name: v.string(),
  type: v.string(),
  required: v.boolean(),
  hidden: v.optional(v.boolean()),
  extra: v.optional(
    v.object({
      description: v.optional(v.string()),
      placeholder: v.optional(v.string()),
      singleLine: v.optional(v.boolean()),
      mdPreset: v.optional(v.string()),
      regex: v.optional(v.string()),
      regexError: v.optional(v.string()),
      minLength: v.optional(v.number()),
      maxLength: v.optional(v.number()),
      minItems: v.optional(v.number()),
      maxItems: v.optional(v.number()),
      minValue: v.optional(v.number()),
      maxValue: v.optional(v.number()),
      icon: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      multiselect: v.optional(v.boolean()),
      hideFromSearch: v.optional(v.boolean()),
      subnet: v.optional(v.string()),
      listObjectType: v.optional(v.string()),
      listObjectExtra: v.optional(
        v.object({
          singleLine: v.optional(v.boolean()),
          regex: v.optional(v.string()),
          regexError: v.optional(v.string()),
          minLength: v.optional(v.number()),
          maxLength: v.optional(v.number()),
          minItems: v.optional(v.number()),
          maxItems: v.optional(v.number()),
          minValue: v.optional(v.number()),
          maxValue: v.optional(v.number()),
        }),
      ),
    }),
  ),
};

const fieldSchemaInternal = {
  ...fieldSchema,
  slug: v.string(),
  editingBy: v.optional(v.id("users")),
  editingLockExpires: v.optional(v.number()),
  deleted: v.optional(v.boolean()),
  /** @deprecated */
  editing: v.optional(v.any()),
  /** @deprecated */
  persistent: v.optional(v.any()),
};

export const valueSchema = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.array(v.string()),
  v.null(),
);

export const assetSchema = {
  metadata: v.optional(v.record(v.id("fields"), valueSchema)),
};

const assetSchemaInternal = {
  ...assetSchema,
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  vsphereCacheKey: v.optional(v.string()),
  vsphereLastSync: v.optional(v.number()),
  deleted: v.optional(v.boolean()),
  /** @deprecated */
  mutex: v.optional(v.any()),
  /** @deprecated */
  mutexHolderId: v.optional(v.any()),
  /** @deprecated */
  mutexExpiresAt: v.optional(v.any()),
  /** @deprecated */
  editing: v.optional(v.any()),
  /** @deprecated */
  editingBy: v.optional(v.any()),
  /** @deprecated */
  editingLockExpires: v.optional(v.any()),
  /** @deprecated */
  vsphereMoid: v.optional(v.any()),
  /** @deprecated */
  vsphereMetadata: v.optional(v.any()),
};

export const vSphereSchema = {
  moid: v.string(),
  hostname: v.optional(v.string()),
  primaryIp: v.optional(v.string()),
  ips: v.optional(v.array(v.string())),
  cpuCores: v.number(),
  memoryMb: v.number(),
  guestOs: v.optional(v.string()),
  portgroup: v.optional(v.string()),
  cluster: v.string(),
  drives: v.array(
    v.object({
      sizeGb: v.number(),
      thin: v.boolean(),
      datastore: v.string(),
    }),
  ),
  snaps: v.optional(
    v.array(
      v.object({
        name: v.string(),
        description: v.string(),
        createTime: v.number(),
        withMemory: v.boolean(),
      }),
    ),
  ),
};

const vSphereSchemaInternal = {
  ...vSphereSchema,
  lastSync: v.number(),
};

const assetLocks = {
  assetId: v.id("assets"),
  fieldId: v.id("fields"),
  userId: v.id("users"),
  expires: v.number(),
};

export const fileSchema = {
  storageId: v.string(),
  fileName: v.string(),
};

export const viewSchema = {
  name: v.optional(v.string()),
  hiddenFields: v.optional(v.array(v.id("fields"))),
  frozenFields: v.optional(v.array(v.id("fields"))),
  fieldOrder: v.optional(v.array(v.id("fields"))),
  sorting: v.optional(
    v.record(v.id("fields"), v.union(v.literal("asc"), v.literal("desc"))),
  ),
  filters: v.optional(v.any()),
  enableFiltering: v.optional(v.boolean()),
  global: v.optional(v.boolean()),
  builtin: v.optional(v.boolean()),
};

export const viewSchemaInternal = {
  ...viewSchema,
  userId: v.id("users"),
  /** @deprecated Use `hiddenFields` and `fieldOrder instead */
  fields: v.optional(v.any()),
  /** @deprecated Use `sorting` instead */
  sortBy: v.optional(v.any()),
};

export const waybackSchema = {
  actor: v.id("users"),
  when: v.number(),
  action: v.union(
    v.object({
      type: v.literal("create_asset"),
      assetId: v.id("assets"),
    }),
    v.object({
      type: v.literal("update_asset"),
      assetId: v.id("assets"),
      fieldId: v.id("fields"),
      oldValue: valueSchema,
      newValue: valueSchema,
    }),
    v.object({
      type: v.literal("delete_asset"),
      assetId: v.id("assets"),
    }),
    v.object({
      type: v.literal("restore_asset"),
      assetId: v.id("assets"),
    }),
    v.object({
      type: v.literal("create_field"),
      fieldId: v.id("fields"),
    }),
    v.object({
      type: v.literal("update_field"),
      fieldId: v.id("fields"),
      oldProps: v.object(fieldSchema),
      newProps: v.object(fieldSchema),
    }),
    v.object({
      type: v.literal("delete_field"),
      fieldId: v.id("fields"),
    }),
    v.object({
      type: v.literal("restore_field"),
      fieldId: v.id("fields"),
    }),
  ),
};

export default defineSchema({
  ...authTables,
  assets: defineTable(assetSchemaInternal),
  assetLocks: defineTable(assetLocks).index("by_assetId_fieldId", [
    "assetId",
    "fieldId",
  ]),
  fields: defineTable(fieldSchemaInternal),
  files: defineTable(fileSchema),
  views: defineTable(viewSchemaInternal),
  system: defineTable({ version: v.string() }),
  wayback: defineTable(waybackSchema)
    .index("by_assetId", ["action.assetId"])
    .index("by_fieldId", ["action.fieldId"])
    .index("by_action_type", ["action.type"])
    .index("by_userId", ["actor"]),
  vsphere: defineTable(vSphereSchemaInternal)
    .index("by_hostname", ["hostname"])
    .index("by_ip", ["primaryIp"])
    .index("by_ips", ["ips"]),
});

export type AssetType = Doc<"assets">;
export type AssetLocksType = Doc<"assetLocks">;
export type FieldType = Doc<"fields">;
export type UserType = Doc<"users">;
export type ViewType = Doc<"views">;
export type IndexedVM = Doc<"vsphere">;
export type ExtendedViewType = ViewType & {
  immutable: boolean;
  global: boolean;
};
export type ValueType = Infer<typeof valueSchema>;

export type ExtendedFieldType = FunctionReturnType<
  typeof api.fields.get
>["fields"][number];
export type ExtendedAssetType = FunctionReturnType<
  typeof api.assets.get
>["assets"][number];
