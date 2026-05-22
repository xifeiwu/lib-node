import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {logColorful} from '../../external';
import {addAssets, copyAsset, moveAsset, deleteAsset} from '../../operation/assets-operation';
import {alignMetaWithAssets} from '../../operation/meta-align';
import {getFileMetaHandler} from '../../service';
import type {MetaHandlers} from '../../types';
import {SOURCE_DIR} from '../serivice';
import {FILE_INDEX} from '../../file-generator/file-index';
import {initSampleAssets} from '../../file-generator/utils';

const EXTERNAL_ADD_FILE = path.join(__dirname, '.tmp/external-add.txt');

function writeExternalAddFile(content = `external sample ${Date.now()}\n`) {
  fs.mkdirSync(path.dirname(EXTERNAL_ADD_FILE), {recursive: true});
  fs.writeFileSync(EXTERNAL_ADD_FILE, content);
}

async function createAlignedMetaHandler(): Promise<MetaHandlers> {
  delete FILE_INDEX[SOURCE_DIR];
  initSampleAssets(SOURCE_DIR);
  const metaHandler = await getFileMetaHandler({runDirectly: true})(SOURCE_DIR);
  await alignMetaWithAssets(metaHandler);
  return metaHandler;
}

async function assertMetaAligned(metaHandler: MetaHandlers, label: string) {
  const isSame = await alignMetaWithAssets(metaHandler);
  assert.strictEqual(isSame, true, `${label}: meta should match disk`);
  logColorful({color: 'green'}, `${label}: meta aligned`);
}

function assetPath(relativePath: string) {
  return path.join(SOURCE_DIR, relativePath);
}

function assertExists(relativePath: string) {
  assert.ok(fs.existsSync(assetPath(relativePath)), `expected file: ${relativePath}`);
}

function assertNotExists(relativePath: string) {
  assert.ok(!fs.existsSync(assetPath(relativePath)), `expected missing file: ${relativePath}`);
}

async function runCase(name: string, fn: () => Promise<void>) {
  logColorful({color: 'yellow'}, `Case: ${name}`);
  await fn();
  logColorful({color: 'green'}, `Case passed: ${name}`);
}

/** Original flow: add external file, copy, move, delete, then align meta. */
async function testAddCopyMoveDeleteFlow() {
  const metaHandler = await createAlignedMetaHandler();
  writeExternalAddFile();
  const {results: added} = await addAssets(metaHandler, [
    {sourcePath: EXTERNAL_ADD_FILE, targetPath: 'a/100.txt'},
  ]);
  assert.strictEqual(added.length, 1);

  const copied = await copyAsset(metaHandler, [{sourcePath: 'a/10.txt', targetPath: 'a/15.txt'}]);
  assert.strictEqual(copied.length, 1);
  assertExists('a/10.txt');
  assertExists('a/15.txt');

  const moved = await moveAsset(metaHandler, [{sourcePath: 'b/10.txt', targetPath: 'b/15.txt'}]);
  assert.strictEqual(moved.length, 1);
  assertNotExists('b/10.txt');
  assertExists('b/15.txt');

  await deleteAsset(metaHandler, ['b/20.txt']);
  assertNotExists('b/20.txt');

  await assertMetaAligned(metaHandler, 'add/copy/move/delete flow');
}

/** External add with duplicate sha1 should be ignored, not copied again. */
async function testAddExternalDuplicateIgnored() {
  const metaHandler = await createAlignedMetaHandler();
  writeExternalAddFile(fs.readFileSync(assetPath('a/10.txt'), 'utf8'));
  const {results, ignored} = await addAssets(metaHandler, [{sourcePath: EXTERNAL_ADD_FILE}]);
  assert.strictEqual(results.length, 0);
  assert.strictEqual(ignored.length, 1);
  assert.strictEqual(ignored[0].reason, 'Source file already exists in rootDir');
  assert.ok(ignored[0].duplicatedInfo?.relativePath === 'a/10.txt');
}

/** Symlink sources are skipped by addAssets. */
async function testAddAssetsIgnoresSymlink() {
  const metaHandler = await createAlignedMetaHandler();
  assert.ok(fs.lstatSync(assetPath('a/a30')).isSymbolicLink());
  const {results, ignored} = await addAssets(metaHandler, [{sourcePath: 'a/a30'}]);
  assert.strictEqual(results.length, 0);
  assert.strictEqual(ignored.length, 1);
  assert.strictEqual(ignored[0].reason, 'Not support add link file');
}

