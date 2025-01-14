import path from 'path';
import {sendHttpResponse, startHttpServer} from '../http';
import {streamFileContent} from './html';
import {toNormalizedUrlProps} from '../external';

export async function testHtmlDirContent() {
  const baseDir = path.resolve(__dirname, '..');
  const {origin, server} = await startHttpServer({
    request(req, res) {
      const {url} = req;
      const {pathname} = toNormalizedUrlProps(url);
      sendHttpResponse(res, {
        data: streamFileContent(path.join(baseDir, pathname)),
      });
    },
  });
  // const content = htmlDirContent(__dirname, {maxDepth: 1});
  // console.log(content);
  console.log(`started at origin: ${origin}`);
}
