import {AssetInfoFull, GetDirAssetOptions} from './asset';

export interface CopyAction {
  from: {
    rootDir: string;
    asset: AssetInfoFull;
  };
  to: {
    rootDir: string;
    relativePath: string;
  };
}

export interface ActionToAssetsAndMeta {
  copyFiles?: Array<CopyAction>;
  moveFiles?: Array<CopyAction>;
  deleteFiles?: Array<AssetInfoFull>;
}

export interface ActionOptions {
  logging?: boolean;
  needConfirm?: boolean;
}

export interface DoSyncUpAssetActionOptions extends ActionOptions {
  // It's useful when sync up meta with assets: just upadte meta with assets change
  notChangeAsset?: boolean;
  // dir prefix for new assets copied from other dir
  dirPrefix4NewFile?: string;
  // should be full path
  dir4DeletedFile?: string;
  // back up current meta before doing action
  snapShotMetaBeforeAction?: boolean;
}
