"use client";

import type { WsdlOperation } from "@/lib/tester-collections";

interface Props {
  loading: boolean;
  url: string;
  name: string;
  operations: WsdlOperation[];
  selectedOperation: string;
  onUrlChange: (value: string) => void;
  onLoadFile: (file: File) => void;
  onLoadUrl: () => void;
  onSelectOperation: (operation: WsdlOperation) => void;
}

export default function WsdlLoader({ loading, url, name, operations, selectedOperation, onUrlChange, onLoadFile, onLoadUrl, onSelectOperation }: Props) {
  return <section title="Drag the bottom-right corner to resize" className="request-resizable-card space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
    <div><h2 className="text-sm font-semibold text-indigo-900">Load a WSDL</h2><p className="mt-1 text-xs text-indigo-700">Upload a file or load a public WSDL URL to prefill operations and request XML.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <input type="file" accept=".wsdl,.xml" disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onLoadFile(file); }} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700" />
      <div className="flex gap-2"><input type="url" name="tester-wsdl-url" autoComplete="off" value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder="https://example.com/service?wsdl" className="min-w-0 flex-1 rounded border border-indigo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /><button type="button" onClick={onLoadUrl} disabled={loading || !url.trim()} className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Loading..." : "Load"}</button></div>
    </div>
    {operations.length > 0 && <div className="flex items-center gap-3"><label htmlFor="wsdl-operation" className="text-sm font-medium text-indigo-900">{name || "WSDL"} operation</label><select id="wsdl-operation" value={selectedOperation} onChange={(event) => { const operation = operations.find((item) => item.name === event.target.value); if (operation) onSelectOperation(operation); }} className="min-w-64 rounded border border-indigo-200 bg-white px-3 py-2 text-sm">{operations.map((operation) => <option key={operation.name} value={operation.name}>{operation.name}</option>)}</select></div>}
  </section>;
}
