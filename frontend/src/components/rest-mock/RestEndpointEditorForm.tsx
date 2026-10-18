"use client";

import type { RestContentType, RestEndpoint } from "@/lib/types";
import CodeTextarea from "@/components/CodeTextarea";
import ResponseTemplateTools from "@/components/rest-mock/ResponseTemplateTools";
import { handleTextareaTab } from "@/lib/textarea-tab";
import { getErrorLine } from "@/lib/rest-template";
import { requestBodyPlaceholder, REST_CONTENT_TYPE_OPTIONS } from "@/lib/rest-content-options";
import type { useRestEndpointEditor } from "@/components/rest-mock/useRestEndpointEditor";

interface Props {
  editor: ReturnType<typeof useRestEndpointEditor>;
  showExample: boolean;
  copiedExample: boolean;
  exampleCurl: string;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  saveError: string | null;
  requestErrorLine: number | null;
  responseErrorLine: number | null;
  onToggleExample: () => void;
  onCopyExample: () => void;
  onResponseContentTypeChange: (value: RestContentType) => void;
  onRequestErrorLineChange: (value: number | null) => void;
  onResponseErrorLineChange: (value: number | null) => void;
  onSave: () => void;
}

export default function RestEndpointEditorForm(props: Props) {
  const { editor } = props;
  const { method, path, description, responseBody, requestBodyExample, requestContentType, responseContentType, statusCode, authenticationRequired, requireExactRequestValues } = editor.state;
  return <div className="space-y-3 border-t border-gray-100 pt-2">
    <button onClick={props.onToggleExample} className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200">{props.showExample ? "Hide Example" : "Request Example"}</button>
    {props.showExample && <div className="relative"><pre className="overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-3 text-xs text-green-400">{props.exampleCurl}</pre><button onClick={props.onCopyExample} className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">{props.copiedExample ? "Copied!" : "Copy"}</button></div>}
    <div className="space-y-2">
      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3"><input type="checkbox" checked={!authenticationRequired} onChange={(event) => editor.setAuthenticationRequired(!event.target.checked)} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-medium text-gray-800">Allow requests without authentication</span><span className="block text-xs text-gray-500">Accept requests without an Authorization header.</span></span></label>
      <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3"><input type="checkbox" checked={requireExactRequestValues} onChange={(event) => editor.setRequireExactRequestValues(event.target.checked)} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-medium text-amber-900">Validate field values</span><span className="block text-xs text-amber-700">Require values to match the request example.</span></span></label>
    </div>
    <div className="grid gap-3 md:grid-cols-4"><label className="text-xs font-medium text-gray-700">Method<select value={method} onChange={(event) => editor.setMethod(event.target.value as RestEndpoint["method"])} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">{["GET", "POST", "PUT", "PATCH", "DELETE"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="md:col-span-3 text-xs font-medium text-gray-700">Path<input value={path} onChange={(event) => editor.setPath(event.target.value)} placeholder="/users/:id" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm" /></label></div>
    <label className="block text-xs font-medium text-gray-700">Endpoint Name / Description<input value={description} onChange={(event) => editor.setDescription(event.target.value)} placeholder={`${method} ${path}`} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" /></label>
    <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-medium text-gray-700">Request Content Type<select value={requestContentType} onChange={(event) => editor.setRequestContentType(event.target.value as RestContentType)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">{REST_CONTENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs font-medium text-gray-700">Response Content Type<select value={responseContentType} onChange={(event) => props.onResponseContentTypeChange(event.target.value as RestContentType)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">{REST_CONTENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    <label className="block text-xs font-medium text-gray-700">Request Body Example ({requestContentType} — used for validation)<CodeTextarea ariaLabel="Request body example" value={requestBodyExample} onChange={(value) => { editor.setRequestBodyExample(value); props.onRequestErrorLineChange(null); }} onKeyDown={(event) => handleTextareaTab(event, editor.setRequestBodyExample)} rows={5} placeholder={requestBodyPlaceholder(requestContentType)} errorLine={props.requestErrorLine} /></label>
    <div><label className="block text-xs font-medium text-gray-700">Response Body ({responseContentType})<CodeTextarea ariaLabel="Response body" value={responseBody} onChange={(value) => { editor.setResponseBody(value); props.onResponseErrorLineChange(null); }} onKeyDown={(event) => handleTextareaTab(event, editor.setResponseBody)} rows={8} errorLine={props.responseErrorLine} /></label><div className="mt-2"><ResponseTemplateTools template={responseBody} requestBody={requestBodyExample} requestContentType={requestContentType} responseContentType={responseContentType} path={path} onPreviewError={(message) => props.onResponseErrorLineChange(getErrorLine(message))} /></div></div>
    {props.saveError && <p className="text-sm text-red-600">{props.saveError}</p>}
    <div className="flex items-end gap-3"><label className="text-xs font-medium text-gray-700">Status Code<input type="number" value={statusCode} onChange={(event) => editor.setStatusCode(parseInt(event.target.value) || 200)} className="mt-1 block w-24 rounded border border-gray-300 px-2 py-1 text-sm" /></label><button onClick={props.onSave} disabled={props.saving || !props.dirty} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">{props.saving ? "Saving..." : props.saved ? "Saved!" : props.dirty ? "Save Changes" : "Saved"}</button></div>
  </div>;
}
