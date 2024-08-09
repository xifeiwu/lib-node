// export interface TestCase<ParamsType = any, ReturnType = any> {
//   params: ParamsType;
//   expected: ReturnType;
//   description?: string[];
// }

export interface FuncTestCase<FuncType extends (...param: any) => any> {
  params: Parameters<FuncType>;
  expected: ReturnType<FuncType>;
  description?: string[];
}
