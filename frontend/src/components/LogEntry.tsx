"use client";

import AnimatedDisclosure from "@/components/AnimatedDisclosure";
import { useState } from "react";
import { RequestLog } from "@/lib/types";

interface LogEntryProps {
  log: RequestLog;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatXml(xml: string): string {
  // If it doesn't look like XML, return as-is
  if (!xml.trim().startsWith("<")) return xml;

  try {
    let formatted = "";
    let indent = 0;
    const parts = xml.replace(/>\s*</g, ">\n<").split("\n");

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Decrease indent for closing tags
      if (trimmed.startsWith("</")) {
        indent = Math.max(0, indent - 1);
      }

      formatted += "  ".repeat(indent) + trimmed + "\n";

      // Increase indent for opening tags (not self-closing, not closing, not declarations)
      if (
        trimmed.startsWith("<") &&
        !trimmed.startsWith("</") &&
        !trimmed.startsWith("<?") &&
        !trimmed.startsWith("<!--") &&
        !trimmed.endsWith("/>") &&
        // Don't indent if tag has content and closes on same line
        !(trimmed.includes("</") && !trimmed.startsWith("</"))
      ) {
        indent++;
      }
    }

    return formatted.trimEnd();
  } catch {
    return xml;
  }
}

export default function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                log.matched ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="font-medium text-sm text-gray-900">
              {log.operationName || "No match"}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(log.timestamp).toLocaleString()}
          </span>
        </div>
      </button>

      <AnimatedDisclosure open={expanded}>{() => (
        <div className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Request Headers
            </h4>
            <pre className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-auto whitespace-pre-wrap resize-y min-h-[80px] max-h-[300px]">
              {JSON.stringify(log.requestHeaders, null, 2)}
            </pre>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Request Body
            </h4>
            {log.requestBodyTruncated && (
              <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This request was {formatBytes(log.requestBodySizeBytes ?? 0)}. It was too large to log in full, so only a preview is shown.
              </p>
            )}
            <pre className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-auto whitespace-pre-wrap resize-y min-h-[100px] max-h-[400px]">
              {formatXml(log.requestBody)}
            </pre>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Response Body
            </h4>
            <pre className="text-xs font-mono bg-gray-50 p-3 rounded border border-gray-200 overflow-auto whitespace-pre-wrap resize-y min-h-[100px] max-h-[400px]">
              {formatXml(log.responseBody)}
            </pre>
          </div>
        </div>
      )}</AnimatedDisclosure>
    </div>
  );
}
