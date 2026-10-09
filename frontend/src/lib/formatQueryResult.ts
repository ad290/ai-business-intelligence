function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value * 1_000_000) / 1_000_000;
    return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
  }
  return value;
}

export function formatQueryResult(result: Record<string, unknown>[]): string {
  return JSON.stringify(result, jsonReplacer, 2);
}
