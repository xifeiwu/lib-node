import {htmlDirContent} from './html';

export function testHtmlDirContent() {
  const content = htmlDirContent(__dirname, {maxDepth: 1});
  console.log(content);
}
