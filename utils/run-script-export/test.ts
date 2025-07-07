import path from 'path';
import { runScriptExport } from ".";
import { logColorful } from '../../log';

export async function runTsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/simple.ts')
  const result = await runScriptExport(tsScript);
  logColorful({}, result);
}

export async function runJsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/simple.js')
  const result = await runScriptExport(tsScript);
  logColorful({}, result);
}