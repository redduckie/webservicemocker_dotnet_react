"use client";

import PageLoading from "@/components/PageLoading";
import Link from "@/components/AppLink";
import { useAppStore } from "@/lib/app-store";

export default function HomePage() {
  const features = useAppStore((state) => state.features);
  const loaded = useAppStore((state) => state.loaded);
  const loadError = useAppStore((state) => state.loadError);

  if (loadError) return <p className="text-red-600">{loadError}</p>;
  if (!loaded || !features) return <PageLoading />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Mocking Bird</h1>
        <p className="text-gray-600">
          Create mock servers for your SOAP and REST API web services in seconds. Choose a type below to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {features.soapMock && <Link
          href="/soap"
          className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                SOAP Mock Server
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload a WSDL file or URL to auto-generate mock SOAP endpoints. Supports template variables, editable responses, and live request logging.
              </p>
              <span className="inline-block mt-3 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">
                Get started &rarr;
              </span>
            </div>
          </div>
        </Link>}

        {features.restMock && <Link
          href="/rest"
          className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-green-300 transition-all p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                REST API Mock Server
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Define REST endpoints with custom request/response JSON. Supports path parameters, template variables, and live logging.
              </p>
              <span className="inline-block mt-3 text-sm font-medium text-green-600 group-hover:text-green-800">
                Get started &rarr;
              </span>
            </div>
          </div>
        </Link>}

        {features.requestCollections && <Link
          href="/request-collections"
          className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-amber-300 transition-all p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.868v4.264a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-amber-700 transition-colors">
                Request Collections
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Organize private REST and SOAP requests into collections, run them, and inspect formatted responses.
              </p>
              <span className="inline-block mt-3 text-sm font-medium text-amber-700 group-hover:text-amber-900">
                Open collections &rarr;
              </span>
            </div>
          </div>
        </Link>}
      </div>
      {!features.soapMock && !features.restMock && !features.requestCollections && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No features are enabled for your account. Contact an administrator for access.
        </p>
      )}
    </div>
  );
}
