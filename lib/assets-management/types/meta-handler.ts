import {AssetInfoFull, GetDirAssetOptions} from './asset';
import {AssetListMeta} from './dir-asset';

export interface CreateOrUpdateItemOptions {
  info: AssetInfoFull;
  prevInfo?: Partial<AssetInfoFull>;
}

export interface GetMetaOptions extends GetDirAssetOptions {
  reset?: boolean;
  resetIfNotExist?: boolean;
}

export interface MetaHandlers {
  rootDir: string;
  getKey: () => string;
  getMeta: (options?: GetMetaOptions) => Promise<AssetListMeta>;
  cleanUpMeta: () => Promise<boolean>;
  /**
   * handle items of asset meta, should persistent meta after each operation
   */
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
