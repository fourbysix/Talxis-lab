export function toNumber(value: string | number | null | undefined): number | null {
  return value == null || value === "" ? null : Number(value);
}
