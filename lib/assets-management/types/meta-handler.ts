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
  /**
   * handle meta operations
   * call sequence: getMeta -> initMeta -> resetMeta
   */
  /** get meta of its assets, the meta data may be outdated */
  getMeta: (options?: GetDirAssetOptions) => Promise<AssetMeta>;
  /** read exsiting meta file, if not exist, scan the directory to create a new meta */
  initMeta: (options?: GetDirAssetOptions) => Promise<void>;
  /** reset meta to the latest status of its assets */
  resetMeta: (options?: GetDirAssetOptions) => Promise<AssetMeta>;
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
