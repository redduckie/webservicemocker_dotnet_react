import { apiFetch as fetch } from "@/lib/api";
"use client";

import { useState } from "react";
import { useRouter } from "@/routing";
import { useAppStore } from "@/lib/app-store";

export default function WsdlUpload() {
  const router = useRouter();
  const addProject = useAppStore((state) => state.addProject);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const file = formData.get("wsdl") as File;
    const wsdlUrl = String(formData.get("wsdlUrl") || "").trim();

    if ((!file || file.size === 0) && !wsdlUrl) {
      setError("Please select a WSDL file or enter a WSDL URL");
      setUploading(false);
      return;
    }

    try {
      const res = await fetch("/api/wsdl/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const project = await res.json();
      addProject(project);
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="soap-project-name" className="block text-sm font-medium text-gray-700 mb-1">
          Project name <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="soap-project-name"
          name="projectName"
          type="text"
          maxLength={100}
          placeholder="Uses the WSDL service name when left blank"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="space-y-3">
        <label className="flex-1">
          <input
            type="file"
            name="wsdl"
            accept=".wsdl,.xml"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase text-gray-400">or</span>
          <input
            type="url"
            name="wsdlUrl"
            placeholder="https://example.com/service?wsdl"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {uploading ? "Creating..." : "Create SOAP mock"}
        </button>
        </div>
      </div>
      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
    </form>
  );
}
