export type TesterMode = "rest" | "soap";
export type AuthType = "none" | "bearer" | "basic" | "apiKey";
export interface HeaderRow { id: number; name: string; value: string }
export interface WsdlOperation { name: string; soapAction: string; requestXml?: string }
export interface RequestDraft {
  preRequestScript?: string;
  postResponseScript?: string;
  id: string;
  name: string;
  mode: TesterMode;
  url: string;
  method: string;
  headers: HeaderRow[];
  body: string;
  authType: AuthType;
  token: string;
  username: string;
  password: string;
  apiKeyName: string;
  wsdlUrl: string;
  wsdlName: string;
  operations: WsdlOperation[];
  selectedOperation: string;
}
export interface CollectionSummary {
  id: string;
  name: string;
  mode: TesterMode;
  revision: string;
  updatedAt: string;
  requestCount: number;
}
export interface RequestCollection extends CollectionSummary { requests: RequestDraft[]; variables?: Record<string, string>; sensitiveVariables?: string[] }
export const COLLECTION_FORMAT = "mockingbird-request-collection";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}
function string(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  return value;
}

// Explicitly select fields: imported ownership, storage keys, and response data are never trusted.
export function parseCollection(input: unknown): { name: string; mode: TesterMode; requests: RequestDraft[]; variables?: Record<string, string>; sensitiveVariables?: string[] } {
  const data = record(input);
  const name = string(data.name, "Collection name").trim();
  if (!name || name.length > 120) throw new Error("Collection names must contain 1–120 characters.");
  if (!Array.isArray(data.requests)) throw new Error("Requests must be an array.");
  if (data.mode !== undefined && data.mode !== "rest" && data.mode !== "soap") {
    throw new Error("Collection type must be REST or SOAP.");
  }
  const variables = data.variables === undefined ? undefined : parseVariables(data.variables);
  const sensitiveVariables = data.sensitiveVariables === undefined ? undefined : parseSensitiveVariables(data.sensitiveVariables);
  const ids = new Set<string>();
  const requests = data.requests.map((value): RequestDraft => {
    const draft = record(value);
    const id = string(draft.id, "Request ID");
    if (!id || id.length > 150 || ids.has(id)) throw new Error("Request IDs must be unique and nonempty.");
    ids.add(id);
    if (draft.mode !== "rest" && draft.mode !== "soap") throw new Error("Unsupported request mode.");
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(String(draft.method))) throw new Error("Unsupported request method.");
    if (!["none", "bearer", "basic", "apiKey"].includes(String(draft.authType))) throw new Error("Unsupported authentication type.");
    if (!Array.isArray(draft.headers) || !Array.isArray(draft.operations)) throw new Error("Invalid headers or WSDL operations.");
    return {
      ...(draft.preRequestScript !== undefined ? { preRequestScript: string(draft.preRequestScript, "Pre-request script") } : {}),
      ...(draft.postResponseScript !== undefined ? { postResponseScript: string(draft.postResponseScript, "Post-response script") } : {}),
      id, name: string(draft.name, "Request name"), mode: draft.mode,
      url: string(draft.url, "URL"), method: String(draft.method),
      body: string(draft.body, "Body"), authType: draft.authType as AuthType,
      token: string(draft.token, "Token"), username: string(draft.username, "Username"),
      password: string(draft.password, "Password"), apiKeyName: string(draft.apiKeyName, "API key name"),
      wsdlUrl: string(draft.wsdlUrl, "WSDL URL"), wsdlName: string(draft.wsdlName, "WSDL name"),
      selectedOperation: string(draft.selectedOperation, "Selected operation"),
      headers: draft.headers.map((value, index) => {
        const header = record(value);
        return { id: index + 1, name: string(header.name, "Header name"), value: string(header.value, "Header value") };
      }),
      operations: draft.operations.map((value) => {
        const operation = record(value);
        return { name: string(operation.name, "Operation name"), soapAction: string(operation.soapAction, "SOAP action"),
          ...(operation.requestXml !== undefined ? { requestXml: string(operation.requestXml, "Request XML") } : {}) };
      }),
    };
  });
  const mode = (data.mode || requests[0]?.mode) as TesterMode | undefined;
  if (!mode) throw new Error("An empty collection must specify whether it is REST or SOAP.");
  if (requests.some((request) => request.mode !== mode)) {
    throw new Error("REST and SOAP requests cannot be mixed in the same collection.");
  }
  return { name, mode, requests, ...(variables === undefined ? {} : { variables }), ...(sensitiveVariables === undefined ? {} : { sensitiveVariables }) };
}

export function parseCollectionFile(input: unknown) {
  const data = record(input);
  if (data.format !== COLLECTION_FORMAT || data.version !== 1) throw new Error("Choose a MockingBird request collection JSON file (version 1).");
  return parseCollection(data);
}

export function exportCollection(name: string, mode: TesterMode, requests: RequestDraft[], variables?: Record<string, string>, sensitiveVariables?: string[]) {
  return { format: COLLECTION_FORMAT, version: 1, ...parseCollection({ name, mode, requests, variables, sensitiveVariables }) };
}

export function parseSensitiveVariables(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error("Sensitive variables must be an array.");
  const names = new Set<string>();
  for (const value of input) {
    const name = string(value, "Sensitive variable name");
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(name) || name.length > 120 || names.has(name)) {
      throw new Error("Sensitive variable names must be valid and unique.");
    }
    names.add(name);
  }
  return [...names];
}

export function parseVariables(input: unknown): Record<string, string> {
  const entries = Object.entries(record(input));
  for (const [name, value] of entries) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(name) || name.length > 120) throw new Error("Variable names must start with a letter or underscore and contain only letters, numbers, _, . or -.");
    string(value, `Variable ${name}`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
