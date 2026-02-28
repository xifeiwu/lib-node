import path from 'path';

export const DIR_ASSET_MANAGE_TMP_DIR = path.resolve(process.env.HOME, '.asset-manage-tmp');

export const DT_FORMAT = 'yyyy-MM-ddThh-mm-ss';

export const SHORT_ID_LENGTH = 6;

/** + is a tmp char, used for compatible */
export const REG_SHORT_ID = /\[([+A-Za-z0-9_-]{6,6})\]$/;
