import { BadRequestError } from "../lib/errors.js";
import {
  assertFlatJsonRecord,
  assertHasDataRows,
  buildSchema,
  DATASET_PREVIEW_LIMIT,
  type ParsedUploadDataset,
} from "../lib/datasetSchema.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectColumnNames(records: Record<string, unknown>[]): string[] {
  const names = new Set<string>();

  for (const record of records) {
    for (const key of Object.keys(record)) {
      names.add(key);
    }
  }

  return [...names];
}

export function parseUploadedJson(buffer: Buffer): ParsedUploadDataset {
  const content = buffer.toString("utf8").trim();

  if (content.length === 0) {
    throw new BadRequestError("JSON file is empty");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BadRequestError("Invalid JSON file");
  }

  if (!Array.isArray(parsed)) {
    throw new BadRequestError("JSON file must contain an array of objects");
  }

  if (parsed.length === 0) {
    throw new BadRequestError("JSON file contains no records");
  }

  if (!parsed.every(isPlainObject)) {
    throw new BadRequestError("JSON file must contain an array of objects");
  }

  const records = parsed as Record<string, unknown>[];

  for (const record of records) {
    assertFlatJsonRecord(record);
  }

  assertHasDataRows(records.length);

  const columnNames = collectColumnNames(records);

  if (columnNames.length === 0) {
    throw new BadRequestError("Records must have usable column names");
  }

  return {
    rowCount: records.length,
    schema: buildSchema(columnNames, records),
    records,
    preview: records.slice(0, DATASET_PREVIEW_LIMIT),
  };
}
