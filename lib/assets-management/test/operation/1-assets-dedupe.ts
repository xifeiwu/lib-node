import {handleAssetsDedupe} from '../../operation/assets-dedupe';
import {logColorful} from '../../external';
import {getFileMetaHandler} from '../../service';
import {BACKUP_DELETED_DIR, SOURCE_DIR} from '../serivice';
import {alignMetaWithAssets} from '../../operation/meta-align';

export async function testHandleAssetsDedupe() {
  const metaHandler = await getFileMetaHandler()(SOURCE_DIR);
  await alignMetaWithAssets(metaHandler);
  const meta = await metaHandler.getMeta();
  handleAssetsDedupe(metaHandler, {dir4DeletedFile: BACKUP_DELETED_DIR});
}
