import {AssetInfoFull, GetDirAssetOptions} from './asset';
import {AssetTree} from './dir-asset';

export interface CreateOrUpdateItemOptions {
  info: AssetInfoFull;
  prevInfo?: Partial<AssetInfoFull>;
}
export interface MetaHandlers {
  rootDir: string;
  getKey: () => string;
  getMetaLocation: () => string;
  /** get existingmeta */
  getMeta: () => void;
  resetMeta: (options?: GetDirAssetOptions) => Promise<AssetTree>;
  cleanUpMeta: () => Promise<boolean>;
  // insertOrUpdateItem: (assetInfo: AssetInfoFull) => Promise<AssetInfoFull>;
  createOrUpdateItem: (item: CreateOrUpdateItemOptions) => Promise<AssetInfoFull>;
  createOrUpdateItems: (items: CreateOrUpdateItemOptions[]) => Promise<AssetInfoFull[]>;
  createItem: (info: AssetInfoFull) => Promise<AssetInfoFull>;
  createItems: (infoList: AssetInfoFull[]) => Promise<AssetInfoFull[]>;
  updateItem: (item: CreateOrUpdateItemOptions) => Promise<AssetInfoFull>;
  updateItems: (items: CreateOrUpdateItemOptions[]) => Promise<AssetInfoFull[]>;

  findItems: (assetInfo: Partial<AssetInfoFull>) => Promise<AssetInfoFull[]>;
  removeItem: (relativePath: string) => Promise<AssetInfoFull>;
  removeItems: (relativePath: string[]) => Promise<AssetInfoFull[]>;
  getAllItems: (options?: {paranoid?: boolean}) => Promise<AssetInfoFull[]>;
  // saveState: () => Promise<AssetInfoFull[]>;
  snapshot?: () => Promise<string | false>;
}
export type GetMetaHandlers = (rootDir: string, options?: GetDirAssetOptions) => Promise<MetaHandlers>;
