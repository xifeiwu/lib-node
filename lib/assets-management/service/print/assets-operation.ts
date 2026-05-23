import {logColorful} from '../../external';
import {IgnoredAssets, OperatedAssets} from '../../types';

export function printOperatedAssets(assets: OperatedAssets[]) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return;
  }
  logColorful({color: 'red'}, 'Operated Assets:');

  assets.forEach(asset => {
    console.log(`  ${asset.source.relativePath} -> ${asset.target.relativePath}`);
  });
}

export function printIgnoredAssets(assets: IgnoredAssets[]) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return;
  }
  logColorful({color: 'red'}, 'Ignored Assets:');
  assets.forEach(asset => {
    const reason = asset.reason;
    const source = asset.sourcePath ?? asset.sourceInfo?.relativePath;
    const duplicatedFile = asset.duplicatedInfo?.relativePath;
    console.log(`  ${source}[${reason}]${duplicatedFile ? ` -> ${duplicatedFile}` : ''}`);
  });
}
