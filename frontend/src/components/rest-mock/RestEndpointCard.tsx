import { apiFetch as fetch } from "@/lib/api";
"use client";

import AnimatedDisclosure from "@/components/AnimatedDisclosure";
import { useEffect, useState } from "react";
import Link from "@/components/AppLink";
import type { RestContentType, RestEndpoint } from "@/lib/types";
import { useAppStore } from "@/lib/app-store";
import { defaultResponseBody, isDefaultResponseBody } from "@/lib/rest-content-options";
import { getErrorLine } from "@/lib/rest-template";
import { endpointEditorSignature, endpointEditorState, useRestEndpointEditor } from "@/components/rest-mock/useRestEndpointEditor";
import RestEndpointEditorForm from "@/components/rest-mock/RestEndpointEditorForm";

interface Props {
  projectId: string;
  endpoint: RestEndpoint;
  mockBaseUrl: string;
  apiKey: string | null;
  onDirtyChange?: (id: string, dirty: boolean) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-800", POST: "bg-blue-100 text-blue-800",
  PUT: "bg-amber-100 text-amber-800", PATCH: "bg-purple-100 text-purple-800",
  DELETE: "bg-red-100 text-red-800",
};

export default function RestEndpointCard({ projectId, endpoint, mockBaseUrl, apiKey, onDirtyChange }: Props) {
  const addRestEndpoint = useAppStore((state) => state.addRestEndpoint);
  const replaceRestEndpoint = useAppStore((state) => state.replaceRestEndpoint);
  const removeRestEndpoint = useAppStore((state) => state.removeRestEndpoint);
  const requestCollectionsEnabled = useAppStore((state) => state.features?.requestCollections === true);
  const editor = useRestEndpointEditor(endpoint);
  const { method, path, description, responseBody, requestBodyExample, requestContentType, responseContentType, statusCode, authenticationRequired } = editor.state;
  const [savedSignature, setSavedSignature] = useState(() => endpointEditorSignature(endpointEditorState(endpoint)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [requestErrorLine, setRequestErrorLine] = useState<number | null>(null);
  const [responseErrorLine, setResponseErrorLine] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const dirty = endpointEditorSignature(editor.state) !== savedSignature;

  useEffect(() => {
    onDirtyChange?.(endpoint.id, dirty);
    return () => onDirtyChange?.(endpoint.id, false);
  }, [dirty, endpoint.id, onDirtyChange]);

  function fullUrl() {
    return `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}${mockBaseUrl}${path}`;
  }

  function exampleCurl(): string {
    const parts = [`curl -X ${method}`, fullUrl()];
    if (authenticationRequired && apiKey) parts.push(`-H "Authorization: Bearer ${apiKey}"`);
    if (method !== "GET") parts.push(`-H "Content-Type: ${requestContentType}"`);
    if (method !== "GET" && requestBodyExample) parts.push(`-d '${requestBodyExample}'`);
    return parts.join(" ");
  }

  async function handleSave() {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    editor.setPath(normalizedPath);
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setRequestErrorLine(null);
    setResponseErrorLine(null);
    try {
      const response = await fetch(`/api/rest-projects/${projectId}/endpoints/${endpoint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editor.state, path: normalizedPath }),
      });
      if (!response.ok) {
        const data = await response.json();
        const message = data.error || "Unable to save endpoint";
        setSaveError(message);
        const line = getErrorLine(message);
        if (message.startsWith("Request body")) setRequestErrorLine(line);
        if (message.startsWith("Rendered response body")) setResponseErrorLine(line);
        return;
      }
      const savedEndpoint = await response.json() as RestEndpoint;
      editor.loadEndpoint(savedEndpoint);
      setSavedSignature(endpointEditorSignature(endpointEditorState(savedEndpoint)));
      replaceRestEndpoint(projectId, savedEndpoint);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/rest-projects/${projectId}/endpoints/${endpoint.id}/duplicate`, { method: "POST" });
      if (!response.ok) { setSaveError((await response.json()).error || "Unable to duplicate endpoint"); return; }
      addRestEndpoint(projectId, await response.json());
    } finally { setDuplicating(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this endpoint?")) return;
    const response = await fetch(`/api/rest-projects/${projectId}/endpoints/${endpoint.id}`, { method: "DELETE" });
    if (response.ok) removeRestEndpoint(projectId, endpoint.id);
  }

  function changeResponseContentType(value: RestContentType) {
    editor.setResponseContentType(value);
    if (!responseBody.trim() || isDefaultResponseBody(responseBody)) editor.setResponseBody(defaultResponseBody(value));
  }

  return <article className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <header className="flex items-center justify-between">
      <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-left"><svg className={`h-4 w-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg><span className={`rounded px-2 py-0.5 text-xs font-bold ${METHOD_COLORS[method] || "bg-gray-100 text-gray-800"}`}>{method}</span><span className="text-sm font-semibold text-gray-900">{description || path}</span>{description && <span className="font-mono text-xs text-gray-500">{path}</span>}{!authenticationRequired && <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">No auth</span>}<span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{requestContentType} → {responseContentType}</span></button>
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Status: {statusCode}</span>{requestCollectionsEnabled && <Link href={`/request-collections?mode=rest&projectId=${encodeURIComponent(projectId)}&endpointId=${encodeURIComponent(endpoint.id)}`} className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700">Test endpoint</Link>}<button onClick={() => { navigator.clipboard.writeText(fullUrl()); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{copiedUrl ? "Copied!" : "Copy URL"}</button><button onClick={handleDuplicate} disabled={duplicating} className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700 disabled:opacity-50">{duplicating ? "Duplicating..." : "Duplicate"}</button><button onClick={handleDelete} className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">Delete</button></div>
    </header>
    <AnimatedDisclosure open={expanded}>{() => (<RestEndpointEditorForm editor={editor} showExample={showExample} copiedExample={copiedExample} exampleCurl={exampleCurl()} saving={saving} saved={saved} dirty={dirty} saveError={saveError} requestErrorLine={requestErrorLine} responseErrorLine={responseErrorLine} onToggleExample={() => setShowExample(!showExample)} onCopyExample={() => { navigator.clipboard.writeText(exampleCurl()); setCopiedExample(true); setTimeout(() => setCopiedExample(false), 2000); }} onResponseContentTypeChange={changeResponseContentType} onRequestErrorLineChange={setRequestErrorLine} onResponseErrorLineChange={setResponseErrorLine} onSave={handleSave} />)}</AnimatedDisclosure>
  </article>;
}
