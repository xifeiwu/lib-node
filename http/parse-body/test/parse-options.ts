import {octet} from './basic-flow';

export async function saveAndCache() {
  await octet({
    wayOfHandleFile: 'cacheAndSave',
  });
}
