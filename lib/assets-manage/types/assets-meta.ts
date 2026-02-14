import {AssetInfoFull, AssetInfoPartial} from './asset';

export type ForOperation = 'syncUp' | 'importNew';
/**
 * Compared to Meta, what is changed in assets
 */
export interface MetaDiff {
  isNeedAction: boolean;
  toDir: string;
  fromDir: string;
  forOperation: ForOperation;
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
    changed: Partial<AssetInfoFull>;
  }[];
  deleted?: AssetInfoFull[];
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
  stateChange: MetaDiff;
}
