/**
 * Zero-dependency CSV serialization.
 * RFC-4180-ish: quotes fields containing comma/quote/newline, escapes quotes
 * by doubling, and prepends a UTF-8 BOM so Excel opens non-ASCII correctly.
 */

export type CsvCell = string | number | boolean | null | undefined | Date;

function formatCell(value: CsvCell): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCell(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvCell;
}

/** Build a CSV string from rows and column definitions. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(formatCell(c.value(row)))).join(",")
  );
  const body = [headerLine, ...dataLines].join("\r\n");
  // BOM for Excel UTF-8 detection.
  return `\uFEFF${body}`;
}

/** Build a Response that downloads as a CSV file. */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
