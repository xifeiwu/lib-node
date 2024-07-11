import {showDirContentByHtml} from './html';

export function testShowDirContentByHtml() {
  const content = showDirContentByHtml(__dirname, {maxDepth: 1});
  console.log(content);
}
