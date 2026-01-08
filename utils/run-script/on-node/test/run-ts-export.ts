import path from 'path';
import {runTargetScriptOnNode} from '../run-target-script';
import {logColorful} from '../../../../log';

export async function runTsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/test.ts');
  const result = await runTargetScriptOnNode(tsScript, {runExportedFunc: true});
  logColorful({}, result);
}

export async function runTsFileExportWithParam() {
  const tsScript = path.join(__dirname, 'scripts/test.ts');
  const result = await runTargetScriptOnNode(tsScript, {
    runExportedFunc: true,
    funcName: 'add1',
    funcParams: [12],
  });
  logColorful({}, result);
}
runTsFileExportWithParam();

export async function runJsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/test.js');
  const result = await runTargetScriptOnNode(tsScript, {runExportedFunc: true});
  logColorful({}, result);
}
