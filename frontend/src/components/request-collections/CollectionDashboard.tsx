"use client";

import PageLoading from "@/components/PageLoading";
import Link from "@/components/AppLink";
import type { CollectionSummary, TesterMode } from "@/lib/tester-collections";

interface Props {
  collections: CollectionSummary[];
  visibleCollections: CollectionSummary[];
  search: string;
  busy: boolean;
  error: string | null;
  onSearchChange: (value: string) => void;
  onNewCollection: (mode: TesterMode) => void;
  onImport: (file: File) => void;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onDelete: (collection: CollectionSummary) => void;
}

export default function RequestCollectionDashboard({ collections, visibleCollections, search, busy, error, onSearchChange, onNewCollection, onImport, onRefresh, onOpen, onDelete }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back to Home</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Request Collections</h1>
        <p className="mt-1 text-gray-600">Organize, save, and run your private REST and SOAP requests.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-gray-900">New Request Collection</h2><p className="mt-1 text-sm text-gray-500">Start a collection, then add REST or SOAP requests from its sidebar.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNewCollection("rest")} disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">+ New REST Collection</button>
            <button type="button" onClick={() => onNewCollection("soap")} disabled={busy} className="rounded bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50">+ New SOAP Collection</button>
          </div>
        </div>
        <div className="mt-5 border-t border-gray-200 pt-5"><div className="flex flex-wrap items-center gap-4">
          <label className="cursor-pointer rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Import Collection JSON<input aria-label="Import collection JSON" type="file" accept=".json,application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onImport(file); }} /></label>
          <span className="text-xs text-gray-500">Imports open for review before they are saved.</span>
        </div></div>
      </section>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-gray-900">Your Collections</h2><p className="text-sm text-gray-500">{collections.length} collection{collections.length === 1 ? "" : "s"}</p></div>
          <div className="flex w-full max-w-md gap-2"><input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search collections" className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400" /><button type="button" onClick={onRefresh} disabled={busy} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50">Refresh</button></div>
        </div>
        {busy ? <PageLoading label="Loading collections..." /> : collections.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">No request collections yet. Create one above to get started.</div> : visibleCollections.length === 0 ? <p className="text-gray-500">No collections match your search.</p> : (
          <div className="grid gap-4 md:grid-cols-2">{visibleCollections.map((collection) => (
            <article key={collection.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-4"><button type="button" onClick={() => onOpen(collection.id)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-lg text-amber-800">&#128193;</span><div className="min-w-0"><h3 className="truncate font-semibold text-indigo-700 hover:text-indigo-900">{collection.name}</h3><p className="mt-1 flex items-center gap-2 text-sm text-gray-500"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${collection.mode === "soap" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{collection.mode}</span><span>{collection.requestCount} request{collection.requestCount === 1 ? "" : "s"}</span></p></div></div></button><button type="button" onClick={() => onDelete(collection)} className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100">Delete</button></div>
              <button type="button" onClick={() => onOpen(collection.id)} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800">Open collection &rarr;</button>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
