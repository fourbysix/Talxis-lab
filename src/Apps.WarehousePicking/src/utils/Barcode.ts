export function eanError(value: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return "Enter digits only";
  if (value.length < 8 || value.length > 14) return "Enter a barcode between 8 and 14 digits";
  return undefined;
}
