"use client";

import { useState } from "react";
import type { KeyboardEventHandler } from "react";

interface CodeTextareaProps {
  id?: string;
  name?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  errorLine?: number | null;
  ariaLabel: string;
  fillHeight?: boolean;
}

const LINE_HEIGHT_PX = 20;
const TOP_PADDING_PX = 12;

export default function CodeTextarea({
  id,
  name,
  autoComplete,
  value,
  onChange,
  onKeyDown,
  rows = 8,
  placeholder,
  required,
  errorLine,
  ariaLabel,
  fillHeight = false,
}: CodeTextareaProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const lineCount = Math.max(1, value.split("\n").length);
  const visibleErrorLine = errorLine && errorLine <= lineCount ? errorLine : null;

  return (
    <div className={`relative overflow-hidden rounded border bg-gray-50 focus-within:ring-2 ${fillHeight ? "h-full min-h-0" : ""} ${
      visibleErrorLine
        ? "border-red-400 focus-within:ring-red-400"
        : "border-gray-300 focus-within:ring-indigo-500"
    }`}>
      {visibleErrorLine && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-12 right-0 z-0 bg-red-100/80"
          style={{
            height: LINE_HEIGHT_PX,
            top: TOP_PADDING_PX + (visibleErrorLine - 1) * LINE_HEIGHT_PX - scrollTop,
          }}
        />
      )}

      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-20 w-12 overflow-hidden border-r border-gray-200 bg-gray-100 py-3 text-right font-mono text-xs leading-5 text-gray-400">
        <div style={{ transform: `translateY(-${scrollTop}px)` }}>
          {Array.from({ length: lineCount }, (_, index) => {
            const line = index + 1;
            return (
              <div
                key={line}
                className={`h-5 pr-2 ${line === visibleErrorLine ? "bg-red-200 font-semibold text-red-700" : ""}`}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>

      <textarea
        id={id}
        name={name}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        aria-invalid={visibleErrorLine ? true : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        rows={rows}
        placeholder={placeholder}
        required={required}
        wrap="off"
        spellCheck={false}
        className={`relative z-10 block w-full border-0 bg-transparent py-3 pl-14 pr-3 font-mono text-xs leading-5 outline-none ${fillHeight ? "h-full min-h-0 resize-none" : "resize-y"}`}
      />
    </div>
  );
}
