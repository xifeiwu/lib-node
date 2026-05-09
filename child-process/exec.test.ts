import {execCmdWithOptions} from '.';

export async function testExecCmdWithOptions() {
  process.chdir(__dirname);
  const result = await execCmdWithOptions(`assets pull -H elif.site -p 80 .`, {stdio: 'inherit'});
  console.log(result.toString());
}
