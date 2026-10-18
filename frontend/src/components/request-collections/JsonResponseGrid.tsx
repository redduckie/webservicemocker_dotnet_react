"use client";

import { useMemo, useRef, useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  escapeSpreadsheetFormula,
  MAX_JSON_GRID_ROWS,
  type JsonGridData,
  type JsonGridRow,
} from "@/lib/json-response-grid";

ModuleRegistry.registerModules([AllCommunityModule]);

const responseGridTheme = themeQuartz.withParams({
  accentColor: "#4f46e5",
  backgroundColor: "var(--response-grid-background)",
  borderColor: "var(--response-grid-border)",
  browserColorScheme: "inherit",
  cellTextColor: "var(--response-grid-text)",
  chromeBackgroundColor: "var(--response-grid-chrome)",
  columnBorder: { style: "solid", width: 1, color: "var(--response-grid-border)" },
  fontFamily: "inherit",
  foregroundColor: "var(--response-grid-text)",
  headerBackgroundColor: "var(--response-grid-header-background)",
  headerColumnBorder: { style: "solid", width: 1, color: "var(--response-grid-border)" },
  headerHeight: 34,
  headerRowBorder: { style: "solid", width: 1, color: "var(--response-grid-border)" },
  headerTextColor: "var(--response-grid-header-text)",
  inputBackgroundColor: "var(--response-grid-input-background)",
  inputHeight: 26,
  inputTextColor: "var(--response-grid-text)",
  menuBackgroundColor: "var(--response-grid-background)",
  menuTextColor: "var(--response-grid-text)",
  oddRowBackgroundColor: "var(--response-grid-odd-row)",
  rowBorder: { style: "solid", width: 1, color: "var(--response-grid-border)" },
  rowHeight: 30,
  rowHoverColor: "var(--response-grid-row-hover)",
  selectedRowBackgroundColor: "var(--response-grid-selected-row)",
  spacing: 4,
});

export default function JsonResponseGrid({ data }: { data: JsonGridData }) {
  const gridRef = useRef<AgGridReact<JsonGridRow>>(null);
  const [search, setSearch] = useState("");
  const columnDefs = useMemo<ColDef<JsonGridRow>[]>(() => data.columns.map((field) => {
    const populatedValues = data.rows.map((row) => row[field]).filter((value) => value !== null && value !== undefined);
    return {
      field,
      headerName: field,
      filter: populatedValues.length > 0 && populatedValues.every((value) => typeof value === "number")
        ? "agNumberColumnFilter"
        : "agTextColumnFilter",
    };
  }), [data]);

  const defaultColDef = useMemo<ColDef<JsonGridRow>>(() => ({
    minWidth: 150,
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: true,
  }), []);

  function exportCsv() {
    gridRef.current?.api.exportDataAsCsv({
      fileName: "response.csv",
      processCellCallback: ({ value }) => escapeSpreadsheetFormula(value),
    });
  }

  return (
    <div className="request-response-grid flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search response rows"
          placeholder="Search all columns"
          className="min-w-56 flex-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
            Clear
          </button>
        )}
        <button type="button" onClick={exportCsv} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
          Export CSV
        </button>
        <span className="text-xs text-gray-500">{data.rows.length.toLocaleString()} rows</span>
      </div>
      {data.truncated && (
        <p role="status" className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Showing and exporting the first {MAX_JSON_GRID_ROWS.toLocaleString()} expanded rows to keep the browser responsive.
        </p>
      )}

      <div className="min-h-0 w-full flex-1 overflow-hidden rounded border border-gray-200">
        <AgGridReact<JsonGridRow>
          ref={gridRef}
          theme={responseGridTheme}
          rowData={data.rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={search}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100]}
          enableCellTextSelection
        />
      </div>
    </div>
  );
}
