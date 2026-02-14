/**
 * Describe all asset info of dir in tree format
 */

import {AssetInfoFull} from '.';

// export type AssetMeta = DirAssetMeta | AssetInfoFull;
export type AssetTree = {
  /** only root AssetTree has rootDir */
  rootDir?: string;
  relativePath: string;
  children?: Array<AssetTree | AssetInfoFull>;
};
