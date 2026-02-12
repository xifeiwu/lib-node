import path from 'path';
import {getFilePathInfo, FilePathSegement} from '../external';
import {SHORT_ID_LENGTH, REG_SHORT_ID} from './constant';

interface FilePathParseResult extends FilePathSegement {
  matched?: string;
  shortId?: string;
  bareBasenameWithoutShortId?: string;
}

function getShortIdSuffix(shortId: string) {
  return '[' + shortId + ']';
}

export function parseFilePath(filePath: string): FilePathParseResult {
  const info = getFilePathInfo(filePath);
  const {bareBasename} = info;
  const execResult = REG_SHORT_ID.exec(bareBasename);
  if (execResult) {
    const [matched, shortId] = execResult;
    return {
      ...info,
      matched,
      shortId,
      bareBasenameWithoutShortId: bareBasename.slice(0, matched.length * -1),
    };
  }
  return info;
}

export function appendShortIdToFilePath(filePath: string, newShortId: string) {
  if (newShortId?.length !== SHORT_ID_LENGTH) {
    throw new Error(`length of shortId should be ${SHORT_ID_LENGTH}`);
  }
  const {dirname, bareBasename, extname, shortId, bareBasenameWithoutShortId} = parseFilePath(filePath);
  if (!shortId) {
    return path.join(dirname, bareBasename + getShortIdSuffix(newShortId) + extname);
  }
  return path.join(dirname, bareBasenameWithoutShortId + getShortIdSuffix(newShortId) + extname);
}

/**
 * Return the same value if short id not exist
 * @param filePath
 * @returns
 */
export function removeShortIdInFilePath(filePath: string) {
  const {dirname, extname, shortId, bareBasenameWithoutShortId} = parseFilePath(filePath);
  if (!shortId) {
    return filePath;
  }
  return path.join(dirname, bareBasenameWithoutShortId + extname);
}
