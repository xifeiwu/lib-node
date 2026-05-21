import {AssetInfoFull, GetDirAssetOptions} from './asset';
import {AssetListMeta} from './dir-asset';

export interface CreateOrUpdateItemOptions {
  info: AssetInfoFull;
  prevInfo?: Partial<AssetInfoFull>;
}

/**
 * after get meta handler, we assume the meta is already been read by metaHandler
 */
export interface GetMetaHandlersOptions {
  /** regenerate meta to override the existing one */
  reset?: boolean;
  /** skip confirmation prompt (e.g. after CLI already confirmed) */
  runDirectly?: boolean;

  initMetaOptions?: GetDirAssetOptions;
}

export interface MetaHandlers {
  rootDir: string;
  getKey: () => string;
  getMeta: (options?: GetDirAssetOptions) => Promise<AssetListMeta>;
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