/** Internal copy keeps sha1 and creates a new meta entry. */
async function testCopyAssetPreservesSha1() {
  const metaHandler = await createAlignedMetaHandler();
  const [sourceInfo] = await metaHandler.findItems({relativePath: 'a/10.txt'});
  assert.ok(sourceInfo);

  const copied = await copyAsset(metaHandler, [{sourcePath: 'a/10.txt', targetPath: 'a/16.txt'}]);
  assert.strictEqual(copied.length, 1);
  assert.strictEqual(copied[0].target.relativePath, 'a/16.txt');
  assert.strictEqual(copied[0].target.sha1, sourceInfo.sha1);
  assertExists('a/10.txt');
  assertExists('a/16.txt');
  await assertMetaAligned(metaHandler, 'copy asset');
}

/** copyAsset overwrite replaces an existing target file. */
async function testCopyAssetOverwrite() {
  const metaHandler = await createAlignedMetaHandler();
  await copyAsset(metaHandler, [{sourcePath: 'a/20.txt', targetPath: 'a/25.txt'}]);
  const [before] = await metaHandler.findItems({relativePath: 'a/25.txt'});
  assert.ok(before);

  const copied = await copyAsset(metaHandler, [{sourcePath: 'a/10.txt', targetPath: 'a/25.txt'}], {
    overwrite: true,
  });
  assert.strictEqual(copied.length, 1);
  const [after] = await metaHandler.findItems({relativePath: 'a/25.txt'});
  assert.ok(after);
  assert.strictEqual(after.sha1, copied[0].target.sha1);
  await assertMetaAligned(metaHandler, 'copy overwrite');
}

/** moveAsset relocates file on disk and updates meta paths. */
async function testMoveAssetUpdatesMeta() {
  const metaHandler = await createAlignedMetaHandler();
  const [sourceInfo] = await metaHandler.findItems({relativePath: 'b/10.txt'});
  assert.ok(sourceInfo);

  const moved = await moveAsset(metaHandler, [{sourcePath: 'b/10.txt', targetPath: 'b/18.txt'}]);
  assert.strictEqual(moved.length, 1);
  assert.strictEqual(moved[0].target.relativePath, 'b/18.txt');
  assert.strictEqual(moved[0].target.sha1, sourceInfo.sha1);
  assertNotExists('b/10.txt');
  assertExists('b/18.txt');
  assert.strictEqual((await metaHandler.findItems({relativePath: 'b/10.txt'})).length, 0);
  await assertMetaAligned(metaHandler, 'move asset');
}

/** moveAsset on a folder moves all contained files and removes empty source dir. */
async function testMoveAssetFolder() {
  const metaHandler = await createAlignedMetaHandler();
  await moveAsset(metaHandler, [{sourcePath: 'b', targetPath: 'c/b'}]);
  assertNotExists('b/10.txt');
  assertNotExists('b/20.txt');
  assertExists('c/b/10.txt');
  assertExists('c/b/20.txt');
  assert.ok(!fs.existsSync(assetPath('b')) || getDirFileCount(assetPath('b')) === 0);
  await assertMetaAligned(metaHandler, 'move folder');
}

/** deleteAsset removes a single file and all files under a folder path. */
async function testDeleteAssetFileAndFolder() {
  const metaHandler = await createAlignedMetaHandler();
  await deleteAsset(metaHandler, ['a/50.txt']);
  assertNotExists('a/50.txt');
  assert.strictEqual((await metaHandler.findItems({relativePath: 'a/50.txt'})).length, 0);

  await deleteAsset(metaHandler, ['a']);
  assertNotExists('a/10.txt');
  assertNotExists('a/11.txt');
  assert.ok(!fs.existsSync(assetPath('a')) || getDirFileCount(assetPath('a')) === 0);
  await assertMetaAligned(metaHandler, 'delete asset');
}

function getDirFileCount(dir: string): number {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  return fs.readdirSync(dir).filter(name => {
    const full = path.join(dir, name);
    return fs.statSync(full).isFile();
  }).length;
}

export async function testAssetsOperation() {
  await runCase('add / copy / move / delete flow', testAddCopyMoveDeleteFlow);
  await runCase('add external duplicate ignored', testAddExternalDuplicateIgnored);
  await runCase('add ignores symlink', testAddAssetsIgnoresSymlink);
  await runCase('copy preserves sha1', testCopyAssetPreservesSha1);
  await runCase('copy overwrite', testCopyAssetOverwrite);
  await runCase('move updates meta', testMoveAssetUpdatesMeta);
  await runCase('move folder', testMoveAssetFolder);
  await runCase('delete file and folder', testDeleteAssetFileAndFolder);
  await runCase('copy nested target', testCopyAssetNestedTarget);
}

/** copyAsset can target a nested path under rootDir. */
async function testCopyAssetNestedTarget() {
  const metaHandler = await createAlignedMetaHandler();
  const relativePath = 'nested/copy-target.txt';
  await copyAsset(metaHandler, [{sourcePath: 'a/10.txt', targetPath: relativePath}]);
  assert.strictEqual((await metaHandler.findItems({relativePath})).length, 1);
  assertExists(relativePath);
}
