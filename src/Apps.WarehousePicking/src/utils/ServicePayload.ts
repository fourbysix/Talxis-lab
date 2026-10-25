import type { IOperationResult } from "@microsoft/power-apps/data";

export function servicePayload(record: Record<string, unknown>): never {
  return record as never;
}

export async function serviceResult<T>(call: Promise<IOperationResult<T>>): Promise<IOperationResult<T>> {
  const result = await call;
  if (!result.success) {
    throw new Error(serverMessage(result.error?.message));
  }
  return result;
}

function serverMessage(text: string | undefined): string {
  if (!text) return "The request failed";
  try {
    return (JSON.parse(text) as { error?: { message?: string } }).error?.message || text;
  } catch {
    return text;
  }
}

export function errorText(error: unknown): string {
  return String(error).replace(/^Error:\s*/, "");
}
