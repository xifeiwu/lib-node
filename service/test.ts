import assert from 'assert';
import {ExpectedAsFunc, FuncTestCase, InstanceTestCase} from '../types';
import {logColorful} from '../log';
import {isFunction} from '../external';

/**
 * Run allCases for one func
 * @param func
 * @param allCases
 * @param dryRun
 */
export async function runFuncTestCases<FuncType extends (...param: any) => any>(
  func: FuncType,
  allCases: Array<FuncTestCase<FuncType>>,
  dryRun?: boolean
) {
  for (const oneCase of allCases) {
    const {description, params, expected} = oneCase;
    if (description && description.length > 0) {
      logColorful({color: 'yellow'}, 'Run the case', ...description);
    }
    // @ts-ignore
    const result = await func(...params);
    if (dryRun || oneCase.dryRun) {
      logColorful({}, result);
    } else {
      if (isFunction(expected)) {
        assert((expected as ExpectedAsFunc<FuncType>)(result));
      } else {
        assert.deepEqual(expected, result);
      }
    }
  }
}

/**
 * Run allCases for one function of Cls instance
 * @param funcName
 * @param allCases
 * @param dryRun
 */
// {}
export async function runInstanceTestCase<Cls extends {[key: string]: Function | any}, Key extends string>(
  funcName: Key,
  allCases: Array<InstanceTestCase<Cls, Key>>,
  dryRun?: boolean
) {
  for (const oneCase of allCases) {
    const {instance, params, expected} = oneCase;
    if (!isFunction(instance[funcName])) {
      throw new Error(`Is not a function: ${funcName}`);
    }
    const results = await instance[funcName](...params);
    if (dryRun) {
      logColorful({}, results);
    } else {
      assert.deepEqual(expected, results);
    }
  }
}
