import { parse } from "csv-parse/sync";
import { BadRequestError } from "../lib/errors.js";
import {
  assertHasDataRows,
  assertUsableColumnName,
  assertUniqueColumnNames,
  buildSchema,
  DATASET_PREVIEW_LIMIT,
  type ParsedUploadDataset,
} from "../lib/datasetSchema.js";

function parseHeaderRow(content: string): string[] {
  let headerRows: string[][];

  try {
    headerRows = parse(content, {
      bom: true,
      from_line: 1,
      to_line: 1,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch {
    throw new BadRequestError("Malformed CSV file");
  }

  const headerRow = headerRows[0];

  if (headerRow === undefined || headerRow.length === 0) {
    throw new BadRequestError("CSV file has no headers");
  }

  const normalizedHeaders = headerRow.map((cell) => cell.trim());

  for (const name of normalizedHeaders) {
    assertUsableColumnName(name);
  }

  assertUniqueColumnNames(normalizedHeaders);

  return normalizedHeaders;
}

export function parseUploadedCsv(buffer: Buffer): ParsedUploadDataset {
  const content = buffer.toString("utf8");

  if (content.trim().length === 0) {
    throw new BadRequestError("CSV file is empty");
  }

  const headerNames = parseHeaderRow(content);

  let rows: Record<string, string>[];

  try {
    rows = parse(content, {
      bom: true,
      columns: headerNames,
      from_line: 2,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch {
    throw new BadRequestError(
      "Malformed CSV file or inconsistent columns across rows"
    );
  }

  assertHasDataRows(rows.length);

  const records: Record<string, unknown>[] = rows.map((row) => ({ ...row }));

  return {
    rowCount: records.length,
    schema: buildSchema(headerNames, records),
    records,
    preview: records.slice(0, DATASET_PREVIEW_LIMIT),
  };
}
