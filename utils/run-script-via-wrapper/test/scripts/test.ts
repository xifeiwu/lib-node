export function add1(value?: number) {
  const result = (value ?? 0) + 1;
  return result;
}

export function add2(value?: number) {
  const result = (value ?? 0) + 2;
  return result;
}
