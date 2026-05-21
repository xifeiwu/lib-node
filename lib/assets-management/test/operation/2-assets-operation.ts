import {logColorful} from '../../external';
import {addAsset, copyAsset, moveAsset, deleteAsset} from '../../operation/assets-operation';
import {alignMetaWithAssets} from '../../operation/meta-align';
import {getFileMetaHandler} from '../../service';
import {SOURCE_DIR} from '../serivice';
import {initSampleAssets} from '../../file-generator/utils';

export async function testAssetsOperation() {
  initSampleAssets(SOURCE_DIR);
  const metaHandler = await getFileMetaHandler({runDirectly: true})(SOURCE_DIR);
  await alignMetaWithAssets(metaHandler);
  const meta = await metaHandler.getMeta();
  await addAsset(metaHandler, [{sourcePath: __filename, targetPath: 'a/100.txt'}]);
  await copyAsset(metaHandler, [{sourcePath: 'a/10.txt', targetPath: 'a/15.txt'}]);
  await moveAsset(metaHandler, [{sourcePath: 'b/10.txt', targetPath: 'b/15.txt'}]);
  await deleteAsset(metaHandler, ['b/20.txt']);
  const isSame = await alignMetaWithAssets(metaHandler);
  logColorful({}, isSame);
}
