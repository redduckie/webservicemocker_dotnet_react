import { apiFetch as fetch } from "@/lib/api";
"use client";

import { useEffect, useState } from "react";
import type { RestContentType, RestEndpoint } from "@/lib/types";
import CodeTextarea from "@/components/CodeTextarea";
import ResponseTemplateTools from "@/components/rest-mock/ResponseTemplateTools";
import { handleTextareaTab } from "@/lib/textarea-tab";
import { getErrorLine } from "@/lib/rest-template";
import { defaultResponseBody, isDefaultResponseBody, requestBodyPlaceholder, REST_CONTENT_TYPE_OPTIONS } from "@/lib/rest-content-options";

interface Props {
  projectId: string;
  onCreated: (endpoint: RestEndpoint) => void;
  onCancel: () => void;
  onDirtyChange: (id: string, dirty: boolean) => void;
}

const DIRTY_ID = "new-rest-endpoint";

export default function NewRestEndpointForm({ projectId, onCreated, onCancel, onDirtyChange }: Props) {
  const [method, setMethod] = useState<RestEndpoint["method"]>("GET");
  const [path, setPath] = useState("");
  const [description, setDescription] = useState("");
  const [requestBodyExample, setRequestBodyExample] = useState("");
  const [requestContentType, setRequestContentType] = useState<RestContentType>("application/json");
  const [responseContentType, setResponseContentType] = useState<RestContentType>("application/json");
  const [responseBody, setResponseBody] = useState(defaultResponseBody("application/json"));
  const [statusCode, setStatusCode] = useState(200);
  const [authenticationRequired, setAuthenticationRequired] = useState(true);
  const [requireExactRequestValues, setRequireExactRequestValues] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestErrorLine, setRequestErrorLine] = useState<number | null>(null);
  const [responseErrorLine, setResponseErrorLine] = useState<number | null>(null);
  const dirty = method !== "GET" || path !== "" || description !== "" || requestBodyExample !== "" ||
    requestContentType !== "application/json" || responseContentType !== "application/json" ||
    responseBody !== defaultResponseBody("application/json") || statusCode !== 200 ||
    !authenticationRequired || requireExactRequestValues;

  useEffect(() => {
    onDirtyChange(DIRTY_ID, dirty);
    return () => onDirtyChange(DIRTY_ID, false);
  }, [dirty, onDirtyChange]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setRequestErrorLine(null);
    setResponseErrorLine(null);
    setAdding(true);
    try {
      const response = await fetch(`/api/rest-projects/${projectId}/endpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path, description, requestBodyExample, requestContentType, responseBody, responseContentType, statusCode, authenticationRequired, requireExactRequestValues }),
      });
      if (!response.ok) {
        const data = await response.json();
        const message = data.error || "Failed to add endpoint";
        setError(message);
        const line = getErrorLine(message);
        if (message.startsWith("Request body")) setRequestErrorLine(line);
        if (message.startsWith("Rendered response body")) setResponseErrorLine(line);
        return;
      }
      onCreated(await response.json());
      onCancel();
    } finally {
      setAdding(false);
    }
  }

  function changeResponseContentType(value: RestContentType) {
    setResponseContentType(value);
    if (!responseBody.trim() || isDefaultResponseBody(responseBody)) setResponseBody(defaultResponseBody(value));
  }

  return <form onSubmit={handleSubmit} className="mb-4 space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <div className="grid grid-cols-4 gap-3">
      <label className="text-xs font-medium text-gray-700">Method<select value={method} onChange={(event) => setMethod(event.target.value as RestEndpoint["method"])} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label>
      <label className="col-span-2 text-xs font-medium text-gray-700">Path<input value={path} onChange={(event) => setPath(event.target.value)} placeholder="/users/:id" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
      <label className="text-xs font-medium text-gray-700">Status Code<input type="number" value={statusCode} onChange={(event) => setStatusCode(parseInt(event.target.value) || 200)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-xs font-medium text-gray-700">Request Content Type<select value={requestContentType} onChange={(event) => setRequestContentType(event.target.value as RestContentType)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">{REST_CONTENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="text-xs font-medium text-gray-700">Response Content Type<select value={responseContentType} onChange={(event) => changeResponseContentType(event.target.value as RestContentType)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">{REST_CONTENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>
    <label className="block text-xs font-medium text-gray-700">Description (optional)<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Get user by ID" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
    <div className="space-y-2">
      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3"><input type="checkbox" checked={!authenticationRequired} onChange={(event) => setAuthenticationRequired(!event.target.checked)} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-medium text-gray-800">Allow requests without authentication</span><span className="block text-xs text-gray-500">No Authorization header will be required.</span></span></label>
      <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"><input type="checkbox" checked={requireExactRequestValues} onChange={(event) => setRequireExactRequestValues(event.target.checked)} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-medium text-amber-900">Validate field values</span><span className="block text-xs text-amber-700">Require values to match the request example.</span></span></label>
    </div>
    <label className="block text-xs font-medium text-gray-700">Request Body Example ({requestContentType} — optional for GET)<CodeTextarea ariaLabel="Request body example" value={requestBodyExample} onChange={(value) => { setRequestBodyExample(value); setRequestErrorLine(null); }} onKeyDown={(event) => handleTextareaTab(event, setRequestBodyExample)} placeholder={requestBodyPlaceholder(requestContentType)} rows={4} errorLine={requestErrorLine} /></label>
    <div><label className="block text-xs font-medium text-gray-700">Response Body ({responseContentType} — use {"{{fieldName}}"} for template variables)<CodeTextarea ariaLabel="Response body" value={responseBody} onChange={(value) => { setResponseBody(value); setResponseErrorLine(null); }} onKeyDown={(event) => handleTextareaTab(event, setResponseBody)} rows={6} required errorLine={responseErrorLine} /></label><div className="mt-2"><ResponseTemplateTools template={responseBody} requestBody={requestBodyExample} requestContentType={requestContentType} responseContentType={responseContentType} path={path} onPreviewError={(message) => setResponseErrorLine(getErrorLine(message))} /></div></div>
    {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}
    <button type="submit" disabled={adding} className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50">{adding ? "Adding..." : "Add Endpoint"}</button>
  </form>;
}
