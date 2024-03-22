import {DeepEqualConfig, UrlProps} from '../../external';

export interface RequestConfig<T = any> extends UrlProps {
  method: string;
  data: T;
}
export interface MockFileContent<ResData = any> {
  /** Ignore this mock file */
  ignore?: boolean;
  includeObjectKeys?: DeepEqualConfig['includeObjectKeys'];
  excludeObjectKeys?: DeepEqualConfig['excludeObjectKeys'];
  ignoreComparePayload?: boolean;
  requestConfig: RequestConfig;
  resData: ResData;
}
