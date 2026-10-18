import { apiFetch as fetch } from "@/lib/api";
"use client";

import AnimatedDisclosure from "@/components/AnimatedDisclosure";
import { useEffect, useState } from "react";
import { Operation } from "@/lib/types";
import { createSoapRequestExample } from "@/lib/soap-operation";
import Link from "@/components/AppLink";
import { useAppStore } from "@/lib/app-store";
import CodeTextarea from "@/components/CodeTextarea";
import SoapTemplateTools from "@/components/soap-mock/SoapTemplateTools";
import { getErrorLine } from "@/lib/rest-template";
import { handleTextareaTab } from "@/lib/textarea-tab";

interface OperationCardProps {
  projectId: string;
  operation: Operation;
  mockUrl: string;
  apiKey: string | null;
  onDirtyChange?: (id: string, dirty: boolean) => void;
}

export default function OperationCard({
  projectId,
  operation,
  mockUrl,
  apiKey,
  onDirtyChange,
}: OperationCardProps) {
  const replaceOperation = useAppStore((state) => state.replaceOperation);
  const requestCollectionsEnabled = useAppStore((state) => state.features?.requestCollections === true);
  const [name, setName] = useState(operation.name);
  const [soapAction, setSoapAction] = useState(operation.soapAction);
  const [requestXml, setRequestXml] = useState(
    operation.requestXml || createSoapRequestExample(operation.name)
  );
  const [responseXml, setResponseXml] = useState(operation.responseXml);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [requestErrorLine, setRequestErrorLine] = useState<number | null>(null);
  const [responseErrorLine, setResponseErrorLine] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const editorId = operation.name;
  const signature = JSON.stringify({ name, soapAction, requestXml, responseXml });
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify({
    name: operation.name,
    soapAction: operation.soapAction,
    requestXml: operation.requestXml || createSoapRequestExample(operation.name),
    responseXml: operation.responseXml,
  }));
  const dirty = signature !== savedSignature;

  useEffect(() => {
    onDirtyChange?.(editorId, dirty);
    return () => onDirtyChange?.(editorId, false);
  }, [dirty, editorId, onDirtyChange]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    setRequestErrorLine(null);
    setResponseErrorLine(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/operations/${encodeURIComponent(operation.name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, soapAction, requestXml, responseXml }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save operation");
      }
      const savedOperation = data.operation as Operation;
      setName(savedOperation.name);
      setSoapAction(savedOperation.soapAction);
      setRequestXml(savedOperation.requestXml || createSoapRequestExample(savedOperation.name));
      setResponseXml(savedOperation.responseXml);
      setSavedSignature(JSON.stringify({
        name: savedOperation.name,
        soapAction: savedOperation.soapAction,
        requestXml: savedOperation.requestXml || createSoapRequestExample(savedOperation.name),
        responseXml: savedOperation.responseXml,
      }));
      setSaved(true);
      replaceOperation(projectId, operation.name, savedOperation);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save operation";
      setError(message);
      const line = getErrorLine(message);
      if (message.startsWith("Request XML")) setRequestErrorLine(line);
      if (message.startsWith("Rendered response body")) setResponseErrorLine(line);
    } finally {
      setSaving(false);
    }
  }

  function handleCopyUrl() {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}${mockUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getExampleRequest(): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const soapBody = requestXml;
    const authLine = apiKey ? `  -u "mock:${apiKey}" \\\n` : "";
    return `curl -X POST ${baseUrl}${mockUrl} \\
${authLine}  -H "Content-Type: text/xml; charset=utf-8" \\
  -H "SOAPAction: ${soapAction}" \\
  -d '${soapBody}'`;
  }

  function handleCopyExample() {
    navigator.clipboard.writeText(getExampleRequest());
    setCopiedExample(true);
    setTimeout(() => setCopiedExample(false), 2000);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-left"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="font-semibold text-gray-900">{name}</h3>
          {operation.customized && (
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
              Customized
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {requestCollectionsEnabled && <Link
            href={`/request-collections?mode=soap&projectId=${encodeURIComponent(projectId)}&operation=${encodeURIComponent(name)}`}
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            Test operation
          </Link>}
          <button
            onClick={handleCopyUrl}
            className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
          >
            {copied ? "Copied!" : "Copy Mock URL"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {soapAction && (
          <p className="text-xs text-gray-500 font-mono flex-1">
            SOAPAction: {soapAction}
          </p>
        )}
        <button
          onClick={() => setShowExample(!showExample)}
          className={`text-xs px-3 py-1 rounded ${
            showExample
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : "bg-amber-50 hover:bg-amber-100 text-amber-700"
          }`}
        >
          {showExample ? "Hide Example" : "Request Example"}
        </button>
      </div>

      {showExample && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Example cURL request:</span>
            <button
              onClick={handleCopyExample}
              className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
            >
              {copiedExample ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto whitespace-pre-wrap">
            {getExampleRequest()}
          </pre>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <AnimatedDisclosure open={expanded}>{() => (
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Operation name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              SOAPAction
              <input
                value={soapAction}
                onChange={(event) => setSoapAction(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium text-gray-700">
            Request XML example
            <CodeTextarea
              ariaLabel="Request XML example"
              value={requestXml}
              onChange={(value) => {
                setRequestXml(value);
                setRequestErrorLine(null);
              }}
              onKeyDown={(event) => handleTextareaTab(event, setRequestXml)}
              rows={14}
              errorLine={requestErrorLine}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium text-gray-700">
            Response XML
            <CodeTextarea
              ariaLabel="Response XML"
              value={responseXml}
              onChange={(value) => {
                setResponseXml(value);
                setResponseErrorLine(null);
              }}
              onKeyDown={(event) => handleTextareaTab(event, setResponseXml)}
              rows={14}
              errorLine={responseErrorLine}
            />
          </label>
          <SoapTemplateTools
            requestXml={requestXml}
            responseXml={responseXml}
            onPreviewError={(message) => setResponseErrorLine(getErrorLine(message))}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
            </button>
            {saved && (
              <span className="text-green-600 text-sm">Saved!</span>
            )}
          </div>
        </div>
      )}</AnimatedDisclosure>
    </div>
  );
}
