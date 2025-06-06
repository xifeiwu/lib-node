import {PartialExcept} from '../external';
import {AssetInfoFull, GetDirAssetOptions} from './asset';

type AssetInfoGetFromCopy = PartialExcept<Partial<AssetInfoFull>, 'sha1' | 'shortId' | 'relativePath'>;
export interface CopyAction {
  from: {
    rootDir: string;
    asset: AssetInfoFull;
  };
  to: {
    rootDir: string;
    asset: AssetInfoGetFromCopy;
  };
}

export interface ActionToAssetsAndMeta {
  copyFiles?: Array<CopyAction>;
  moveFiles?: Array<CopyAction>;
  deleteFiles?: Array<AssetInfoFull>;
}

export interface MetaHandlers {
  rootDir: string;
  getKey: () => string;
  getMetaLocation: () => string;
  haveMeta: () => boolean;
  resetMeta: (options?: GetDirAssetOptions) => Promise<AssetInfoFull[]>;
  cleanUpMeta: () => Promise<boolean>;
  insertOrUpdateItem: (assetInfo: AssetInfoFull) => Promise<AssetInfoFull>;
  findItems: (assetInfo: Partial<AssetInfoFull>) => Promise<AssetInfoFull[]>;
  removeItem: (relativePath: string) => Promise<AssetInfoFull>;
  getAllItems: (options?: {paranoid?: boolean}) => Promise<AssetInfoFull[]>;
  saveState: () => Promise<AssetInfoFull[]>;
  snapshot?: () => Promise<string | false>;
}
export type GetMetaHandlers = (
  rootDir: string,
  options?: {initMetaIfNotExist?: boolean}
) => Promise<MetaHandlers>;

export interface DoSyncUpAssetActionOptions {
  notChangeAsset?: boolean;
  // dir prefix for new assets copied from other dir
  dirPrefix4NewFile?: string;
  // should be full path
  dir4DeletedFile?: string;
  logging?: boolean;
  // back up current meta before doing action
  snapShotMetaBeforeAction?: boolean;
}
