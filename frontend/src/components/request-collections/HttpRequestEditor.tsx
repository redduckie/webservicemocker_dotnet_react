"use client";

import CodeTextarea from "@/components/CodeTextarea";
import CollapsibleCard from "@/components/request-collections/CollapsibleCard";
import { handleTextareaTab } from "@/lib/textarea-tab";
import type { AuthType, HeaderRow, TesterMode } from "@/lib/tester-collections";
import { useState, type Dispatch, type SetStateAction } from "react";

interface Props {
  mode: TesterMode;
  method: string;
  url: string;
  authType: AuthType;
  token: string;
  username: string;
  password: string;
  apiKeyName: string;
  headers: HeaderRow[];
  body: string;
  sending: boolean;
  hasPreRequestScript?: boolean;
  onMethodChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onAuthTypeChange: (value: AuthType) => void;
  onTokenChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onApiKeyNameChange: (value: string) => void;
  onHeadersChange: (value: HeaderRow[]) => void;
  onBodyChange: Dispatch<SetStateAction<string>>;
  onSend: () => void;
  onCancel: () => void;
}

export default function HttpRequestEditor(props: Props) {
  const { mode, method, url, authType, token, username, password, apiKeyName, headers, body, sending } = props;
  const isGet = mode === "rest" && method === "GET";
  const [getBodyExpanded, setGetBodyExpanded] = useState(false);
  const hasRequestBody = mode === "soap" || method !== "HEAD";
  const bodyExpanded = hasRequestBody && (!isGet || getBodyExpanded);
  const nextHeaderId = () => Math.max(0, ...headers.map((header) => header.id)) + 1;
  const expandedLayout = bodyExpanded ? "request-body-resizable-card flex flex-col gap-4" : "request-resizable-card space-y-4";
  return <CollapsibleCard label="request" expandedClassName={expandedLayout} header={(collapsed) => (
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Request</h2>
        {collapsed && <span className="truncate text-xs text-gray-500">{mode === "soap" ? "POST" : method} {url || "No URL"}</span>}
      </div>
    )}>
    <div className="flex gap-2">
      {mode === "rest" ? <select value={method} onChange={(event) => props.onMethodChange(event.target.value)} className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-bold">{["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((item) => <option key={item}>{item}</option>)}</select> : <span className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-bold">POST</span>}
      <input type="url" name="tester-data-url" autoComplete="off" value={url} onChange={(event) => props.onUrlChange(event.target.value)} placeholder="https://api.example.com/resource" className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      {sending ? <span className="px-5 py-2 text-sm text-gray-500">Sending...</span> : <button type="button" onClick={props.onSend} disabled={!url.trim() && !props.hasPreRequestScript} className="rounded bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Send</button>}
    </div>
    <div><h3 className="text-sm font-semibold text-gray-900">Authentication</h3><div className="mt-2 flex flex-wrap gap-2">
      <select value={authType} onChange={(event) => props.onAuthTypeChange(event.target.value as AuthType)} className="rounded border border-gray-300 px-3 py-2 text-sm"><option value="none">No authentication</option><option value="bearer">Bearer token</option><option value="basic">Basic authentication</option><option value="apiKey">API key header</option></select>
      {authType === "basic" && <><input name="tester-data-basic-user" autoComplete="off" value={username} onChange={(event) => props.onUsernameChange(event.target.value)} placeholder="Username" className="rounded border border-gray-300 px-3 py-2 text-sm" /><input name="tester-data-basic-secret" autoComplete="new-password" type="password" value={password} onChange={(event) => props.onPasswordChange(event.target.value)} placeholder="Password" className="rounded border border-gray-300 px-3 py-2 text-sm" /></>}
      {(authType === "bearer" || authType === "apiKey") && <>{authType === "apiKey" && <input name="tester-api-key-header" autoComplete="off" value={apiKeyName} onChange={(event) => props.onApiKeyNameChange(event.target.value)} placeholder="Header name" className="w-40 rounded border border-gray-300 px-3 py-2 text-sm" />}<input name="tester-data-token" autoComplete="new-password" type="password" value={token} onChange={(event) => props.onTokenChange(event.target.value)} placeholder={authType === "bearer" ? "Bearer token" : "API key"} className="min-w-72 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" /></>}
    </div></div>
    <div><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">Headers</h3><button type="button" onClick={() => props.onHeadersChange([...headers, { id: nextHeaderId(), name: "", value: "" }])} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">+ Add header</button></div><div className="mt-2 space-y-2">{headers.map((header) => <div key={header.id} className="flex gap-2"><input name={`tester-header-name-${header.id}`} autoComplete="off" value={header.name} onChange={(event) => props.onHeadersChange(headers.map((item) => item.id === header.id ? { ...item, name: event.target.value } : item))} placeholder="Header name" className="w-1/3 rounded border border-gray-300 px-3 py-2 font-mono text-sm" /><input name={`tester-header-value-${header.id}`} autoComplete="off" value={header.value} onChange={(event) => props.onHeadersChange(headers.map((item) => item.id === header.id ? { ...item, value: event.target.value } : item))} placeholder="Value" className="flex-1 rounded border border-gray-300 px-3 py-2 font-mono text-sm" /><button type="button" onClick={() => props.onHeadersChange(headers.filter((item) => item.id !== header.id))} className="px-2 text-gray-400 hover:text-red-600">&times;</button></div>)}</div></div>
    {isGet && <button type="button" aria-expanded={bodyExpanded} aria-controls="tester-body-panel" onClick={() => setGetBodyExpanded((expanded) => !expanded)} className="text-left text-sm font-semibold text-gray-900">
      {bodyExpanded ? "▾" : "▸"} Request body (optional){body ? " — body included" : ""}
    </button>}
    {hasRequestBody && <div id="tester-body-panel" hidden={!bodyExpanded} className={bodyExpanded ? "flex min-h-32 flex-1 flex-col" : "hidden"}><label htmlFor="tester-body" className="block text-sm font-semibold text-gray-900">Request body</label><div className="mt-2 min-h-0 flex-1"><CodeTextarea id="tester-body" name="tester-data-body" autoComplete="off" ariaLabel="Request body" value={body} onChange={props.onBodyChange} onKeyDown={(event) => handleTextareaTab(event, props.onBodyChange)} rows={14} fillHeight /></div></div>}
  </CollapsibleCard>;
}
