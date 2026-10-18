import { apiFetch as fetch } from "./api";
import type { CollectionSummary, RequestCollection, RequestDraft, TesterMode } from "./tester-collections";
import { parseCollection } from "./tester-collections";

type Fetcher = typeof fetch;
const base = "/api/tester/collections";
const fingerprint = (draft: RequestDraft) => JSON.stringify(parseCollection({
  name: "Comparison", mode: draft.mode,
  requests: [{ ...draft, preRequestScript: draft.preRequestScript || "", postResponseScript: draft.postResponseScript || "" }],
}).requests[0]);

// Memory only: credentials are never cached in localStorage or sessionStorage.
export function createCollectionClient(fetcher: Fetcher = fetch) {
  let summaries: CollectionSummary[] | null = null;
  let listing: Promise<CollectionSummary[]> | null = null;
  const collections = new Map<string, RequestCollection>();
  const loading = new Map<string, Promise<RequestCollection>>();

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetcher(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Unable to access collections. Please try again.");
    return data as T;
  }

  function remember(collection: RequestCollection) {
    collections.set(collection.id, collection);
    const { requests: _requests, variables: _variables, sensitiveVariables: _sensitiveVariables, ...summary } = collection;
    summaries = [summary, ...(summaries || []).filter((item) => item.id !== collection.id)];
  }

  return {
    async list(refresh = false): Promise<CollectionSummary[]> {
      if (listing) return listing;
      if (summaries && !refresh) return summaries;
      listing = request<CollectionSummary[]>(base).then((items) => {
        summaries = items;
        // A manual list refresh also invalidates collections changed elsewhere.
        for (const [id, collection] of collections) {
          if (!items.some((item) => item.id === id && item.revision === collection.revision)) collections.delete(id);
        }
        return items;
      }).finally(() => { listing = null; });
      return listing;
    },
    async get(id: string, refresh = false): Promise<RequestCollection> {
      const pending = loading.get(id);
      if (pending) return pending;
      const cached = collections.get(id);
      if (cached && !refresh) return cached;
      const promise = request<RequestCollection>(`${base}/${encodeURIComponent(id)}`)
        .then((collection) => { remember(collection); return collection; })
        .finally(() => { loading.delete(id); });
      loading.set(id, promise);
      return promise;
    },
    async save(id: string, revision: string, name: string, mode: TesterMode, requests: RequestDraft[], variables: Record<string, string> = {}, sensitiveVariables: string[] = []) {
      const baseline = collections.get(id);
      const useDelta = baseline?.revision === revision && !!id;
      const before = new Map(baseline?.requests.map(draft => [draft.id, fingerprint(draft)]));
      const changed = useDelta ? requests.filter(draft => fingerprint(draft) !== before.get(draft.id)) : requests;
      const result = await request<RequestCollection>(id ? `${base}/${encodeURIComponent(id)}` : base, {
        method: id ? (useDelta ? "PATCH" : "PUT") : "POST", body: JSON.stringify({ revision, name, mode, requests: changed, variables, sensitiveVariables, ...(useDelta ? { order: requests.map(draft => draft.id) } : {}) }),
      });
      const normalized = new Map(result.requests.map(draft => [draft.id, draft]));
      const collection = useDelta ? { ...result, requests: requests.map(draft => normalized.get(draft.id) || draft) } : result;
      remember(collection);
      return collection;
    },
    async remove(id: string, revision: string) {
      await request(`${base}/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "If-Match": revision } });
      collections.delete(id);
      summaries = (summaries || []).filter((item) => item.id !== id);
    },
  };
}

let activeScope: string | null = null;
let activeClient: ReturnType<typeof createCollectionClient> | null = null;
export function getCollectionClient(scope: string) {
  if (scope !== activeScope || !activeClient) {
    activeScope = scope;
    activeClient = createCollectionClient();
  }
  return activeClient;
}
export function clearCollectionClient() {
  activeScope = null;
  activeClient = null;
}
