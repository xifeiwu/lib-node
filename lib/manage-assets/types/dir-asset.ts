/**
 * Describe all asset info of dir in tree format
 */

import {AssetInfoFull} from '../types';

// export type AssetMeta = DirAssetMeta | AssetInfoFull;
export type AssetTree = {
  rootDir?: string;
  relativePath: string;
  children?: Array<AssetTree | AssetInfoFull>;
};
