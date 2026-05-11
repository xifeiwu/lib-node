import path from 'path';
import {runScriptInCP} from '../../main';
import {logColorful} from '../../../../log';

export async function testRunScriptExportInCP() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runScriptInCP({
    targetScript: scriptPath,
    runTargetScriptOptions: {runExportedFunc: true, funcParams: [10]},
  });
  logColorful({}, result);
}
testRunScriptExportInCP();

export async function passFuncNameAndParams() {
  const scriptPath = path.join(__dirname, 'scripts/test.ts');
  const result = await runScriptInCP({
    targetScript: scriptPath,
    runTargetScriptOptions: {runExportedFunc: true, funcName: 'add1', funcParams: [10]},
  });
  logColorful({}, result);
}
// passFuncNameAndParams();
