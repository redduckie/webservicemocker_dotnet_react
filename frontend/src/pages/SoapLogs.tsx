import { apiFetch as fetch } from "@/lib/api";
"use client";

import PageLoading from "@/components/PageLoading";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "@/routing";
import Link from "@/components/AppLink";
import LogEntry from "@/components/LogEntry";
import { RequestLog } from "@/lib/types";
import LogPagination from "@/components/LogPagination";
import LogRefreshControl from "@/components/LogRefreshControl";

const PAGE_SIZE = 10;

export default function LogsPage() {
  const params = useParams();
  const id = params.id as string;
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = useCallback(async (targetPage: number, manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/logs?page=${targetPage}&pageSize=${PAGE_SIZE}`);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/project/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
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
        <p className="text-gray-500">No requests logged yet. Send a POST request to the mock endpoint.</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <LogEntry key={log.id} log={log} />
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
