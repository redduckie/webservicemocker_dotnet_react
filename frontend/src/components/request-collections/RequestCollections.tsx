import { apiFetch as fetch } from "@/lib/api";
"use client";

import CollectionVariables from "./CollectionVariables";
import PageLoading from "@/components/PageLoading";
import CollapsibleCard from "./CollapsibleCard";
import { replaceVariables, runRequestScript } from "@/lib/tester-scripts";
import { parseVariables } from "@/lib/tester-collections";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "@/routing";
import { useAppStore } from "@/lib/app-store";
import { getCollectionClient } from "@/lib/tester-collection-client";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import RequestCollectionDashboard from "@/components/request-collections/CollectionDashboard";
import RequestCollectionSidebar from "@/components/request-collections/CollectionSidebar";
import TesterResponsePanel, { type TesterResponse } from "@/components/request-collections/ResponsePanel";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import WsdlLoader from "@/components/request-collections/WsdlLoader";
import HttpRequestEditor from "@/components/request-collections/HttpRequestEditor";
import { basicAuthorization, createDraft, createHeader, type DraftCollection } from "@/components/request-collections/drafts";
import { useRequestEditorController } from "@/components/request-collections/useRequestEditorController";
import { useRequestCollectionController } from "@/components/request-collections/useRequestCollectionController";

import { exportCollection, parseCollectionFile, type TesterMode, type WsdlOperation, type RequestDraft, type CollectionSummary, type RequestCollection } from "@/lib/tester-collections";

interface ExecuteRequestInput {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

async function testerCapabilityHeaders(): Promise<Record<string, string>> {
  await useAppStore.getState().load();
  const capability = useAppStore.getState().testerCapability;
  if (!capability) throw new Error("Tester session expired. Reload the page.");
  return { "X-MockingBird-Tester-Capability": capability };
}

export default function RequestCollections({ initialCollectionId = "" }: { initialCollectionId?: string }) {
  const router = useRouter();
  const [collectionRouteLoading, setCollectionRouteLoading] = useState(Boolean(initialCollectionId));
  const searchParams = useSearchParams();
  const [presetLoading, setPresetLoading] = useState(!initialCollectionId && Boolean(searchParams.get("projectId")));
  const initialized = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const resetSavedBaselineAfterRender = useRef(false);
  const initialMode = searchParams.get("mode") === "soap" ? "soap" : "rest";
  const editor = useRequestEditorController(initialMode);
  const { mode, url, method, headers, body, authType, token, username, password, apiKeyName, wsdlUrl, wsdlName, operations, selectedOperation } = editor.state;
  const { setMode, setUrl, setMethod, setHeaders, setBody, setAuthType, setToken, setUsername, setPassword, setApiKeyName, setWsdlUrl, setWsdlName, setOperations, setSelectedOperation } = editor;
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sensitiveVariables, setSensitiveVariables] = useState<string[]>([]);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TesterResponse | null>(null);
  const [wsdlLoading, setWsdlLoading] = useState(false);
  const [requestListOpen, setRequestListOpen] = useState(true);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const placeholderDraftIds = useRef(new Set<string>());
  const initialDrafts = useRef<DraftCollection>(null!);
  if (!initialDrafts.current) {
    const rest = createDraft("rest", 1);
    const soap = createDraft("soap", 1);
    placeholderDraftIds.current = new Set([rest.id, soap.id]);
    initialDrafts.current = {
      tabs: { rest: [rest], soap: [soap] },
      activeIds: { rest: rest.id, soap: soap.id },
    };
  }
  const collectionController = useRequestCollectionController(initialDrafts.current, initialMode, Boolean(searchParams.get("projectId")));
  const { draftTabs, activeDraftIds, draftStorageReady, savedStateSignature, saveConfirmation, collections, collectionId, collectionName, collectionMode, collectionRevision, collectionBusy, collectionError, requestFilter, collectionSearch, workspaceOpen } = collectionController.state;
  const { setDraftTabs, setActiveDraftIds, setDraftStorageReady, setSavedStateSignature, setSaveConfirmation, setCollections, setCollectionId, setCollectionName, setCollectionMode, setCollectionRevision, setCollectionBusy, setCollectionError, setRequestFilter, setCollectionSearch, setWorkspaceOpen, patchCollectionState } = collectionController;

