"use client";

import { useEffect, useRef } from "react";

interface UnsavedChangesDialogProps {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
  title?: string;
  description?: string;
}

export default function UnsavedChangesDialog({ open, onStay, onDiscard, title = "Unsaved changes", description = "Your changes have not been saved. Discard them and continue?" }: UnsavedChangesDialogProps) {
  const stayButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    stayButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onStay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onStay(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg text-amber-800">!</span>
          <div>
            <h2 id="unsaved-title" className="text-lg font-semibold text-gray-900">{title}</h2>
            <p id="unsaved-description" className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={stayButton} type="button" onClick={onStay} className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Keep editing</button>
          <button type="button" onClick={onDiscard} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Discard changes</button>
        </div>
      </section>
    </div>
  );
}
