import { BadRequestError } from "./errors.js";

export type ColumnDataType = "string" | "number" | "boolean" | "date";

export type SchemaColumn = {
  name: string;
  type: ColumnDataType;
};

export type ParsedUploadDataset = {
  rowCount: number;
  schema: SchemaColumn[];
  records: Record<string, unknown>[];
  preview: Record<string, unknown>[];
};

export const DATASET_PREVIEW_LIMIT = 5;

function isBooleanString(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "false";
}

function isNumberString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  return Number.isFinite(Number(trimmed));
}

function isDateString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !/\d/.test(trimmed)) {
    return false;
  }

  // Plain numerics (e.g. sales amounts) are not dates, even if Date.parse accepts them.
  if (isNumberString(trimmed)) {
    return false;
  }

  return !Number.isNaN(Date.parse(trimmed));
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return true;
  }

  return false;
}

function isDateLike(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value === "string") {
    return isDateString(value);
  }

  return false;
}

function matchesColumnType(value: unknown, type: ColumnDataType): boolean {
  switch (type) {
    case "boolean":
      return typeof value === "boolean" || isBooleanString(String(value));
    case "number":
      return (
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && isNumberString(value))
      );
    case "date":
      return isDateLike(value);
    case "string":
      return true;
    default:
      return false;
  }
}

/** Mixed or ambiguous values fall back to `string`. */
export function inferColumnType(values: unknown[]): ColumnDataType {
  const nonEmpty = values.filter((value) => !isEmptyValue(value));

  if (nonEmpty.length === 0) {
    return "string";
  }

  const candidates: ColumnDataType[] = ["boolean", "number", "date"];

  for (const candidate of candidates) {
    if (nonEmpty.every((value) => matchesColumnType(value, candidate))) {
      return candidate;
    }
  }

  return "string";
}

export function assertUsableColumnName(name: string): void {
  if (name.trim().length === 0) {
    throw new BadRequestError("Records must have usable column names");
  }
}

export function assertUniqueColumnNames(names: string[]): void {
  const unique = new Set(names);

  if (unique.size !== names.length) {
    throw new BadRequestError("Column names must be unique");
  }
}

export function assertHasDataRows(rowCount: number): void {
  if (rowCount === 0) {
    throw new BadRequestError("Uploaded file contains no data rows");
  }
}

export function buildSchema(
  columnNames: string[],
  records: Record<string, unknown>[]
): SchemaColumn[] {
  for (const name of columnNames) {
    assertUsableColumnName(name);
  }

  assertUniqueColumnNames(columnNames);

  return columnNames.map((name) => ({
    name,
    type: inferColumnType(records.map((record) => record[name])),
  }));
}

export function assertFlatJsonRecord(record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    assertUsableColumnName(key);

    if (value !== null && typeof value === "object") {
      throw new BadRequestError(
        "JSON records must be flat objects with primitive values only"
      );
    }
  }
}