  useEffect(() => () => abortController.current?.abort(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = await collectionClient();
        const list = await client.list();
        if (cancelled) return;
        setCollections(list);
        if (initialCollectionId) {
          const collection = await client.get(initialCollectionId);
          if (cancelled) return;
          applyCollection(collection);
        }
      } catch (error) {
        if (!cancelled) setCollectionError(error instanceof Error ? error.message : "Unable to load collections.");
      } finally {
        if (!cancelled) { setDraftStorageReady(true); setCollectionBusy(false); setCollectionRouteLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [initialCollectionId]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const projectId = searchParams.get("projectId");
    if (!projectId || initialCollectionId) return;

    async function loadProjectPreset() {
      setError(null);
      const selectedMode = searchParams.get("mode") === "soap" ? "soap" : "rest";
      await useAppStore.getState().load();
      const appData = useAppStore.getState();
      setCollectionMode(selectedMode);
      setWorkspaceOpen(true);
      editor.patchEditor({ mode: selectedMode, ...(appData.apiKey ? { authType: "bearer", token: appData.apiKey } : {}) });

      if (selectedMode === "soap") {
        const project = appData.projects.find((item) => item.id === projectId);
        if (!project) {
          setError("Unable to load the selected project.");
          return;
        }
        const operationName = searchParams.get("operation");
        const operation = project.operations.find(
          (item: WsdlOperation) => item.name === operationName
        );
        const presetUrl = `${window.location.origin}${project.mockUrl}`;
        editor.patchEditor({
          mode: "soap", method: "POST", url: presetUrl,
          headers: [createHeader("Content-Type", "text/xml; charset=utf-8"), createHeader("SOAPAction", operation?.soapAction || "")],
          body: operation?.requestXml || "",
        });
      } else {
        const project = appData.restProjects.find((item) => item.id === projectId);
        if (!project) {
          setError("Unable to load the selected project.");
          return;
        }
        const endpointId = searchParams.get("endpointId");
        const endpoint = project.endpoints.find(
          (item: { id: string }) => item.id === endpointId
        );
        if (!endpoint) {
          setError("Unable to find the selected REST endpoint.");
          return;
        }
        const presetUrl = `${window.location.origin}${project.mockBaseUrl}${endpoint.path}`;
        editor.patchEditor({
          mode: "rest", method: endpoint.method, url: presetUrl,
          headers: [createHeader("Content-Type", endpoint.requestContentType || "application/json")],
          body: endpoint.requestBodyExample || "",
        });
      }
    }

    loadProjectPreset()
      .catch(() => setError("Unable to load the request preset."))
      .finally(() => setPresetLoading(false));
  }, [searchParams]);

  function snapshotCurrentDraft(): RequestDraft {
    const currentId = activeDraftIds[mode];
    const existing = draftTabs[mode].find((draft) => draft.id === currentId);
    return {
      id: currentId,
      name: existing?.name || `${mode === "rest" ? "REST" : "SOAP"} request`,
      mode,
      url,
      method,
      headers,
      body,
      authType,
      token,
      username,
      password,
      apiKeyName,
      wsdlUrl,
      wsdlName,
      operations,
      selectedOperation,
      preRequestScript: editor.state.preRequestScript,
      postResponseScript: editor.state.postResponseScript,
    };
  }

  function buildCurrentDraftCollection(): DraftCollection {
    const current = snapshotCurrentDraft();
    return {
      tabs: {
        ...draftTabs,
        [mode]: draftTabs[mode].map((draft) =>
          draft.id === current.id ? current : draft
        ),
      },
      activeIds: activeDraftIds,
    };
  }

  function stateSignature(collection: DraftCollection, name = collectionName, collectionType = collectionMode): string {
    const requests = collection.tabs[collectionType].map((draft) => ({
      ...draft,
      headers: draft.headers.map(({ name: headerName, value }) => ({ name: headerName, value })),
    }));
    return JSON.stringify({ name, collectionType, requests, variables, sensitiveVariables: [...sensitiveVariables].sort() });
  }

  const currentDraftCollection = buildCurrentDraftCollection();
  const currentStateSignature = stateSignature(currentDraftCollection);
  const hasUnsavedChanges =
    draftStorageReady &&
    savedStateSignature !== null &&
    currentStateSignature !== savedStateSignature;
  const { requestAction: requestDiscard, dialogProps: unsavedChangesDialogProps } =
    useUnsavedChangesGuard(hasUnsavedChanges);

  useEffect(() => {
    if (!draftStorageReady || !resetSavedBaselineAfterRender.current) return;
    resetSavedBaselineAfterRender.current = false;
    setSavedStateSignature(currentStateSignature);
  }, [draftStorageReady, currentStateSignature, savedStateSignature]);

  async function collectionClient() {
    await useAppStore.getState().load();
    const scope = useAppStore.getState().apiKey;
    if (!scope) throw new Error("Unable to load your session. Please reload the page.");
    return getCollectionClient(scope);
  }

  function applyCollection(collection: RequestCollection) {
    setVariables(collection.variables || {});
    setSensitiveVariables(collection.sensitiveVariables ?? Object.keys(collection.variables || {}).filter(name => /token|secret|password|api.?key/i.test(name)));
    const rest = collection.requests.filter((draft) => draft.mode === "rest");
    const soap = collection.requests.filter((draft) => draft.mode === "soap");
    // Keep a blank editor available for either protocol, without persisting it until Save.
    const normalize = (draft: RequestDraft) => ({ ...draft, preRequestScript: draft.preRequestScript || "", postResponseScript: draft.postResponseScript || "", headers: draft.headers.map((header) => createHeader(header.name, header.value)) });
    const restFallback = createDraft("rest", 1);
    const soapFallback = createDraft("soap", 1);
    const tabs = { rest: (rest.length ? rest : [restFallback]).map(normalize), soap: (soap.length ? soap : [soapFallback]).map(normalize) };
    placeholderDraftIds.current = new Set([
      ...(!rest.length ? [tabs.rest[0].id] : []),
      ...(!soap.length ? [tabs.soap[0].id] : []),
    ]);
    const firstRequest = collection.requests[0]
      ? tabs[collection.mode].find((draft) => draft.id === collection.requests[0].id) || tabs[collection.mode][0]
      : tabs[collection.mode][0];
    const activeIds = { rest: tabs.rest[0].id, soap: tabs.soap[0].id, [firstRequest.mode]: firstRequest.id };
    patchCollectionState({
      draftTabs: tabs,
      activeDraftIds: activeIds,
      collectionId: collection.id,
      collectionName: collection.name,
      collectionMode: collection.mode,
      collectionRevision: collection.revision,
      saveConfirmation: false,
      requestFilter: "",
      workspaceOpen: true,
    });
    loadDraft(firstRequest);
    if (collection.id) {
      resetSavedBaselineAfterRender.current = true;
      setSavedStateSignature(null);
    } else {
      resetSavedBaselineAfterRender.current = false;
      setSavedStateSignature("unsaved-new-collection");
    }
  }

  function openCollection(id: string, refresh = false) {
    requestDiscard(() => {
      if (id === initialCollectionId) void loadCollection(id, refresh);
      else router.push(`/request-collections/${encodeURIComponent(id)}`);
    });
  }

  async function loadCollection(id: string, refresh = false) {
    setCollectionBusy(true);
    setCollectionError(null);
    try {
      const client = await collectionClient();
      const collection = await client.get(id, refresh);
      setCollections(await client.list());
      applyCollection(collection);
    } catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to load collection."); }
    finally { setCollectionBusy(false); }
  }

  async function refreshCollectionList() {
    setCollectionBusy(true);
    setCollectionError(null);
    try { setCollections(await (await collectionClient()).list(true)); }
    catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to refresh collections."); }
    finally { setCollectionBusy(false); }
  }

  function newCollection(collectionType: TesterMode) {
    requestDiscard(() => {
      const firstRequest = createDraft(collectionType, 1);
      applyCollection({ id: "", name: `New ${collectionType.toUpperCase()} collection`, mode: collectionType, revision: "", updatedAt: "", requestCount: 1, requests: [firstRequest] });
      setCollectionError(null);
    });
  }

  function closeWorkspace() {
    requestDiscard(() => {
      if (initialCollectionId) {
        router.push("/request-collections");
        return;
      }
      resetSavedBaselineAfterRender.current = false;
      patchCollectionState({ workspaceOpen: false, collectionId: "", collectionRevision: "", savedStateSignature: null, collectionError: null });
    });
  }

  function collectionRequests(collection: DraftCollection): RequestDraft[] {
    return collection.tabs[collectionMode].filter((draft) => {
      if (!placeholderDraftIds.current.has(draft.id)) return true;
      const empty = createDraft(draft.mode, 1);
      return Boolean(draft.preRequestScript || draft.postResponseScript) || draft.name !== empty.name || draft.url !== "" || draft.body !== "" || draft.authType !== "none" ||
        draft.token !== "" || draft.username !== "" || draft.password !== "" || draft.wsdlUrl !== "" ||
        draft.method !== empty.method || JSON.stringify(draft.headers.map(({ name, value }) => ({ name, value }))) !==
          JSON.stringify(empty.headers.map(({ name, value }) => ({ name, value })));
    });
  }

  async function saveTesterDrafts() {
    const collection = buildCurrentDraftCollection();
    setCollectionBusy(true);
    setCollectionError(null);
    try {
      const client = await collectionClient();
      const saved = await client.save(collectionId, collectionRevision, collectionName, collectionMode, collectionRequests(collection), variables, sensitiveVariables);
      const { requests: _requests, variables: _variables, sensitiveVariables: _sensitiveVariables, ...summary } = saved;
      patchCollectionState({
        draftTabs: collection.tabs,
        collectionId: saved.id,
        collectionRevision: saved.revision,
        collectionName: saved.name,
        collections: [summary, ...collections.filter((item) => item.id !== saved.id)],
        saveConfirmation: true,
        savedStateSignature: stateSignature(collection, saved.name, saved.mode),
      });
      resetSavedBaselineAfterRender.current = false;
      if (saved.id !== initialCollectionId) {
        router.replace(`/request-collections/${encodeURIComponent(saved.id)}`);
      }
    } catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to save collection."); }
    finally { setCollectionBusy(false); }
  }

  async function removeCollection() {
    if (!collectionId || !window.confirm(`Delete collection "${collectionName}" and all its saved requests?`)) return;
    setCollectionBusy(true);
    setCollectionError(null);
    try {
      const client = await collectionClient();
      await client.remove(collectionId, collectionRevision);
      resetSavedBaselineAfterRender.current = false;
      patchCollectionState({ collections: await client.list(), collectionId: "", collectionRevision: "", savedStateSignature: null, workspaceOpen: false });
      if (initialCollectionId) router.replace("/request-collections");
    } catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to delete collection."); }
    finally { setCollectionBusy(false); }
  }

  async function removeCollectionCard(collection: CollectionSummary) {
    if (!window.confirm(`Delete collection "${collection.name}" and all its saved requests?`)) return;
    setCollectionBusy(true);
    setCollectionError(null);
    try {
      const client = await collectionClient();
      await client.remove(collection.id, collection.revision);
      setCollections(await client.list());
    } catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to delete collection."); }
    finally { setCollectionBusy(false); }
  }

  function downloadCollection() {
    try {
      const data = exportCollection(collectionName, collectionMode, collectionRequests(buildCurrentDraftCollection()), variables, sensitiveVariables);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${collectionName.replace(/[^a-z0-9_-]/gi, "-") || "collection"}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to export collection."); }
  }

  function importCollection(file: File) {
    requestDiscard(() => { void performImportCollection(file); });
  }

  async function performImportCollection(file: File) {
    setCollectionBusy(true);
    setCollectionError(null);
    try {
      const imported = parseCollectionFile(JSON.parse(await file.text()));
      applyCollection({ ...imported, id: "", revision: "", updatedAt: "", requestCount: imported.requests.length });
    } catch (error) { setCollectionError(error instanceof Error ? error.message : "Unable to import collection."); }
    finally { setCollectionBusy(false); }
  }

  function loadDraft(draft: RequestDraft) {
    editor.loadDraft(draft);
    setScriptsOpen(false);
    setResponse(null);
    setScriptLogs([]);
    setError(null);
  }

  function switchMode(nextMode: TesterMode) {
    if (nextMode === mode) return;
    const current = snapshotCurrentDraft();
    const tabs = {
      ...draftTabs,
      [mode]: draftTabs[mode].map((draft) => draft.id === current.id ? current : draft),
    };
    setDraftTabs(tabs);
    setMode(nextMode);
    const nextDraft = tabs[nextMode].find(
      (draft) => draft.id === activeDraftIds[nextMode]
    ) || tabs[nextMode][0];
    loadDraft(nextDraft);
  }

  function switchRequestDraft(draftId: string) {
    if (draftId === activeDraftIds[mode]) return;
    const current = snapshotCurrentDraft();
    const tabs = {
      ...draftTabs,
      [mode]: draftTabs[mode].map((draft) => draft.id === current.id ? current : draft),
    };
    setDraftTabs(tabs);
    setActiveDraftIds((ids) => ({ ...ids, [mode]: draftId }));
    const nextDraft = tabs[mode].find((draft) => draft.id === draftId);
    if (nextDraft) loadDraft(nextDraft);
  }

  function addRequestDraft(nextMode: TesterMode = mode) {
    const current = snapshotCurrentDraft();
    const newDraft = createDraft(nextMode, draftTabs[nextMode].length + 1);
    setDraftTabs((tabs) => {
      const committed = {
        ...tabs,
        [mode]: tabs[mode].map((draft) => draft.id === current.id ? current : draft),
      };
      return { ...committed, [nextMode]: [...committed[nextMode], newDraft] };
    });
    setMode(nextMode);
    placeholderDraftIds.current.delete(newDraft.id);
    setActiveDraftIds((ids) => ({ ...ids, [nextMode]: newDraft.id }));
    loadDraft(newDraft);
  }

  function openRequestDraft(draft: RequestDraft) {
    if (draft.id === activeDraftIds[mode] && draft.mode === mode) return;
    const current = snapshotCurrentDraft();
    setDraftTabs((tabs) => ({
      ...tabs,
      [mode]: tabs[mode].map((item) => item.id === current.id ? current : item),
    }));
    setMode(draft.mode);
    setActiveDraftIds((ids) => ({ ...ids, [draft.mode]: draft.id }));
    loadDraft(draft);
  }

  function closeRequestDraft(draftId: string) {
    if (draftTabs[mode].length === 1) {
      const blank = createDraft(mode, 1);
      setDraftTabs((tabs) => ({ ...tabs, [mode]: [blank] }));
      setActiveDraftIds((ids) => ({ ...ids, [mode]: blank.id }));
      loadDraft(blank);
      return;
    }
    const current = snapshotCurrentDraft();
    const committed = draftTabs[mode].map((draft) => draft.id === current.id ? current : draft);
    const closingIndex = committed.findIndex((draft) => draft.id === draftId);
    const remaining = committed.filter((draft) => draft.id !== draftId);
    setDraftTabs((tabs) => ({ ...tabs, [mode]: remaining }));
    if (draftId === activeDraftIds[mode]) {
      const nextDraft = remaining[Math.min(closingIndex, remaining.length - 1)];
      setActiveDraftIds((ids) => ({ ...ids, [mode]: nextDraft.id }));
      loadDraft(nextDraft);
    }
  }

  function renameRequestDraft(draftId: string, name: string) {
    setDraftTabs((tabs) => ({
      ...tabs,
      [mode]: tabs[mode].map((draft) => draft.id === draftId ? { ...draft, name } : draft),
    }));
  }

  function buildHeaders(values: Record<string, string>): Record<string, string> {
    const expand = (value: string) => replaceVariables(value, values);
    const result: Record<string, string> = Object.create(null);
    if (authType === "bearer" && token) result.Authorization = `Bearer ${expand(token)}`;
    if (authType === "basic") result.Authorization = basicAuthorization(expand(username), expand(password));
    if (authType === "apiKey" && apiKeyName.trim() && token) result[expand(apiKeyName.trim())] = expand(token);
    return result;
  }

  function applyScriptVariables(next: Record<string, string>) {
    setVariables(next);
    const newSensitive = Object.keys(next).filter(name => !Object.hasOwn(variables, name) && /token|secret|password|api.?key/i.test(name));
    if (newSensitive.length) setSensitiveVariables(current => [...new Set([...current, ...newSensitive])]);
  }

  async function executeRequest(
    input: ExecuteRequestInput,
    signal: AbortSignal
  ): Promise<TesterResponse> {
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(input.method)) throw new Error("Unsupported request method.");
    let target: URL;
    try {
      target = new URL(input.url);
    } catch {
      throw new Error("Enter a valid absolute request URL.");
    }

    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Request URL must use HTTP or HTTPS.");

    const requestBody = input.method === "HEAD" || (input.method === "GET" && !input.body)
      ? undefined
      : input.body;

    // Browser fetch rejects GET bodies; use the server transport when one is supplied.
    const requiresServerTransport = input.method === "GET" && Boolean(requestBody);
    if (target.origin === window.location.origin && !requiresServerTransport) {
      const startedAt = performance.now();
      const result = await fetch(target.toString(), {
        method: input.method,
        headers: input.headers,
        body: requestBody,
        redirect: "manual",
        signal,
      });
      const responseBody = await result.text();
      const responseHeaders: Record<string, string> = {};
      result.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });
      return {
        status: result.status,
        statusText: result.statusText,
        headers: responseHeaders,
        body: responseBody,
        durationMs: Math.round(performance.now() - startedAt),
        sizeBytes: new Blob([responseBody]).size,
      };
    }

