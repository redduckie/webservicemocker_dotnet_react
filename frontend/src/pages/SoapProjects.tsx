import { apiFetch as fetch } from "@/lib/api";
"use client";

import PageLoading from "@/components/PageLoading";
import { useState } from "react";
import Link from "@/components/AppLink";
import WsdlUpload from "@/components/soap-mock/WsdlUpload";
import ProjectAvailability from "@/components/ProjectAvailability";
import { useAppStore } from "@/lib/app-store";

export default function SoapDashboard() {
  const projects = useAppStore((state) => state.projects);
  const loaded = useAppStore((state) => state.loaded);
  const loadError = useAppStore((state) => state.loadError);
  const removeProject = useAppStore((state) => state.removeProject);
  const patchProject = useAppStore((state) => state.patchProject);
  const [search, setSearch] = useState("");

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;

    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    removeProject(id);
  }

  function copyMockUrl(mockUrl: string) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}${mockUrl}`);
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
        <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-2">SOAP Mock Server</h1>
        <p className="text-gray-600">
          Upload a WSDL file to generate mock SOAP endpoints instantly.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload WSDL</h2>
        <WsdlUpload />
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">SOAP Projects</h2>
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
          <p className="text-gray-500">No SOAP projects yet. Upload a WSDL to get started.</p>
        ) : filteredProjects.length === 0 ? (
          <p className="text-gray-500">No SOAP projects match your search.</p>
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
                        href={`/project/${project.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {project.name}
                      </Link>
                      <ProjectAvailability
                        projectId={project.id}
                        projectType="soap"
                        initialEnabled={project.enabled}
                        onChanged={(enabled) => patchProject(project.id, { enabled })}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {project.operations.length} operation{project.operations.length !== 1 ? "s" : ""} &middot;{" "}
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {project.mockUrl}
                      </code>
                      <button
                        onClick={() => copyMockUrl(project.mockUrl)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/project/${project.id}/logs`}
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
