// export interface TestCase<ParamsType = any, ReturnType = any> {
//   params: ParamsType;
//   expected: ReturnType;
//   description?: string[];
// }
export type ExpectedAsFunc<FuncType extends (...param: any) => any> = (
  result: ReturnType<FuncType>
) => boolean;

export interface RunFuncOptions {
  /** Just run function without result comparison */
  dryRun?: boolean;
  /**
   * If just want to run one test case
   * Just set global ignore to true, and ignore of the case you want to run to false
   */
  ignore?: boolean;
}

export interface FuncTestCase<FuncType extends (...param: any) => any> extends RunFuncOptions {
  params: Parameters<FuncType>;
  expected: ReturnType<FuncType> | ExpectedAsFunc<FuncType>;
  description?: string[];
}

export interface InstanceTestCase<Cls extends {[key: string]: Function | any}, Key extends keyof Cls = any> {
  instance: Cls;
  params: Parameters<Cls[Key]>;
  expected: ReturnType<Cls[Key]>;
  description?: string[];
}
