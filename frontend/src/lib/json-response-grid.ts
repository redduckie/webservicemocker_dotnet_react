export type JsonGridValue = string | number | boolean | null;
export type JsonGridRow = Record<string, JsonGridValue>;

export interface JsonGridData {
  columns: string[];
  rows: JsonGridRow[];
  truncated: boolean;
}

type JsonObject = Record<string, unknown>;
interface FlattenState { truncated: boolean }

export const MAX_JSON_GRID_ROWS = 25_000;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function columnName(path: string[]): string {
  return path.join("_");
}

function flattenToRows(value: unknown, path: string[], state: FlattenState): JsonGridRow[] {
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return [{ [columnName(path) || "value"]: "{}" }];

    let rows: JsonGridRow[] = [{}];
    for (const [key, child] of entries) {
      const childRows = flattenToRows(child, [...path, key], state);
      const combined: JsonGridRow[] = [];
      outer: for (const row of rows) {
        for (const childRow of childRows) {
          if (combined.length >= MAX_JSON_GRID_ROWS) {
            state.truncated = true;
            break outer;
          }
          combined.push({ ...row, ...childRow });
        }
      }
      rows = combined;
    }
    return rows;
  }

  const key = columnName(path) || "value";
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ [key]: "[]" }];
    const rows: JsonGridRow[] = [];
    for (const child of value) {
      for (const row of flattenToRows(child, path, state)) {
        if (rows.length >= MAX_JSON_GRID_ROWS) {
          state.truncated = true;
          return rows;
        }
        rows.push(row);
      }
    }
    return rows;
  }
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return [{ [key]: value as JsonGridValue }];
  }
  return [{ [key]: String(value) }];
}

export function parseJsonResponseGrid(body: string): JsonGridData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) && !isObject(parsed)) return null;
  const state: FlattenState = { truncated: false };
  const rows = flattenToRows(parsed, [], state);

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { columns, rows, truncated: state.truncated };
}

export function canDisplayJsonResponseGrid(body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body);
    return Array.isArray(parsed) || isObject(parsed);
  } catch {
    return false;
  }
}

export function escapeSpreadsheetFormula(value: unknown): string {
  if (typeof value !== "string") return value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
