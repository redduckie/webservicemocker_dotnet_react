"use client";

import type { RequestDraft, TesterMode } from "@/lib/tester-collections";

interface Props {
  collectionMode: TesterMode;
  activeMode: TesterMode;
  activeRequestId: string;
  requests: RequestDraft[];
  filter: string;
  onCollapse: () => void;
  onFilterChange: (value: string) => void;
  onAdd: () => void;
  onOpen: (draft: RequestDraft) => void;
  onRemove: (draft: RequestDraft) => void;
}

export default function RequestCollectionSidebar({ collectionMode, activeMode, activeRequestId, requests, filter, onCollapse, onFilterChange, onAdd, onOpen, onRemove }: Props) {
  return (
    <aside title="Drag the right edge to resize" className="request-collection-sidebar w-full self-start overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm lg:sticky lg:top-6 lg:w-72 lg:min-w-64 lg:max-w-[45vw] lg:resize-x">
      <div className="border-b border-gray-200 p-2">
        <div className="flex items-center gap-1.5">
          <input aria-label="Search requests" value={filter} onChange={(event) => onFilterChange(event.target.value)} placeholder="Search requests" className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm" />
          <button type="button" onClick={onCollapse} aria-label="Hide request list" title="Hide request list" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m12.5 4.5-5 5 5 5" />
            </svg>
          </button>
        </div>
        <button type="button" onClick={onAdd} className="mt-2 w-full rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">+ {collectionMode.toUpperCase()} request</button>
      </div>
      <div className="max-h-[68vh] overflow-y-auto p-1.5">
        {requests.length === 0 ? <p className="p-3 text-sm text-gray-500">No requests match your search.</p> : requests.map((draft) => {
          const active = draft.mode === activeMode && draft.id === activeRequestId;
          return <div key={draft.id} className={`group mb-1 flex items-center rounded-md ${active ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
            <button type="button" onClick={() => onOpen(draft)} className="min-w-0 flex-1 px-2 py-1.5 text-left"><span className="flex items-center gap-2"><span className={`w-12 shrink-0 text-[10px] font-bold ${draft.mode === "soap" ? "text-amber-700" : "text-green-700"}`}>{draft.mode === "soap" ? "SOAP" : draft.method}</span><span className={`truncate text-sm font-medium ${active ? "text-indigo-800" : "text-gray-700"}`}>{draft.name}</span></span>{draft.url && <span className="mt-1 block truncate pl-14 text-xs text-gray-400">{draft.url}</span>}</button>
            <button type="button" onClick={() => onRemove(draft)} aria-label={`Remove ${draft.name} from collection`} className="mr-2 rounded px-1.5 text-gray-400 opacity-0 hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 focus:opacity-100">&times;</button>
          </div>;
        })}
      </div>
      <div className="border-t border-gray-200 px-2 py-1.5 text-xs text-gray-500">Save to keep changes.</div>
    </aside>
  );
}
