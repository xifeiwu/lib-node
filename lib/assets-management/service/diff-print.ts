import {byteToWord} from '../external';
import type {AssetInfoFull, MetaDiffForSyncUp} from '../types';

/** Max lines printed per diff category (beyond summary counts). */
const DIFF_DETAIL_LIMIT = 40;

function abbrevSha(sha1: string | undefined): string {
  if (!sha1) return '(no hash)';
  return sha1.length <= 12 ? sha1 : `${sha1.slice(0, 12)}…`;
}

function assetBriefLine(a: AssetInfoFull): string {
  const id = a.shortId || abbrevSha(a.sha1);
  return `${a.relativePath}  ${byteToWord(a.size || 0)}  [${id}]`;
}

function printDetailLines(lines: string[], totalCount: number) {
  const shown = lines.slice(0, DIFF_DETAIL_LIMIT);
  for (const line of shown) {
    console.log(`    ${line}`);
  }
  if (totalCount > DIFF_DETAIL_LIMIT) {
    console.log(`    … and ${totalCount - DIFF_DETAIL_LIMIT} more`);
  }
}

export function printDiffSummary(diff: MetaDiffForSyncUp) {
  const {added = [], deleted = [], modified = [], moved = [], copied = []} = diff;
  const totalSize = (list: AssetInfoFull[]) => list.reduce((sum, f) => sum + (f.size || 0), 0);

  console.log('\n--- Diff Summary ---');
  console.log(`  To:   ${diff.toDir}`);
  console.log(`  From: ${diff.fromDir}`);

  if (added.length) {
    console.log(`  Added:    ${added.length} files (${byteToWord(totalSize(added))})`);
    const sorted = [...added].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    printDetailLines(
      sorted.map(a => `+ ${assetBriefLine(a)}`),
      added.length
    );
  }
  if (modified.length) {
    console.log(`  Modified: ${modified.length} files`);
    const sorted = [...modified].sort((a, b) => a.to.relativePath.localeCompare(b.to.relativePath));
    const lines = sorted.map(m => {
      const {from, to, changed} = m;
      const sizePart = `${byteToWord(from.size || 0)} → ${byteToWord(to.size || 0)}`;
      const hashPart = `sha1 ${abbrevSha(from.sha1)} → ${abbrevSha(to.sha1)}`;
      const changedKeys =
        changed && Object.keys(changed).length ? `  changed: ${Object.keys(changed).join(', ')}` : '';
      return `~ ${to.relativePath}  ${sizePart}  ${hashPart}${changedKeys}`;
    });
    printDetailLines(lines, modified.length);
  }
  if (moved.length) {
    console.log(`  Moved:    ${moved.length} files`);
    const sorted = [...moved].sort((a, b) => a.to.relativePath.localeCompare(b.to.relativePath));
    printDetailLines(
      sorted.map(
        ({from, to}) => `${from.relativePath} → ${to.relativePath}  [${to.shortId || abbrevSha(to.sha1)}]`
      ),
      moved.length
    );
  }
  if (copied.length) {
    console.log(`  Copied:   ${copied.length} files`);
    const sorted = [...copied].sort((a, b) => a.to.relativePath.localeCompare(b.to.relativePath));
    printDetailLines(
      sorted.map(
        ({from, to}) =>
          `${from.relativePath} → ${to.relativePath}  ${byteToWord(to.size || 0)}  [${to.shortId || abbrevSha(to.sha1)}]`
      ),
      copied.length
    );
  }
  if (deleted.length) {
    console.log(`  Deleted:  ${deleted.length} files`);
    const sorted = [...deleted].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    printDetailLines(
      sorted.map(a => `- ${assetBriefLine(a)}`),
      deleted.length
    );
  }
  if (!diff.isNeedAction) {
    console.log('  No changes needed.');
  }
  console.log('');
}
