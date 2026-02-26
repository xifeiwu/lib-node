import {AssetInfoFull, GetDirAssetOptions} from './asset';
import {AssetMeta, AssetTree} from './dir-asset';

export interface CreateOrUpdateItemOptions {
  info: AssetInfoFull;
  prevInfo?: Partial<AssetInfoFull>;
}

export interface MoreOptions {
  archive?: boolean;
}

export interface MetaHandlers {
  rootDir: string;
  getKey: () => string;
  // getMetaLocation: () => string;
  /** handle meta operations */
  resetMeta: (options?: GetDirAssetOptions) => Promise<AssetMeta>;
  initMeta: (options?: GetDirAssetOptions) => Promise<void>;
  getMeta: (options?: GetDirAssetOptions) => Promise<AssetMeta>;
  cleanUpMeta: () => Promise<boolean>;
  /** handle items of asset meta */
  createItem: (info: AssetInfoFull, options?: MoreOptions) => Promise<AssetInfoFull>;
  createItems: (infoList: AssetInfoFull[], options?: MoreOptions) => Promise<AssetInfoFull[]>;
  findItems: (assetInfo: Partial<AssetInfoFull>) => Promise<AssetInfoFull[]>;
  getItemList: (options?: {paranoid?: boolean}) => Promise<AssetInfoFull[]>;
  updateItem: (param: CreateOrUpdateItemOptions, options?: MoreOptions) => Promise<AssetInfoFull>;
  updateItems: (paramList: CreateOrUpdateItemOptions[], options?: MoreOptions) => Promise<AssetInfoFull[]>;
  createOrUpdateItem: (param: CreateOrUpdateItemOptions, options?: MoreOptions) => Promise<AssetInfoFull>;
  createOrUpdateItems: (
    paramList: CreateOrUpdateItemOptions[],
    options?: MoreOptions
  ) => Promise<AssetInfoFull[]>;
  removeItem: (relativePath: string, options?: MoreOptions) => Promise<AssetInfoFull>;
  removeItems: (relativePath: string[], options?: MoreOptions) => Promise<AssetInfoFull[]>;
  archiveMeta: () => void;
}
export type GetMetaHandlers = (rootDir: string) => Promise<MetaHandlers>;
