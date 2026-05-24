import {AssetInfoFull} from './asset';

/**
 * Compared to Meta, what is changed in assets
 */
export interface MetaDiffForSyncUp {
  isNeedAction: boolean;
  sourceDir: string;
  targetDir: string;
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
