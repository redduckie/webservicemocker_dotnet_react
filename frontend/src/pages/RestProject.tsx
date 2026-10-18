import { apiFetch as fetch } from "@/lib/api";
"use client";

import PageLoading from "@/components/PageLoading";
import { useState } from "react";
import { useParams } from "@/routing";
import Link from "@/components/AppLink";
import RestEndpointCard from "@/components/rest-mock/RestEndpointCard";
import NewRestEndpointForm from "@/components/rest-mock/NewRestEndpointForm";
import ProjectAvailability from "@/components/ProjectAvailability";
import EditableProjectName from "@/components/EditableProjectName";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { useAppStore } from "@/lib/app-store";
import { useDirtyEditorsGuard } from "@/hooks/useDirtyEditorsGuard";

export default function RestProjectPage() {
  const id = useParams().id as string;
  const project = useAppStore((state) => state.restProjects.find((item) => item.id === id));
  const loaded = useAppStore((state) => state.loaded);
  const loadError = useAppStore((state) => state.loadError);
  const apiKey = useAppStore((state) => state.apiKey);
  const setApiKey = useAppStore((state) => state.setApiKey);
  const addRestEndpoint = useAppStore((state) => state.addRestEndpoint);
  const patchRestProject = useAppStore((state) => state.patchRestProject);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [rotatingApiKey, setRotatingApiKey] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const { setEditorDirty, requestAction, dialogProps } = useDirtyEditorsGuard();

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
      const response = await fetch("/api/auth/api-key", { method: "POST" });
      if (!response.ok) throw new Error("Unable to rotate API key");
      setApiKey((await response.json()).apiKey);
    } finally {
      setRotatingApiKey(false);
    }
  }

  if (!loaded && !loadError) return <PageLoading />;
  if (loadError) return <p className="text-red-600">{loadError}</p>;
  if (!project) return <p className="text-red-600">Project not found</p>;

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <Link href="/rest" className="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back to REST Projects</Link>
        <div className="mt-2 flex items-center gap-3">
          <EditableProjectName projectId={project.id} initialName={project.name} projectType="rest" onChanged={(name) => patchRestProject(project.id, { name })} />
          <ProjectAvailability projectId={project.id} projectType="rest" initialEnabled={project.enabled} onChanged={(enabled) => patchRestProject(project.id, { enabled })} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <a href={`/api/rest-projects/${id}/export`} className="rounded bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100">Export JSON</a>
        <Link href={`/rest-project/${id}/logs`} className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">View Logs</Link>
      </div>
    </div>

    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-700">Mock Base URL</p>
      <code className="mt-1 inline-block rounded bg-gray-100 px-2 py-1 text-sm text-gray-900">{process.env.NEXT_PUBLIC_BASE_URL || ""}{project.mockBaseUrl}</code>
    </div>

    {apiKey && <div className="api-key-panel rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-medium text-amber-800">Your API Key (for this session)</p><code className="mt-1 inline-block rounded bg-amber-100 px-2 py-1 font-mono text-sm text-amber-900">{apiKey}</code><div className="mt-2 space-y-1 text-xs text-amber-700"><p><strong>Basic:</strong> username <code className="rounded bg-amber-100 px-1">mock</code>, password is the API key.</p><p><strong>Bearer:</strong> <code className="rounded bg-amber-100 px-1">Authorization: Bearer {'<API key>'}</code></p></div></div>
        <div className="flex flex-col gap-2"><button onClick={handleCopyApiKey} className="rounded bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700">{apiKeyCopied ? "Copied!" : "Copy API Key"}</button><button onClick={handleRotateApiKey} disabled={rotatingApiKey} className="rounded border border-amber-300 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-50">{rotatingApiKey ? "Rotating..." : "Rotate API Key"}</button></div>
      </div>
    </div>}

    <section>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Endpoints ({project.endpoints.length})</h2><button onClick={() => showAddForm ? requestAction(() => setShowAddForm(false)) : setShowAddForm(true)} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">{showAddForm ? "Cancel" : "+ Add Endpoint"}</button></div>
      {showAddForm && <NewRestEndpointForm projectId={id} onCreated={(endpoint) => addRestEndpoint(id, endpoint)} onCancel={() => setShowAddForm(false)} onDirtyChange={setEditorDirty} />}
      <div className="space-y-3">{project.endpoints.map((endpoint) => <RestEndpointCard key={endpoint.id} projectId={project.id} endpoint={endpoint} mockBaseUrl={project.mockBaseUrl} apiKey={apiKey} onDirtyChange={setEditorDirty} />)}</div>
    </section>
    <UnsavedChangesDialog {...dialogProps} title="Unsaved REST endpoint changes" description="One or more REST endpoints have unsaved request or response changes. Discard them and continue?" />
  </div>;
}