    const result = await fetch("/api/tester/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...await testerCapabilityHeaders(),
      },
      body: JSON.stringify({ ...input, url: target.toString(), body: requestBody }),
      signal,
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || "Request failed");
    return data as TesterResponse;
  }

  async function sendRequest() {
    setError(null);
    setResponse(null);
    const controller = new AbortController();
    abortController.current = controller;
    setSending(true);
    setScriptLogs([]);
    let stage = "Pre-request script";
    try {
      const pre = await runRequestScript(editor.state.preRequestScript, variables, {
        url, method: mode === "soap" ? "POST" : method,
        headers: Object.fromEntries(headers.filter(header => header.name.trim()).map(header => [header.name.trim(), header.value])), body,
      }, controller.signal);
      const currentVariables = parseVariables(pre.variables);
      applyScriptVariables(currentVariables);
      setScriptLogs(pre.logs);
      stage = "Request";
      const expand = (value: string) => replaceVariables(value, currentVariables);
      // Build authentication after scripts so newly generated tokens are usable.
      const authHeaders = buildHeaders(currentVariables);
      const outgoingHeaders = Object.fromEntries(Object.entries(pre.request.headers).map(([key, value]) => [expand(key), expand(value)]));
      for (const [key, value] of Object.entries(authHeaders)) {
        const existing = Object.keys(outgoingHeaders).find(name => name.toLowerCase() === key.toLowerCase());
        if (existing) delete outgoingHeaders[existing];
        outgoingHeaders[key] = value;
      }
      const outgoing = { url: expand(pre.request.url), method: pre.request.method.toUpperCase(), headers: outgoingHeaders, body: expand(pre.request.body) };
      const result = await executeRequest(outgoing, controller.signal);
      setResponse(result);
      stage = "Post-response script";
      const post = await runRequestScript(editor.state.postResponseScript, currentVariables, outgoing, controller.signal, result);
      applyScriptVariables(parseVariables(post.variables));
      setScriptLogs([...pre.logs, ...post.logs]);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        setError("Request cancelled.");
      } else {
        setError(`${stage}: ${requestError instanceof Error ? requestError.message : "Request failed."}`);
      }
    } finally {
      setSending(false);
      abortController.current = null;
    }
  }

  function applyWsdl(data: {
    name: string;
    endpointUrl?: string;
    operations: WsdlOperation[];
  }) {
    editor.patchEditor({ wsdlName: data.name, operations: data.operations, ...(data.endpointUrl ? { url: data.endpointUrl } : {}) });
    if (data.operations.length > 0) selectWsdlOperation(data.operations[0], data.operations);
  }

  function selectWsdlOperation(operation: WsdlOperation, source = operations) {
    editor.patchEditor({
      selectedOperation: operation.name,
      body: operation.requestXml || "",
      method: "POST",
      headers: [createHeader("Content-Type", "text/xml; charset=utf-8"), createHeader("SOAPAction", operation.soapAction || "")],
      ...(source.length === 0 ? { operations: [operation] } : {}),
    });
  }

  async function loadWsdlFile(file: File) {
    setWsdlLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("wsdl", file);
      const result = await fetch("/api/tester/wsdl", {
        method: "POST",
        headers: await testerCapabilityHeaders(),
        body: formData,
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Unable to load WSDL");
      applyWsdl(data);
    } catch (wsdlError) {
      setError(wsdlError instanceof Error ? wsdlError.message : "Unable to load WSDL.");
    } finally {
      setWsdlLoading(false);
    }
  }

  async function loadWsdlUrl() {
    setWsdlLoading(true);
    setError(null);
    try {
      const result = await fetch("/api/tester/wsdl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...await testerCapabilityHeaders(),
        },
        body: JSON.stringify({ url: replaceVariables(wsdlUrl, variables) }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Unable to load WSDL");
      applyWsdl(data);
    } catch (wsdlError) {
      setError(wsdlError instanceof Error ? wsdlError.message : "Unable to load WSDL.");
    } finally {
      setWsdlLoading(false);
    }
  }

  function removeRequestDraft(draft: RequestDraft) {
    const list = draftTabs[draft.mode];
    if (list.length === 1) {
      const blank = createDraft(draft.mode, 1);
      placeholderDraftIds.current.add(blank.id);
      setDraftTabs((tabs) => ({ ...tabs, [draft.mode]: [blank] }));
      setActiveDraftIds((ids) => ({ ...ids, [draft.mode]: blank.id }));
      if (draft.mode === mode) loadDraft(blank);
      return;
    }
    const index = list.findIndex((item) => item.id === draft.id);
    const remaining = list.filter((item) => item.id !== draft.id);
    setDraftTabs((tabs) => ({ ...tabs, [draft.mode]: remaining }));
    placeholderDraftIds.current.delete(draft.id);
    if (activeDraftIds[draft.mode] === draft.id) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      setActiveDraftIds((ids) => ({ ...ids, [draft.mode]: next.id }));
      if (draft.mode === mode) loadDraft(next);
    }
  }

  const visibleCollections = collections.filter((collection) =>
    collection.name.toLowerCase().includes(collectionSearch.trim().toLowerCase())
  );
  const requestsInCollection = collectionRequests(currentDraftCollection);
  const visibleRequests = requestsInCollection.filter((draft) =>
    !requestFilter || `${draft.name} ${draft.url} ${draft.method}`.toLowerCase().includes(requestFilter.toLowerCase())
  );

  if (presetLoading) return <PageLoading label="Loading request..." />;
  if (collectionRouteLoading) return <p role="status" className="text-gray-500">Loading collection...</p>;

  if (initialCollectionId && !workspaceOpen) {
    return <div className="space-y-3">
      <button type="button" onClick={() => router.push("/request-collections")} className="text-sm text-indigo-600 hover:text-indigo-800">&larr; All Request Collections</button>
      <p role="alert" className="text-red-700">{collectionError || "Unable to load collection."}</p>
      <button type="button" onClick={() => void loadCollection(initialCollectionId, true)} disabled={collectionBusy} className="text-sm text-indigo-600 disabled:opacity-50">{collectionBusy ? "Loading..." : "Try again"}</button>
    </div>;
  }

  if (!workspaceOpen) {
    return (
      <RequestCollectionDashboard
        collections={collections}
        visibleCollections={visibleCollections}
        search={collectionSearch}
        busy={collectionBusy}
        error={collectionError}
        onSearchChange={setCollectionSearch}
        onNewCollection={newCollection}
        onImport={importCollection}
        onRefresh={refreshCollectionList}
        onOpen={openCollection}
        onDelete={removeCollectionCard}
      />
    );
  }

  return (
    <>
    <fieldset disabled={collectionBusy || sending} className="request-collection-workspace min-w-0 space-y-3">
      {sending && <legend><button type="button" onClick={() => abortController.current?.abort()} className="rounded border border-red-300 px-3 py-2 text-sm text-red-700">Cancel request</button></legend>}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button type="button" onClick={closeWorkspace} className="text-sm text-indigo-600 hover:text-indigo-800">&larr; All Request Collections</button>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{collectionName || "New collection"}</h1>
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`rounded px-1.5 py-0.5 font-bold uppercase ${collectionMode === "soap" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{collectionMode}</span>
            <span>{requestsInCollection.length} request{requestsInCollection.length === 1 ? "" : "s"} in this collection</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-sm font-medium text-amber-700">Unsaved changes</span>
          )}
          <button
            type="button"
            onClick={saveTesterDrafts}
            disabled={collectionBusy || !collectionName.trim() || (!hasUnsavedChanges && Boolean(collectionId))}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              (hasUnsavedChanges || !collectionId)
                ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                : "border border-gray-200 bg-gray-100 text-gray-400"
            }`}
          >
            {collectionBusy ? "Loading..." : saveConfirmation && !hasUnsavedChanges ? "Saved!" : "Save collection"}
          </button>
        </div>
      </div>

      {collectionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{collectionError}</p>}
      <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-64 flex-1 items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="shrink-0">Collection</span>
            <input aria-label="Collection name" maxLength={120} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} className="block w-full rounded border border-gray-300 px-3 py-1.5 font-normal" />
          </label>
          <button type="button" onClick={downloadCollection} className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700">Export JSON</button>
          {collectionId && <button type="button" onClick={() => openCollection(collectionId, true)} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700">Reload</button>}
          {collectionId && <button type="button" onClick={removeCollection} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700">Delete</button>}
        </div>
        <p className="mt-1 text-xs text-gray-500">Encrypted in the database. Exported JSON includes credentials in readable form.</p>
      </section>

      <CollectionVariables variables={variables} sensitiveVariables={sensitiveVariables} onChange={setVariables} onSensitivityChange={setSensitiveVariables} onSave={saveTesterDrafts} canSave={Boolean(collectionName.trim()) && (hasUnsavedChanges || !collectionId)} saving={collectionBusy} />

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
        {requestListOpen && (
          <RequestCollectionSidebar
            collectionMode={collectionMode}
            activeMode={mode}
            activeRequestId={activeDraftIds[mode]}
            requests={visibleRequests}
            filter={requestFilter}
            onCollapse={() => setRequestListOpen(false)}
            onFilterChange={setRequestFilter}
            onAdd={() => addRequestDraft(collectionMode)}
            onOpen={openRequestDraft}
            onRemove={(draft) => {
              if (window.confirm(`Remove "${draft.name}" from this collection? Save the collection to keep this change.`)) {
                removeRequestDraft(draft);
              }
            }}
          />
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {!requestListOpen && (
                <button type="button" onClick={() => setRequestListOpen(true)} title="Show request list" className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3.5 5h8M3.5 10h8M3.5 15h8M14 5.5 17.5 9 14 12.5" />
                  </svg>
                  Requests
                </button>
              )}
              <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${mode === "soap" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{mode}</span>
              <input value={draftTabs[mode].find((draft) => draft.id === activeDraftIds[mode])?.name || ""} maxLength={40} aria-label="Request name" onChange={(event) => renameRequestDraft(activeDraftIds[mode], event.target.value)} className="min-w-52 flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-semibold" />
              <button type="button" role="switch" aria-label="Script editors" aria-checked={scriptsOpen} aria-controls={scriptsOpen ? "request-script-editors" : undefined} onClick={() => setScriptsOpen(open => !open)} className="inline-flex items-center gap-2 rounded px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <span>Scripts</span>
                <span aria-hidden="true" className={`relative inline-block h-5 w-9 rounded-full transition-colors ${scriptsOpen ? "bg-indigo-600" : "bg-gray-300"}`}>
                  <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${scriptsOpen ? "translate-x-4" : ""}`} />
                </span>
                {(editor.state.preRequestScript.trim() || editor.state.postResponseScript.trim()) && <span aria-hidden="true" className="text-xs text-indigo-700">Configured</span>}
              </button>
              <button
                type="button"
                onClick={saveTesterDrafts}
                disabled={collectionBusy || !collectionName.trim() || (!hasUnsavedChanges && Boolean(collectionId))}
                title="Saves the encrypted collection containing this request"
                className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400"
              >
                {saveConfirmation && !hasUnsavedChanges ? "Saved" : "Save request"}
              </button>
            </div>
          </section>

      {mode === "soap" && <WsdlLoader loading={wsdlLoading} url={wsdlUrl} name={wsdlName} operations={operations} selectedOperation={selectedOperation} onUrlChange={setWsdlUrl} onLoadFile={loadWsdlFile} onLoadUrl={loadWsdlUrl} onSelectOperation={selectWsdlOperation} />}

      <HttpRequestEditor mode={mode} method={method} url={url} authType={authType} token={token} username={username} password={password} apiKeyName={apiKeyName} headers={headers} body={body} sending={sending} hasPreRequestScript={Boolean(editor.state.preRequestScript.trim())} onMethodChange={setMethod} onUrlChange={setUrl} onAuthTypeChange={setAuthType} onTokenChange={setToken} onUsernameChange={setUsername} onPasswordChange={setPassword} onApiKeyNameChange={setApiKeyName} onHeadersChange={setHeaders} onBodyChange={setBody} onSend={sendRequest} onCancel={() => abortController.current?.abort()} />

      {scriptsOpen && <div id="request-script-editors" className="space-y-3">
      <CollapsibleCard label="pre-request script" expandedClassName="space-y-2" header={() => <h2 className="text-sm font-semibold text-gray-900">Pre-request script {editor.state.preRequestScript.trim() && <span className="font-normal text-gray-500">(configured)</span>}</h2>}>
        <p className="text-xs text-gray-500">Runs before sending. Use <code>mb.variables</code> and <code>mb.request</code> to prepare the request.</p>
        <textarea aria-label="Pre-request script" spellCheck={false} rows={6} value={editor.state.preRequestScript} onChange={event => editor.patchEditor({ preRequestScript: event.target.value })} placeholder={'mb.request.headers.upsert({ key: "X-Trace-Id", value: crypto.randomUUID() });'} className="block w-full rounded border border-gray-300 p-2 font-mono text-xs" />
      </CollapsibleCard>
      <CollapsibleCard label="post-response script" expandedClassName="space-y-2" header={() => <h2 className="text-sm font-semibold text-gray-900">Post-response script {editor.state.postResponseScript.trim() && <span className="font-normal text-gray-500">(configured)</span>}</h2>}>
        <p className="text-xs text-gray-500">Runs after a response. Capture values with <code>mb.response</code> and <code>mb.variables</code>; for example, use <code>{'{{authToken}}'}</code> in another request.</p>
        <textarea aria-label="Post-response script" spellCheck={false} rows={6} value={editor.state.postResponseScript} onChange={event => editor.patchEditor({ postResponseScript: event.target.value })} placeholder={'mb.variables.set("authToken", mb.response.json().access_token);'} className="block w-full rounded border border-gray-300 p-2 font-mono text-xs" />
      </CollapsibleCard>
      </div>}
      {scriptLogs.length > 0 && <pre aria-label="Script console" className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-gray-200 p-3 text-xs">{scriptLogs.join("\n")}</pre>}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {response && <TesterResponsePanel response={response} />}
        </div>
      </div>
    </fieldset>
    <UnsavedChangesDialog {...unsavedChangesDialogProps} title="Unsaved collection changes" description="Changes to this collection have not been saved. Discard them and continue?" />
    </>
  );
}
