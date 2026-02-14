import {AssetInfoFull, AssetInfoPartial} from './asset';

/**
 * Compared to Meta, what is changed in assets
 */
export interface MetaAssetsDiff {
  added: AssetInfoFull[];
  copied: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[];
  moved: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[];
  modified: {
    from: AssetInfoFull;
    to: AssetInfoFull;
    changed: Partial<AssetInfoFull>;
  }[];
  deleted: AssetInfoFull[];
  isNeedAction: boolean;
}

/**
 * @deprecated by getAssetStateChange
 */
export interface AssetStateChangeInfo {
  assetInfoListMeta: AssetInfoFull[];
  latestAssetInfoList: AssetInfoPartial[];
  stateChange: MetaAssetsDiff;
}
