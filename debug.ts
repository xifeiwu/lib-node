export async function calDuration<T>(promise: Promise<T>) {
  const start = Date.now();
  const res = await promise;
  const end = Date.now();
  console.log(`time used ${end - start}`);
  return res;
}