/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as extensionPreferences from "../extensionPreferences.js";
import type * as fields from "../fields.js";
import type * as files from "../files.js";
import type * as general from "../general.js";
import type * as http from "../http.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_integrations_vsphere_SoapClient from "../lib/integrations/vsphere/SoapClient.js";
import type * as lib_integrations_vsphere_consts from "../lib/integrations/vsphere/consts.js";
import type * as lib_integrations_vsphere_index from "../lib/integrations/vsphere/index.js";
import type * as lib_integrations_vsphere_parseDetails from "../lib/integrations/vsphere/parseDetails.js";
import type * as lib_integrations_vsphere_parseFolders from "../lib/integrations/vsphere/parseFolders.js";
import type * as lib_integrations_vsphere_parseInventory from "../lib/integrations/vsphere/parseInventory.js";
import type * as lib_integrations_vsphere_types from "../lib/integrations/vsphere/types.js";
import type * as lib_integrations_vsphere_utils from "../lib/integrations/vsphere/utils.js";
import type * as lib_redis_index from "../lib/redis/index.js";
import type * as lib_vsphereCacheKey from "../lib/vsphereCacheKey.js";
import type * as locks from "../locks.js";
import type * as migrations from "../migrations.js";
import type * as system from "../system.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as views from "../views.js";
import type * as vsphere from "../vsphere.js";
import type * as vsphereNode from "../vsphereNode.js";
import type * as wayback from "../wayback.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assets: typeof assets;
  auth: typeof auth;
  crons: typeof crons;
  extensionPreferences: typeof extensionPreferences;
  fields: typeof fields;
  files: typeof files;
  general: typeof general;
  http: typeof http;
  "lib/env": typeof lib_env;
  "lib/integrations/vsphere/SoapClient": typeof lib_integrations_vsphere_SoapClient;
  "lib/integrations/vsphere/consts": typeof lib_integrations_vsphere_consts;
  "lib/integrations/vsphere/index": typeof lib_integrations_vsphere_index;
  "lib/integrations/vsphere/parseDetails": typeof lib_integrations_vsphere_parseDetails;
  "lib/integrations/vsphere/parseFolders": typeof lib_integrations_vsphere_parseFolders;
  "lib/integrations/vsphere/parseInventory": typeof lib_integrations_vsphere_parseInventory;
  "lib/integrations/vsphere/types": typeof lib_integrations_vsphere_types;
  "lib/integrations/vsphere/utils": typeof lib_integrations_vsphere_utils;
  "lib/redis/index": typeof lib_redis_index;
  "lib/vsphereCacheKey": typeof lib_vsphereCacheKey;
  locks: typeof locks;
  migrations: typeof migrations;
  system: typeof system;
  users: typeof users;
  utils: typeof utils;
  views: typeof views;
  vsphere: typeof vsphere;
  vsphereNode: typeof vsphereNode;
  wayback: typeof wayback;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
};
