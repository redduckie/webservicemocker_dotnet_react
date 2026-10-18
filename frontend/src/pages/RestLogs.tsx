import { apiFetch as fetch } from "@/lib/api";
"use client";

import PageLoading from "@/components/PageLoading";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "@/routing";
import Link from "@/components/AppLink";
import { RestRequestLog } from "@/lib/types";
import LogPagination from "@/components/LogPagination";
import LogRefreshControl from "@/components/LogRefreshControl";

const PAGE_SIZE = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RestLogsPage() {
  const params = useParams();
  const id = params.id as string;
  const [logs, setLogs] = useState<RestRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = useCallback(async (targetPage: number, manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/rest-projects/${id}/logs?page=${targetPage}&pageSize=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotalLogs(data.total);
        setLastUpdatedAt(new Date());
      }
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchLogs(page);
  }, [fetchLogs, page]);

  function formatJson(str: string): string {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/rest-project/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; Back to Project
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Request Logs</h1>
        </div>
        <LogRefreshControl
          refreshing={refreshing}
          lastUpdatedAt={lastUpdatedAt}
          onRefresh={() => void fetchLogs(page, true)}
        />
      </div>

      {loading ? (
        <PageLoading />
      ) : logs.length === 0 ? (
        <p className="text-gray-500">No requests logged yet. Send a request to the mock endpoint to see it here.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`border rounded-lg shadow-sm ${log.matched ? "border-gray-200 bg-white" : "border-red-200 bg-red-50"}`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                aria-expanded={expandedId === log.id}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${expandedId === log.id ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    log.matched ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {log.statusCode}
                  </span>
                  <span className="text-xs font-bold text-gray-600">{log.method}</span>
                  <span className="text-sm font-mono text-gray-900">{log.path}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </button>

              {expandedId === log.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                  {log.requestBody && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Request Body</p>
                      {log.requestBodyTruncated && (
                        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          This request was {formatBytes(log.requestBodySizeBytes ?? 0)}. It was too large to log in full, so only a preview is shown.
                        </p>
                      )}
                      <pre className="text-xs bg-gray-50 border border-gray-200 p-3 rounded overflow-x-auto font-mono resize-y max-h-48 overflow-y-auto">
                        {formatJson(log.requestBody)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Response Body</p>
                    <pre className="text-xs bg-gray-50 border border-gray-200 p-3 rounded overflow-x-auto font-mono resize-y max-h-48 overflow-y-auto">
                      {formatJson(log.responseBody)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Headers</p>
                    <pre className="text-xs bg-gray-50 border border-gray-200 p-2 rounded overflow-x-auto font-mono max-h-32 overflow-y-auto">
                      {JSON.stringify(log.requestHeaders, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
          <LogPagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={totalLogs}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
