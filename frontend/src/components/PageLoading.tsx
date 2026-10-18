export default function PageLoading({ label = "Loading page…" }: { label?: string }) {
  return (
    <div className="page-loading rounded-xl border border-gray-200 bg-white px-6 py-12 shadow-sm" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-center">
        <span aria-hidden="true" className="h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600 motion-reduce:animate-none" />
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="mt-1 text-sm text-gray-500">Just a moment while we get everything ready.</p>
        </div>
      </div>
    </div>
  );
}
