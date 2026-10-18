import { apiFetch as fetch } from "@/lib/api";
"use client";

import { useState } from "react";

interface EditableProjectNameProps {
  projectId: string;
  initialName: string;
  projectType?: "soap" | "rest";
  onChanged?: (name: string) => void;
}

export default function EditableProjectName({
  projectId,
  initialName,
  projectType = "soap",
  onChanged,
}: EditableProjectNameProps) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const nextName = draft.trim();
    if (!nextName) {
      setError("Project name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const resource = projectType === "rest" ? "rest-projects" : "projects";
      const response = await fetch(`/api/${resource}/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Rename failed");
        return;
      }
      setName(nextName);
      setDraft(nextName);
      setEditing(false);
      onChanged?.(nextName);
    } catch {
      setError("Rename failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800"
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={100}
          autoFocus
          className="px-3 py-1.5 border border-gray-300 rounded text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={saveName}
          disabled={saving}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setError(null);
            setEditing(false);
          }}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
