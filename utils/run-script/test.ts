import path from 'path';
import { runTsScript } from ".";
import { logColorful } from '../../log';

export async function runTsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/simple.ts')
  const result = await runTsScript(tsScript);
  logColorful({}, result);
}

export async function runJsFileExport() {
  const tsScript = path.join(__dirname, 'scripts/simple.js')
  const result = await runTsScript(tsScript);
  logColorful({}, result);
}