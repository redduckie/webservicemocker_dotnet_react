"use client";

import { useState } from "react";
import {
  renderRestResponseTemplate,
  validateRestResponseTemplate,
} from "@/lib/rest-template";

interface SoapTemplateToolsProps {
  requestXml: string;
  responseXml: string;
  onPreviewError?: (message: string | null) => void;
}

const SOAP_LOOP_EXAMPLE = `<departments>
  {{#each department}}
  <department>
    <position>{{@index}}</position>
    <name>{{name}}</name>
    <company>{{../company}}</company>
  </department>
  {{/each}}
</departments>`;

export default function SoapTemplateTools({
  requestXml,
  responseXml,
  onPreviewError,
}: SoapTemplateToolsProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function handlePreview() {
    setPreview(null);
    setPreviewError(null);
    onPreviewError?.(null);
    const options = {
      template: responseXml,
      requestBody: requestXml,
      requestContentType: "application/xml" as const,
      responseContentType: "application/xml" as const,
      includeDescendantAliases: true,
    };
    const validationError = validateRestResponseTemplate(options);
    if (validationError) {
      setPreviewError(validationError);
      onPreviewError?.(validationError);
      return;
    }
    try {
      setPreview(renderRestResponseTemplate(options));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to preview SOAP response";
      setPreviewError(message);
      onPreviewError?.(message);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowHelp((current) => !current)}
          className="rounded bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          {showHelp ? "Hide SOAP Template Help" : "SOAP Template Help"}
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
        <div className="space-y-3 rounded border border-indigo-200 bg-indigo-50 p-4 text-xs text-gray-700">
          <div className="grid gap-1 font-mono text-indigo-800">
            <code>{"{{name}}"} — any uniquely named request field</code>
            <code>{"{{#each item}} ... {{/each}}"} — repeat for every &lt;item&gt; element</code>
            <code>{"{{field}}"} — field on the current repeated element</code>
            <code>{"{{../field}}"} — field on its parent element</code>
            <code>{"{{@index}}"} — zero-based position in the current loop</code>
            <code>{"{{Envelope.Body.Operation.items.item[0].name}}"} — explicit path when names are ambiguous</code>
          </div>
          <p>Namespace prefixes are removed when resolving paths. For repeating XML elements, loop over the repeated element name.</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-3 text-green-300">{SOAP_LOOP_EXAMPLE}</pre>
        </div>
      )}

      {previewError && <p className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{previewError}</p>}
      {preview !== null && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-900">Rendered SOAP response</p>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-emerald-800 hover:text-emerald-950">Close</button>
          </div>
          <pre className="h-64 min-h-24 resize-y overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-3 text-xs text-green-300">{preview}</pre>
        </div>
      )}
    </div>
  );
}
