interface LogRefreshControlProps {
  refreshing: boolean;
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
}

export default function LogRefreshControl({
  refreshing,
  lastUpdatedAt,
  onRefresh,
}: LogRefreshControlProps) {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex min-w-32 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
        </svg>
        {refreshing ? "Refreshing..." : "Refresh logs"}
      </button>
      <span className="text-xs text-gray-500" aria-live="polite">
        {lastUpdatedAt
          ? `Last updated ${lastUpdatedAt.toLocaleTimeString()}`
          : "Logs refresh manually"}
      </span>
    </div>
  );
}
