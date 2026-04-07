import type { RuleGroupType } from "react-querybuilder";
import type { StateCreator } from "zustand";

import type { Id } from "@hypershelf/convex/_generated/dataModel";
import type {
  FolderTree,
  NetworkTopology,
  Router,
  VM,
  VMTopology,
} from "@hypershelf/convex/lib/integrations/vsphere";
import type {
  ExtendedAssetType,
  ExtendedFieldType,
  ExtendedViewType,
  IndexedVM,
} from "@hypershelf/convex/schema";

import type { Link } from "../types";

import "zustand/middleware/immer";

export type LockedFields = Record<Id<"assets">, Record<Id<"fields">, string>>;
export type AssetErrors = Record<Id<"assets">, Record<Id<"fields">, string>>;
export type AssetsDict = Record<Id<"assets">, ExtendedAssetType>;
export type FieldsDict = Record<Id<"fields">, ExtendedFieldType>;
export type UsersDict = Record<Id<"users">, string>;
export type SortingDict = Record<Id<"fields">, "asc" | "desc">;
export type ViewsDict = Record<Id<"views">, ExtendedViewType>;
export type AssetsLocker = {
  acquire: (assetId: Id<"assets">, fieldId: Id<"fields">) => Promise<boolean>;
  release: (assetId: Id<"assets">, fieldId: Id<"fields">) => Promise<void>;
};
export type FieldsLocker = {
  acquire: (fieldId: Id<"fields">) => Promise<boolean>;
  release: (fieldId: Id<"fields">) => Promise<void>;
};

export type State = {
  assetIds: Id<"assets">[];
  assets: AssetsDict;
  assetErrors: AssetErrors;
  loadingAssets: boolean;
  createdAssets: Id<"assets">[];

  fieldIds: Id<"fields">[];
  fields: FieldsDict;
  lockedFields: LockedFields;
  expandedFieldId: Id<"fields"> | null;
  loadingFields: boolean;
  magicFields: Record<string, Id<"fields">>;

  hiding: boolean;
  sorting: SortingDict;
  filters: RuleGroupType | null;
  isFiltering: boolean;
  hiddenFields: Id<"fields">[];
  frozenFields: Id<"fields">[];
  fieldOrder: Id<"fields">[];
  search: string;
  searchResults: Id<"assets">[];
  indexedVMs: IndexedVM[];
  searchResultsVSphere: IndexedVM[];

  views: ViewsDict;
  activeViewId: Id<"views"> | null;

  users: UsersDict;
  viewer: Id<"users"> | null | undefined;
  assetsLocker: AssetsLocker;
  fieldsLocker: FieldsLocker;

  links: Link[];
  routers: Router[];
  vms: VM[];
  selectedVmNodesNetworkTopologyView: Record<string, boolean>;
  topologyFetchTime: string | null;
  folderTree: FolderTree;
  folderTreeLoaded: boolean;
  rootMoid: string | null;
  highlightLink: Link | null;
};

export type TableSlice = {
  setSorting: (sorting: SortingDict) => void;
  toggleSorting: (fieldId: Id<"fields">) => void;
  toggleVisibility: (fieldId: Id<"fields">) => void;
  toggleFrozen: (fieldId: Id<"fields">) => void;
  toggleHiding: () => void;
  reorderField: (from: Id<"fields">, to: Id<"fields">) => void;
  setFilters: (filters: RuleGroupType | null) => void;
  setIsFiltering: (isFiltering: boolean) => void;
  resetFilters: () => void;
  setSearch: (search: string) => void;
  setIndexedVMs: (vms: IndexedVM[]) => void;
};

export type AssetsSlice = {
  setAssets: (assets: AssetsDict) => void;
  revalidateLocks: () => void;
  setAssetsLocker: (locker: AssetsLocker) => void;
  lookupAsset: (args: {
    hostname?: string;
    ip?: string;
  }) => ExtendedAssetType | undefined;
  markCreatedAsset: (assetId: Id<"assets">) => void;
};

export type FieldsSlice = {
  setFields: (fields: FieldsDict) => void;
  revalidateErrors: () => void;
  setExpandedFieldId: (fieldId: Id<"fields"> | null) => void;
  setFieldsLocker: (locker: FieldsLocker) => void;
};

export type ViewsSlice = {
  setViews: (views: ViewsDict) => void;
  applyView: (viewId: Id<"views"> | "builtin:all") => void;
  setActiveViewId: (activeView: Id<"views"> | null) => boolean;
};

export type UsersSlice = {
  setUsers: (users: UsersDict) => void;
};

export type SharedSlice = {
  setViewer: (viewer: Id<"users"> | null | undefined) => void;
  init: () => void;
};

export type SchemasSlice = {
  updateTopology: (topology: VMTopology) => void;
  updateNetworkTopology: (network: NetworkTopology) => void;
  toggleVmNodeNetworkTopologyView: (vmId: string, state?: boolean) => void;
  setFolderTree: (tree: FolderTree) => void;
  setFolderTreeLoaded: (loaded: boolean) => void;
  setRootMoid: (rootMoid: string) => void;
  setHighlightLink: (link: Link | null) => void;
};

export type Actions = TableSlice &
  AssetsSlice &
  FieldsSlice &
  ViewsSlice &
  UsersSlice &
  SharedSlice &
  SchemasSlice;

export type ImmerStateCreator<T> = StateCreator<
  Actions & State,
  [["zustand/immer", never]],
  [],
  T
>;

export const magicFieldKeys = ["magic__hostname", "magic__ip"] as const;
export type MagicFieldTypes = (typeof magicFieldKeys)[number];
