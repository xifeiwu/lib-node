import {handleAssetsDedupe} from '../../operation/assets-dedupe';
import {logColorful} from '../../external';
import {getFileMetaHandler} from '../../service';
import {BACKUP_DELETED_DIR, SOURCE_DIR} from '../serivice';
import {updateMetaHandlerMeta} from '../../operation/meta-align';

export async function testHandleAssetsDedupe() {
  const metaHandler = await getFileMetaHandler()(SOURCE_DIR);
  await updateMetaHandlerMeta(metaHandler);
  const meta = await metaHandler.getMeta();
  handleAssetsDedupe(metaHandler, {dir4DeletedFile: BACKUP_DELETED_DIR});
}
