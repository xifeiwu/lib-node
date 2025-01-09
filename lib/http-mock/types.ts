import http from 'http';
import {DeepEqualConfig, FilterItem, NormalizedUrlProps} from '../../external';
import {GetFileListInfo, GetFileListOption} from '../../types';

/**
 * The request options must follow NormalizedUrlProps interface for compare
 */
export interface RequestOptionsForMock<T = any> extends NormalizedUrlProps {
  method?: string;
  data?: T;
}

export interface GenerateMockFileOptions {
  /** request config for all requestConfig under requestConfigDir */
  defaultRequestOptions?: RequestOptionsForMock;
  /** fullpath have high priority than outputDir + getBasename*/
  fullPath?: string;
  outputDir?: string;
  getBasename?: (requestOptions: RequestOptionsForMock) => string;
  /** content of mock item passed directly from request config file to mock file */
  moreMockItems?: Partial<Omit<MockFileContent, 'requestOptions'>>;
  // getBaseName
}

export interface GenerateMockFileFromDirOptions extends Omit<GenerateMockFileOptions, 'requestOptions'> {
  // targetDir: string;
  targetDirList: Array<GetFileListInfo>;
}

interface CompareConfig {
  ignore?: boolean;
  includeObjectKeys?: DeepEqualConfig['includeObjectKeys'];
  excludeObjectKeys?: DeepEqualConfig['excludeObjectKeys'];
}
export interface MockFileContent<ResData = any> {
  /** Ignore this mock file or not */
  requestOptions: RequestOptionsForMock;
  resHeaders: http.IncomingHttpHeaders;
  resData: ResData;
  ignore?: boolean;
  queryCompare?: CompareConfig;
  payloadCompare?: CompareConfig;
}

export interface FindMockInfoInDirOptions {
  ingore?: boolean;
  targetDir: string;
  /** relative path */
  includedFileList?: FilterItem[];
  excludedFileList?: FilterItem[];
  debugCompare?: boolean;
  getFileListOptions?: GetFileListOption;
}

export type MockFileFinder = (
  targetRequestConfig: RequestOptionsForMock
) => MockFileContent & {relativePath?: string};
