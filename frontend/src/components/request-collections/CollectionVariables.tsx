"use client";
import { useState } from "react";
import { parseVariables } from "@/lib/tester-collections";

export default function CollectionVariables({ variables, sensitiveVariables, onChange, onSensitivityChange, onSave, canSave, saving }: {
  variables: Record<string, string>;
  sensitiveVariables: string[];
  onChange: (variables: Record<string, string>) => void;
  onSensitivityChange: (names: string[]) => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return <details className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
    <summary className="cursor-pointer text-sm font-semibold">Collection variables ({Object.keys(variables).length})</summary>
    <p className="my-2 text-xs text-gray-500">Use {'{{variable}}'} in URLs, headers, authentication and bodies. Sensitive values are masked on screen, but still work in requests and scripts. Edits stay in this page until you save. JSON exports include readable values.</p>
    {Object.entries(variables).map(([key, value]) => <div key={key} className="mb-2 flex items-center gap-2">
      <code className="w-40 truncate text-sm" title={key}>{key}</code>
      <input type={sensitiveVariables.includes(key) ? "password" : "text"} autoComplete="off" aria-label={`Value for ${key}`} value={value} onChange={event => onChange({ ...variables, [key]: event.target.value })} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
      <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={sensitiveVariables.includes(key)} onChange={event => onSensitivityChange(event.target.checked ? [...sensitiveVariables, key] : sensitiveVariables.filter(name => name !== key))} />Sensitive<span className="sr-only"> {key}</span></label>
      <button type="button" className="text-sm text-red-600" onClick={() => { onChange(Object.fromEntries(Object.entries(variables).filter(([name]) => name !== key))); onSensitivityChange(sensitiveVariables.filter(name => name !== key)); }}>Remove<span className="sr-only"> {key}</span></button>
    </div>)}
    <div className="flex gap-2"><input aria-label="New variable name" placeholder="Variable name, e.g. authToken" value={name} onChange={event => setName(event.target.value)} className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm" />
    <button type="button" className="rounded bg-indigo-600 px-3 py-1 text-sm text-white" onClick={() => { try { const key = name.trim(); if (Object.hasOwn(variables, key)) throw new Error("That variable already exists."); onChange(parseVariables({ ...variables, [key]: "" })); if (/token|secret|password|api.?key/i.test(key) && !sensitiveVariables.includes(key)) onSensitivityChange([...sensitiveVariables, key]); setName(""); setError(""); } catch (error) { setError((error as Error).message); } }}>Add variable</button></div>
    <div className="mt-3 flex items-center gap-3">
      <button type="button" onClick={onSave} disabled={!canSave || saving} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white disabled:bg-gray-100 disabled:text-gray-400">{saving ? "Saving..." : "Save variables"}</button>
      <span className="text-xs text-gray-500">Saves all pending collection changes together.</span>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </details>;
}
