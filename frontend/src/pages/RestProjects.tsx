import { apiFetch as fetch } from "@/lib/api";
"use client";

import PageLoading from "@/components/PageLoading";
import { useState } from "react";
import Link from "@/components/AppLink";
import { useRouter } from "@/routing";
import ProjectAvailability from "@/components/ProjectAvailability";
import { useAppStore } from "@/lib/app-store";

export default function RestDashboard() {
  const router = useRouter();
  const projects = useAppStore((state) => state.restProjects);
  const loaded = useAppStore((state) => state.loaded);
  const loadError = useAppStore((state) => state.loadError);
  const addRestProject = useAppStore((state) => state.addRestProject);
  const removeRestProject = useAppStore((state) => state.removeRestProject);
  const patchRestProject = useAppStore((state) => state.patchRestProject);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [importProject, setImportProject] = useState<unknown | null>(null);
  const [importName, setImportName] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/rest-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const project = await res.json();
        addRestProject(project);
        setName("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this REST project?")) return;
    await fetch(`/api/rest-projects/${id}`, { method: "DELETE" });
    removeRestProject(id);
  }

  function copyMockUrl(mockBaseUrl: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}${mockBaseUrl}`);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportProject(null);
    if (file.size > 2 * 1024 * 1024) {
      setImportError("Project imports are limited to 2 MB.");
      event.target.value = "";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as { name?: unknown };
      setImportProject(parsed);
      setImportFileName(file.name);
      setImportName(typeof parsed.name === "string" && parsed.name.trim()
        ? `${parsed.name.trim()} (Imported)`
        : "Imported REST Project");
    } catch {
      setImportError("Choose a valid JSON project export file.");
      event.target.value = "";
    }
  }

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    if (!importProject || !importName.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/rest-projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: importProject, name: importName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Unable to import project.");
        return;
      }
      addRestProject(data);
      router.push(`/rest-project/${data.id}`);
    } catch {
      setImportError("Unable to import project.");
    } finally {
      setImporting(false);
    }
  }

  function cancelImport() {
    setImportProject(null);
    setImportName("");
    setImportFileName("");
    setImportError(null);
  }

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Back to Home
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-2">REST API Mock Server</h1>
        <p className="text-gray-600">
          Create REST API mock projects and define endpoints with custom responses.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New REST Project</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name (e.g. Payment API)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </form>

        <div className="my-5 border-t border-gray-200" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Import REST Project</h3>
            <p className="text-xs text-gray-500">Import a MockingBird JSON template as a new, paused project.</p>
          </div>
          <label className="cursor-pointer rounded bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
            Choose JSON File
            <input type="file" accept="application/json,.json" onChange={handleImportFile} className="sr-only" />
          </label>
        </div>

        {importProject !== null && (
          <form onSubmit={handleImport} className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-4">
            <p className="mb-3 text-xs text-indigo-700">Selected: {importFileName}</p>
            <label className="block text-xs font-medium text-gray-700 mb-1">Imported Project Name</label>
            <div className="flex flex-wrap gap-3">
              <input
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
                maxLength={200}
                required
                className="min-w-64 flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={importing || !importName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import Project"}
              </button>
              <button type="button" onClick={cancelImport} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        )}
        {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">REST Projects</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects"
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {!loaded && !loadError ? (
          <PageLoading />
        ) : loadError ? (
          <p className="text-red-600">{loadError}</p>
        ) : projects.length === 0 ? (
          <p className="text-gray-500">No REST projects yet. Create one above to get started.</p>
        ) : filteredProjects.length === 0 ? (
          <p className="text-gray-500">No REST projects match your search.</p>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/rest-project/${project.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {project.name}
                      </Link>
                      <ProjectAvailability
                        projectId={project.id}
                        projectType="rest"
                        initialEnabled={project.enabled}
                        onChanged={(enabled) => patchRestProject(project.id, { enabled })}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {project.endpoints.length} endpoint{project.endpoints.length !== 1 ? "s" : ""} &middot;{" "}
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {project.mockBaseUrl}
                      </code>
                      <button
                        onClick={() => copyMockUrl(project.mockBaseUrl)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/rest-project/${project.id}/logs`}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                    >
                      Logs
                    </Link>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
