/**
 * Run exported function from another .ts or .js file
 */
import fs from 'fs';
import path from 'path';
import {logColorful} from '../../../log';
import {goOnOrNot, selectOption} from '../../../readline';
import {isNumber, isAsyncFunction, isObject, isFunction} from '../../../external';
import {rerequire} from '../../../service';
import {RunTargetScriptOptions, GetTargetScriptFuncNameOptions} from '../../../types';

const RUN_ALL_EXPORTED_FUNCTIONS = '_all';

async function getFuncNameToRun(funcNameList: string[], options?: GetTargetScriptFuncNameOptions) {
  const {funcName, runTheOnlyFuncDirectly} = options ?? {};
  if (!Array.isArray(funcNameList) || funcNameList.length === 0) {
    logColorful({color: 'red'}, `funcNameList length is zero`);
    return;
  }
  const allFuncNames = [...funcNameList, RUN_ALL_EXPORTED_FUNCTIONS];
  if (funcName !== undefined) {
    if (allFuncNames.includes(funcName)) {
      return funcName;
    }
    throw new Error(`function name [${funcName}] is not part of function name list: ${funcNameList}`);
  }

  if (runTheOnlyFuncDirectly && funcNameList.length === 1) {
    return funcNameList[0];
  }

  const {label, answer} = await selectOption(
    allFuncNames.map(it => {
      return {
        label: it,
      };
    })
  );
  const selectedFuncName = label;
  /** Double confirm if function name is selected by option index */
  if (
    (isNumber(answer) || answer === '') &&
    !(await goOnOrNot({
      style: {
        color: 'red',
      },
      tips: [`run function ${selectedFuncName}?`],
      defaultValue: true,
    }))
  ) {
    throw new Error(`Manually Interrupt`);
  }
  return selectedFuncName;
}

async function runFunction(func: (arg0: any) => any, params: any) {
  let res: any = undefined;
  if (isAsyncFunction(func)) {
    res = await func.apply(null, params);
  } else {
    res = func.apply(null, params);
  }
  return res;
}

/**
 * class Module{} 通过module.exports=Module导出模块
 */
async function handleClass(Module: {new (): any; prototype: any}, functionAndParams: any[]) {
  const functionList = Object.getOwnPropertyNames(Module.prototype)
    .filter(it => !it.startsWith('_'))
    .filter(it => ['constructor'].indexOf(it) === -1);
  const [funcName_, ...params] = functionAndParams;
  const funcName = await getFuncNameToRun(functionList, funcName_);
  const target = new Module();
  const func = target[funcName].bind(target);
  return await runFunction(func, params);
}

/**
 * Run .ts/.js script by script path
 * For .ts, it can only run script in same project, as different project use different ts-node params
 */
export async function runTargetScriptOnNode(scriptPath: string, options?: RunTargetScriptOptions) {
  const {runExportedFunc, funcName, funcParams} = options ?? {};
  const fullPath = path.resolve(process.cwd(), scriptPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`file ${fullPath} not exist`);
  }
  const Module = rerequire(fullPath);
  if (!runExportedFunc && !funcName) {
    return;
  }
  if (!isObject(Module)) {
    throw new Error(`the require result from script file '${fullPath}' is not an object.`);
  }
  // 通过module.exports.chain = function() {}导出模块
  const funcNameList = Object.keys(Module).filter(name => isFunction(Module[name]));
  if (!Array.isArray(funcNameList) || funcNameList.length === 0) {
    throw new Error(`No function is exported from file ${fullPath}`);
  }
  const finalFuncName = await getFuncNameToRun(funcNameList, options);
  if (finalFuncName === RUN_ALL_EXPORTED_FUNCTIONS) {
    const results: Record<string, any> = {};
    for (const name of funcNameList) {
      logColorful({color: 'magenta'}, `Running function: ${name}`);
      const func = Module[name];
      results[name] = await runFunction(func, funcParams);
    }
    return results;
  } else {
    const func = Module[finalFuncName];
    const result = await runFunction(func, funcParams);
    return result;
  }
}
