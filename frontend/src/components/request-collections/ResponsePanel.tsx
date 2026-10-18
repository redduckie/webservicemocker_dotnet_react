"use client";

import { useMemo, useState } from "react";
import CollapsibleCard from "@/components/request-collections/CollapsibleCard";
import JsonResponseGrid from "@/components/request-collections/JsonResponseGrid";
import { canDisplayJsonResponseGrid, parseJsonResponseGrid } from "@/lib/json-response-grid";

export interface TesterResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
}

function prettyBody(body: string): string {
  try { return JSON.stringify(JSON.parse(body), null, 2); }
  catch { return body; }
}

export default function TesterResponsePanel({ response }: { response: TesterResponse }) {
  const [gridBody, setGridBody] = useState<string | null>(null);
  const canShowGrid = useMemo(() => canDisplayJsonResponseGrid(response.body), [response.body]);
  const showGrid = canShowGrid && gridBody === response.body;
  const gridData = useMemo(() => showGrid ? parseJsonResponseGrid(response.body) : null, [response.body, showGrid]);

  return <CollapsibleCard label="response" expandedClassName="response-resizable-card flex flex-col" header={() => (
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-semibold text-gray-900">Response</h2><span className={`rounded-full px-3 py-1 text-sm font-bold ${response.status >= 200 && response.status < 400 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{response.status} {response.statusText}</span><span className="text-sm text-gray-500">{response.durationMs} ms</span><span className="text-sm text-gray-500">{response.sizeBytes.toLocaleString()} bytes</span></div>
    )}>
    <div className="flex min-h-0 flex-1 flex-col pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Response body</h3>
        <div className="flex items-center gap-2">
          {canShowGrid && (
            <>
              <div className="flex rounded border border-gray-300 bg-gray-100 p-0.5" role="group" aria-label="Response view">
                <button type="button" onClick={() => setGridBody(null)} aria-pressed={!showGrid} className={`rounded px-2.5 py-1 text-xs font-semibold ${!showGrid ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}>JSON</button>
                <button type="button" onClick={() => setGridBody(response.body)} aria-pressed={showGrid} className={`rounded px-2.5 py-1 text-xs font-semibold ${showGrid ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600"}`}>Grid</button>
              </div>
              <span className="group relative inline-flex">
                <span
                  tabIndex={0}
                  aria-describedby="json-flattening-help"
                  className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-500"
                >?</span>
                <span
                  id="json-flattening-help"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-7 z-20 hidden w-72 rounded bg-gray-900 p-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block"
                >
                  Nested field paths use underscores. Each array item becomes a row; sibling arrays create every combination, and parent values repeat on each row.
                </span>
              </span>
            </>
          )}
          <button type="button" onClick={() => navigator.clipboard.writeText(response.body)} className="text-xs font-medium text-indigo-600">Copy</button>
        </div>
      </div>
      <div className="response-view-viewport mt-2">
        {showGrid && gridData
          ? <JsonResponseGrid data={gridData} />
          : <pre className="h-full w-full overflow-auto whitespace-pre-wrap rounded bg-gray-950 p-3 font-mono text-xs text-green-300">{prettyBody(response.body)}</pre>}
      </div>
    </div>
    <details><summary className="cursor-pointer text-sm font-semibold text-gray-900">Response headers</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-3 font-mono text-xs text-gray-700">{JSON.stringify(response.headers, null, 2)}</pre></details>
  </CollapsibleCard>;
}
