export interface ScriptRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}
export interface ScriptResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, name: string) => {
    if (!Object.hasOwn(variables, name)) throw new Error(`Undefined collection variable: ${name}`);
    return variables[name];
  });
}

// Runs only inside a Worker owned by an opaque-origin sandbox iframe.
export const SCRIPT_WORKER = `
self.onmessage = async ({ data }) => {
  const send = self.postMessage.bind(self);
  try {
    const values = new Map(Object.entries(data.variables));
    const request = data.request;
    const headers = request.headers;
    const findHeader = name => Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());
    const variableApi = {
      get: name => values.get(name),
      has: name => values.has(name),
      set: (name, value) => { values.set(String(name), String(value)); },
      unset: name => { values.delete(name); },
      toObject: () => Object.fromEntries(values),
    };
    const headerApi = {
      get: name => headers[findHeader(name)],
      upsert: ({ key, value }) => { const old = findHeader(key); if (old) delete headers[old]; headers[key] = String(value); },
      add: item => headerApi.upsert(item),
      remove: name => { delete headers[findHeader(name)]; },
    };
    const scriptRequest = { ...request, headers: headerApi, body: { raw: request.body, update(value) { this.raw = String(value); } } };
    const logs = [];
    const log = (...args) => { if (logs.length < 100) logs.push(args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ").slice(0, 2000)); };
    const mb = { variables: variableApi, collectionVariables: variableApi, request: scriptRequest };
    if (data.response) mb.response = {
      code: data.response.status,
      json: () => JSON.parse(data.response.body),
      text: () => data.response.body,
      headers: { get: name => Object.entries(data.response.headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] },
    };
    // randomUUID is unavailable in opaque-origin workers in some browsers.
    // getRandomValues remains available there, so expose a compatible fallback.
    const cryptoApi = {
      getRandomValues: array => self.crypto.getRandomValues(array),
      randomUUID: () => {
        if (typeof self.crypto.randomUUID === "function") return self.crypto.randomUUID();
        const bytes = self.crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
      },
    };
    // Keep the original namespace as a compatibility alias for saved scripts.
    await new (Object.getPrototypeOf(async function(){}).constructor)("mb", "pm", "console", "crypto", data.script)(mb, mb, { log, info: log, warn: log, error: log }, cryptoApi);
    send({ result: { variables: Object.fromEntries(values), request: { url: scriptRequest.url, method: scriptRequest.method, headers, body: scriptRequest.body.raw }, logs } });
  } catch (error) { send({ error: error.message || String(error) }); }
};
`;

export function runRequestScript(script: string, variables: Record<string, string>, request: ScriptRequest, signal: AbortSignal, response?: ScriptResponse): Promise<{ variables: Record<string, string>; request: ScriptRequest; logs: string[] }> {
  if (!script.trim()) return Promise.resolve({ variables, request, logs: [] });
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.setAttribute("sandbox", "allow-scripts");
    const cleanup = () => { clearTimeout(timer); window.removeEventListener("message", onMessage); signal.removeEventListener("abort", abort); frame.remove(); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const abort = () => fail(new DOMException("Request cancelled.", "AbortError"));
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.ready) { frame.contentWindow?.postMessage({ script, variables, request, response }, "*"); return; }
      cleanup();
      if (event.data?.error) reject(new Error(event.data.error));
      else if (event.data?.result) resolve(event.data.result);
      else reject(new Error("Invalid script result."));
    };
    const timer = setTimeout(() => fail(new Error("Script exceeded the 3 second time limit.")), 3000);
    window.addEventListener("message", onMessage);
    signal.addEventListener("abort", abort, { once: true });
    // CSP blocks network access; no allow-same-origin means no app cookies/storage.
    // Worker termination also stops synchronous infinite loops without freezing the UI.
    const bootstrap = `const worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(SCRIPT_WORKER)}], {type:"text/javascript"}))); const stop = setTimeout(() => { worker.terminate(); parent.postMessage({error:"Script exceeded the 3 second time limit."}, "*"); }, 2800); worker.onmessage = event => { clearTimeout(stop); worker.terminate(); parent.postMessage(event.data, "*"); }; worker.onerror = () => { worker.terminate(); parent.postMessage({error:"Unable to run script."}, "*"); }; onmessage = event => { if(event.source === parent) worker.postMessage(event.data); }; parent.postMessage({ready:true}, "*");`;
    frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'"><script>${bootstrap.replace(/<\/script/gi, "<\\/script")}<\/script>`;
    if (signal.aborted) { abort(); return; }
    document.body.appendChild(frame);
  });
}
