import {AssetInfoFull, GetDirAssetOptions} from './asset';
import {AssetMeta, AssetTree} from './dir-asset';

export interface CreateOrUpdateItemOptions {
  info: AssetInfoFull;
  prevInfo?: Partial<AssetInfoFull>;
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
  createItem: (info: AssetInfoFull) => Promise<AssetInfoFull>;
  createItems: (infoList: AssetInfoFull[]) => Promise<AssetInfoFull[]>;
  findItems: (assetInfo: Partial<AssetInfoFull>) => Promise<AssetInfoFull[]>;
  getItemList: (options?: {paranoid?: boolean}) => Promise<AssetInfoFull[]>;
  updateItem: (param: CreateOrUpdateItemOptions) => Promise<AssetInfoFull>;
  updateItems: (paramList: CreateOrUpdateItemOptions[]) => Promise<AssetInfoFull[]>;
  createOrUpdateItem: (param: CreateOrUpdateItemOptions) => Promise<AssetInfoFull>;
  createOrUpdateItems: (paramList: CreateOrUpdateItemOptions[]) => Promise<AssetInfoFull[]>;
  removeItem: (relativePath: string) => Promise<AssetInfoFull>;
  removeItems: (relativePath: string[]) => Promise<AssetInfoFull[]>;
}
export type GetMetaHandlers = (rootDir: string) => Promise<MetaHandlers>;
