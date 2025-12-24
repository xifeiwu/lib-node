import path from 'path';
import {getFileList} from '../../fs';
import {parseBasename} from '../../path';
import {selectOption} from '../../readline';

export async function getFullPathOfCpScript(
  basename: 'debug-server' | 'io-transparent' | 'customized-http-server',
  options?: {
    tryJsFirst?: boolean;
  }
) {
  const {tryJsFirst} = options ?? {};
  const scriptList = await getFileList(__dirname, {
    fileFilter({basename}) {
      const {bareBasename, extname} = parseBasename(basename);
      return (
        ['.ts', '.js'].includes(extname) &&
        !bareBasename.endsWith('.test') &&
        !['service'].includes(bareBasename)
      );
    },
  });
  const bareBasenameList = scriptList.map(it => parseBasename(it).bareBasename);
  let target: string;
  if (bareBasenameList.includes(basename)) {
    basename += tryJsFirst ? '.js' : '.ts';
  }
  if (scriptList.includes(basename)) {
    target = basename;
  }
  if (!target) {
    ({label: target} = await selectOption(scriptList.map(it => ({label: it}))));
  }
  return path.resolve(__dirname, target);
}
