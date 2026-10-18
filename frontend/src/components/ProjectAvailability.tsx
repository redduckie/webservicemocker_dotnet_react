import { apiFetch as fetch } from "@/lib/api";
"use client";

import { useState } from "react";

interface ProjectAvailabilityProps {
  projectId: string;
  projectType: "soap" | "rest";
  initialEnabled?: boolean;
  onChanged?: (enabled: boolean) => void;
}

export default function ProjectAvailability({
  projectId,
  projectType,
  initialEnabled,
  onChanged,
}: ProjectAvailabilityProps) {
  const [enabled, setEnabled] = useState(initialEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function toggleAvailability() {
    setSaving(true);
    setError(false);
    const nextEnabled = !enabled;

    try {
      const resource = projectType === "soap" ? "projects" : "rest-projects";
      const response = await fetch(`/api/${resource}/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });

      if (!response.ok) {
        setError(true);
        return;
      }
      setEnabled(nextEnabled);
      onChanged?.(nextEnabled);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
          enabled
            ? "border-green-300 bg-green-100 text-green-800"
            : "border-gray-300 bg-gray-100 text-gray-700"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            enabled ? "bg-green-500 shadow-sm shadow-green-400" : "bg-gray-400"
          }`}
        />
        {enabled ? "Active" : "Paused"}
      </span>
      <button
        type="button"
        onClick={toggleAvailability}
        disabled={saving}
        className={`rounded px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 ${
          enabled
            ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border border-green-600 bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {saving ? "Saving..." : enabled ? "Pause mock" : "Activate mock"}
      </button>
      {error && <span className="text-xs text-red-600">Update failed</span>}
    </div>
  );
}
