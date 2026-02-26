import {AssetInfoFull, GetDirAssetOptions} from './asset';
import {AssetMeta, AssetTree} from './dir-asset';

export interface CreateOrUpdateItemOptions {
  info: AssetInfoFull;
  prevInfo?: Partial<AssetInfoFull>;
}

interface Options {
  persistent?: boolean;
}

export interface MetaHandlers {
  rootDir: string;
  getKey: () => string;
  getMetaLocation: () => string;
  /** get existing meta */
  getMeta: (options?: GetDirAssetOptions) => Promise<AssetMeta>;
  resetMeta: (options?: GetDirAssetOptions) => Promise<AssetMeta>;
  cleanUpMeta: () => Promise<boolean>;
  createItem: (info: AssetInfoFull) => Promise<AssetInfoFull>;
  createItems: (infoList: AssetInfoFull[]) => Promise<AssetInfoFull[]>;
  findItems: (assetInfo: Partial<AssetInfoFull>) => Promise<AssetInfoFull[]>;
  getAllItems: (options?: {paranoid?: boolean}) => Promise<AssetInfoFull[]>;
  updateItem: (item: CreateOrUpdateItemOptions) => Promise<AssetInfoFull>;
  updateItems: (items: CreateOrUpdateItemOptions[]) => Promise<AssetInfoFull[]>;
  createOrUpdateItem: (item: CreateOrUpdateItemOptions) => Promise<AssetInfoFull>;
  createOrUpdateItems: (items: CreateOrUpdateItemOptions[]) => Promise<AssetInfoFull[]>;
  removeItem: (relativePath: string) => Promise<AssetInfoFull>;
  removeItems: (relativePath: string[]) => Promise<AssetInfoFull[]>;
  snapshot?: () => Promise<string | false>;
}
export type GetMetaHandlers = (rootDir: string) => Promise<MetaHandlers>;
