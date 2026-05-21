import {logColorful} from '../external';
import {getFileMetaHandler} from '../service';
import {initSourceAssets} from './service/0-file-generator';
import {SOURCE_DIR} from './serivice';

export async function testFileMetaHandler() {
  // initSourceAssets();
  const metaHandler = await getFileMetaHandler()(SOURCE_DIR);
  const meta = await metaHandler.getMeta();
  logColorful({}, meta);
}
