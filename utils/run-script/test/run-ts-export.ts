import path from 'path';
import {runTsScript} from '../run-ts-script';
import {logColorful} from '../../../log';

export async function runTsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/test.ts');
  const result = await runTsScript(tsScript, {selectExportedFunc: true});
  logColorful({}, result);
}

export async function runTsFileExportWithParam() {
  const tsScript = path.join(__dirname, 'scripts/test.ts');
  const result = await runTsScript(tsScript, {
    selectExportedFunc: true,
    funcName: 'add1',
    funcParams: [12],
  });
  logColorful({}, result);
}
runTsFileExportWithParam()

export async function runJsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/test.js');
  const result = await runTsScript(tsScript, {selectExportedFunc: true});
  logColorful({}, result);
}
