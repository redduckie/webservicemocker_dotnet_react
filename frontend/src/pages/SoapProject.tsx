import { apiFetch as fetch } from "@/lib/api";
"use client";

import PageLoading from "@/components/PageLoading";
import { useState } from "react";
import { useParams } from "@/routing";
import Link from "@/components/AppLink";
import OperationCard from "@/components/soap-mock/OperationCard";
import ProjectAvailability from "@/components/ProjectAvailability";
import EditableProjectName from "@/components/EditableProjectName";
import { useAppStore } from "@/lib/app-store";
import { useDirtyEditorsGuard } from "@/hooks/useDirtyEditorsGuard";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const project = useAppStore((state) => state.projects.find((item) => item.id === id));
  const loaded = useAppStore((state) => state.loaded);
  const loadError = useAppStore((state) => state.loadError);
  const apiKey = useAppStore((state) => state.apiKey);
  const setApiKey = useAppStore((state) => state.setApiKey);
  const patchProject = useAppStore((state) => state.patchProject);
  const [copied, setCopied] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [rotatingApiKey, setRotatingApiKey] = useState(false);
  const { setEditorDirty, dialogProps } = useDirtyEditorsGuard();

  function handleCopyUrl() {
    if (!project) return;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}${project.mockUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyApiKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  async function handleRotateApiKey() {
    if (!confirm("Rotate your API key? The current key will stop working immediately for every SOAP and REST mock integration.")) return;
    setRotatingApiKey(true);
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST" });
      if (!res.ok) throw new Error("Unable to rotate API key");
      const data = await res.json();
      setApiKey(data.apiKey);
    } finally {
      setRotatingApiKey(false);
    }
  }

  if (!loaded && !loadError) return <PageLoading />;
  if (loadError) return <p className="text-red-600">{loadError}</p>;
  if (!project) return <p className="text-red-600">Project not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/soap" className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; Back to SOAP Projects
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <EditableProjectName
              projectId={project.id}
              initialName={project.name}
              onChanged={(name) => patchProject(project.id, { name })}
            />
            <ProjectAvailability
              projectId={project.id}
              projectType="soap"
              initialEnabled={project.enabled}
              onChanged={(enabled) => patchProject(project.id, { enabled })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/project/${id}/logs`}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
          >
            View Logs
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Mock Endpoint</p>
            <code className="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
              POST {project.mockUrl}
            </code>
          </div>
          <button
            onClick={handleCopyUrl}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
          >
            {copied ? "Copied!" : "Copy Mock URL"}
          </button>
        </div>
      </div>

      {apiKey && (
        <div className="api-key-panel bg-amber-50 rounded-lg border border-amber-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">Your API Key (for this session)</p>
              <code className="text-sm text-amber-900 bg-amber-100 px-2 py-1 rounded mt-1 inline-block font-mono">
                {apiKey}
              </code>
              <div className="mt-2 space-y-1 text-xs text-amber-700">
                <p><strong>Basic:</strong> username <code className="rounded bg-amber-100 px-1">mock</code>, password is the API key.</p>
                <p><strong>Bearer:</strong> <code className="rounded bg-amber-100 px-1">Authorization: Bearer {'<API key>'}</code></p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCopyApiKey}
                className="px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
              >
                {apiKeyCopied ? "Copied!" : "Copy API Key"}
              </button>
              <button
                onClick={handleRotateApiKey}
                disabled={rotatingApiKey}
                className="px-4 py-2 border border-amber-300 text-amber-800 text-sm rounded hover:bg-amber-100 disabled:opacity-50"
              >
                {rotatingApiKey ? "Rotating..." : "Rotate API Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Operations ({project.operations.length})
        </h2>
        <div className="space-y-3">
          {project.operations.map((op) => (
            <OperationCard
              key={op.name}
              projectId={project.id}
              operation={op}
              mockUrl={project.mockUrl}
              apiKey={apiKey}
              onDirtyChange={setEditorDirty}
            />
          ))}
        </div>
      </div>
      <UnsavedChangesDialog {...dialogProps} title="Unsaved SOAP operation changes" description="One or more SOAP operations have unsaved request or response changes. Discard them and continue?" />
    </div>
  );
}
