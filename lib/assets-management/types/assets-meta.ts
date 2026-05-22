import {AssetInfoFull, AssetInfoPartial} from './asset';

/**
 * Compared to Meta, what is changed in assets
 */
export interface MetaDiffForSyncUp {
  isNeedAction: boolean;
  toDir: string;
  fromDir: string;
  // forOperation: ForOperation;
  added?: AssetInfoFull[];
  copied?: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[];
  moved?: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[];
  modified?: {
    from: AssetInfoFull;
    to: AssetInfoFull;
    changed?: Partial<AssetInfoFull>;
  }[];
  deleted?: AssetInfoFull[];
}

/**
 * Diff for importing new assets into an existing meta (sha1-based: added vs duplicated).
 */
export interface MetaDiffForImportNew {
  fromDir: string;
  isNeedAction: boolean;
  toDir: string;
  newFiles?: AssetInfoFull[];
  duplicatedFiles?: Record<
    string,
    {
      origin: AssetInfoFull[];
      by: AssetInfoFull[];
    }
  >;
}

// export interface Actions {
//   toAdd: AssetInfoFull[];
//   toDelete: AssetInfoFull[];
//   toModify: {
//     from: AssetInfoFull;
//     to: AssetInfoFull;
//     changed: Partial<AssetInfoFull>;
//   }[];
//   isNeedAction: boolean;
// }

/**
 * @deprecated by getAssetStateChange
 */
export interface AssetStateChangeInfo {
  assetInfoListMeta: AssetInfoFull[];
  latestAssetInfoList: AssetInfoPartial[];
  stateChange: MetaDiffForSyncUp;
}
