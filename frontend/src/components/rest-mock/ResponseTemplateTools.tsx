"use client";

import { useState } from "react";
import type { RestContentType } from "@/lib/types";
import { getJsonSyntaxIssue, getPathParams, renderRestResponseTemplate } from "@/lib/rest-template";

interface ResponseTemplateToolsProps {
  template: string;
  requestBody: string;
  requestContentType: RestContentType;
  responseContentType: RestContentType;
  path?: string;
  onPreviewError?: (message: string | null) => void;
}

const ARRAY_REQUEST = `{
  "customer": { "name": "Ali" },
  "items": [
    { "sku": "ABC", "price": 10 },
    { "sku": "XYZ", "price": 20 }
  ]
}`;

const LOOP_RESPONSE = `{
  "customer": "{{customer.name}}",
  "count": {{length items}},
  "products": [
    {{#each items}}
    {
      "position": {{@index}},
      "code": "{{sku}}",
      "amount": {{json price}}
    }
    {{/each}}
  ]
}`;

export default function ResponseTemplateTools({
  template,
  requestBody,
  requestContentType,
  responseContentType,
  path = "/",
  onPreviewError,
}: ResponseTemplateToolsProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function handlePreview() {
    setPreviewError(null);
    onPreviewError?.(null);
    try {
      const samplePath = path.replace(/:([^/]+)/g, (_match, name: string) => `${name}-example`);
      const rendered = renderRestResponseTemplate({
        template,
        requestBody,
        requestContentType,
        responseContentType,
        pathParams: getPathParams(samplePath, path),
      });
      if (responseContentType === "application/json") {
        const syntaxIssue = getJsonSyntaxIssue(rendered, "Rendered response body");
        if (syntaxIssue) throw new Error(syntaxIssue.message);
        setPreview(JSON.stringify(JSON.parse(rendered), null, 2));
      } else {
        setPreview(rendered);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview template";
      setPreview(null);
      setPreviewError(message);
      onPreviewError?.(message);
    }
  }

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowHelp((current) => !current)}
          className="rounded bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          {showHelp ? "Hide Template Help" : "How to Structure a Custom Response"}
        </button>
        <button
          type="button"
          onClick={handlePreview}
          className="rounded bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          Preview Response
        </button>
      </div>

      {showHelp && (
        <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50 p-4 text-xs text-gray-700">
          <div>
            <p className="font-semibold text-gray-900">Fields, objects, and arrays</p>
            <div className="mt-1 grid gap-1 font-mono">
              <code>{"{{customer.name}}"} — text value</code>
              <code>{"{{items[0].sku}}"} — one array item</code>
              <code>{"{{json items}}"} — complete JSON array or object</code>
              <code>{"{{json items[*].sku}}"} — one field from every item</code>
              <code>{"{{length items}}"} — collection length</code>
              <code>{"{{id}}"} — path parameter from a route such as /orders/:id</code>
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-900">Complete loop reference</p>
            <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
              <code className="font-mono text-indigo-800">{"{{field}}"}</code>
              <span>Read a field from the current item.</span>
              <code className="font-mono text-indigo-800">{"{{this}}"}</code>
              <span>Use the complete current item, especially when the array contains strings or numbers.</span>
              <code className="font-mono text-indigo-800">{"{{../name}}"}</code>
              <span>Read <code>name</code> from the parent item in a nested loop.</span>
              <code className="font-mono text-indigo-800">{"{{../@index}}"}</code>
              <span>Read the parent loop&apos;s zero-based position.</span>
              <code className="font-mono text-indigo-800">{"{{@index}}"}</code>
              <span>Current loop position, starting at zero.</span>
              <code className="font-mono text-indigo-800">{"{{json @first}}"}</code>
              <span>Boolean indicating whether this is the first item.</span>
              <code className="font-mono text-indigo-800">{"{{json @last}}"}</code>
              <span>Boolean indicating whether this is the last item.</span>
              <code className="font-mono text-indigo-800">{"{{request.body.company}}"}</code>
              <span>Explicitly read from the complete root request body while inside any loop.</span>
              <code className="font-mono text-indigo-800">{"{{request.pathParams.id}}"}</code>
              <span>Explicitly read a named path parameter.</span>
            </div>
          </div>

          <div className="rounded border border-indigo-200 bg-white p-3">
            <p className="font-semibold text-gray-900">When the request body is a top-level array</p>
            <p className="mt-1 text-gray-600">
              A top-level array has no field name, so start its path with <code className="font-mono">request.body</code>.
            </p>
            <div className="mt-2 grid gap-1 font-mono text-indigo-800">
              <code>{"{{request.body[0].department}}"} — department from the first item</code>
              <code>{"{{json request.body[*].department}}"} — departments from every item</code>
              <code>{"{{#each request.body}} ... {{department}} ... {{/each}}"} — loop over every item</code>
            </div>
            <p className="mt-2 text-gray-600">
              Use real objects such as <code className="font-mono">{`[{"department":"engineering"}]`}</code>.
              An escaped object inside quotation marks is a string, so fields such as <code>.department</code> cannot be read from it.
            </p>
          </div>

          <div>
            <p className="font-semibold text-gray-900">Collection loop</p>
            <p className="mt-1 text-gray-600">
              Put an each block inside a JSON array. MockingBird inserts commas between generated items automatically.
            </p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-3 text-green-300">{LOOP_RESPONSE}</pre>
          </div>

          <details>
            <summary className="cursor-pointer font-semibold text-indigo-800">Example request body</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-gray-800">{ARRAY_REQUEST}</pre>
          </details>

          <p className="rounded border border-indigo-200 bg-white p-3 text-gray-600">
            Use <code className="font-mono">json</code> outside quotation marks to preserve numbers, booleans,
            arrays, and objects. Template expressions cannot be nested inside one another; use {"{{../name}}"}
            instead of building a path with another {"{{@index}}"} expression.
          </p>
        </div>
      )}

      {previewError && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{previewError}</p>
      )}
      {preview !== null && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-900">Rendered preview</p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-xs text-emerald-800 hover:text-emerald-950"
            >
              Close
            </button>
          </div>
          <pre className="h-64 min-h-24 resize-y overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-3 text-xs text-green-300">{preview}</pre>
        </div>
      )}
    </div>
  );
}
