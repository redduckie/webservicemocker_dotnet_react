import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import { isRestContentType, validateBodySyntax } from "./rest-content";
import { RestContentType, RestEndpoint, RestProject } from "./types";

export const REST_PROJECT_EXPORT_FORMAT = "mockingbird-rest-project";
export const REST_PROJECT_EXPORT_VERSION = 1;
export const MAX_IMPORT_ENDPOINTS = 500;

export interface RestEndpointTemplate {
  method: RestEndpoint["method"];
  path: string;
  description: string;
  requestBodyExample: string;
  responseBody: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  authenticationRequired: boolean;
  requireExactRequestValues: boolean;
  requestContentType: RestContentType;
  responseContentType: RestContentType;
}

export interface RestProjectTemplate {
  format: typeof REST_PROJECT_EXPORT_FORMAT;
  version: typeof REST_PROJECT_EXPORT_VERSION;
  name: string;
  endpoints: RestEndpointTemplate[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  trimValues: true,
});
const xmlBuilder = new XMLBuilder({
  format: true,
  ignoreAttributes: false,
  suppressEmptyNode: false,
});

export function exportRestProject(project: RestProject): RestProjectTemplate {
  return {
    format: REST_PROJECT_EXPORT_FORMAT,
    version: REST_PROJECT_EXPORT_VERSION,
    name: project.name,
    endpoints: project.endpoints.map((endpoint) => {
      const requestContentType = endpoint.requestContentType || "application/json";
      const responseContentType = endpoint.responseContentType || "application/json";
      return {
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description || "",
        requestBodyExample: clearBodyValues(endpoint.requestBodyExample || "", requestContentType),
        responseBody: clearBodyValues(endpoint.responseBody || "", responseContentType),
        statusCode: endpoint.statusCode,
        responseHeaders: Object.fromEntries(
          Object.keys(endpoint.responseHeaders || {}).map((name) => [name, ""])
        ),
        authenticationRequired: endpoint.authenticationRequired !== false,
        // Exported request values are intentionally scrubbed, so exact matching
        // must be re-enabled after the real values are entered in the import.
        requireExactRequestValues: false,
        requestContentType,
        responseContentType,
      };
    }),
  };
}

export function parseRestProjectTemplate(input: unknown): RestProjectTemplate {
  if (!isRecord(input) || input.format !== REST_PROJECT_EXPORT_FORMAT || input.version !== REST_PROJECT_EXPORT_VERSION) {
    throw new Error("This is not a supported MockingBird REST project file.");
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new Error("The imported project must have a name.");
  }
  if (!Array.isArray(input.endpoints) || input.endpoints.length > MAX_IMPORT_ENDPOINTS) {
    throw new Error(`The import must contain no more than ${MAX_IMPORT_ENDPOINTS} endpoints.`);
  }

  return {
    format: REST_PROJECT_EXPORT_FORMAT,
    version: REST_PROJECT_EXPORT_VERSION,
    name: input.name.trim(),
    endpoints: input.endpoints.map((endpoint, index) => parseEndpoint(endpoint, index)),
  };
}

function parseEndpoint(input: unknown, index: number): RestEndpointTemplate {
  const label = `Endpoint ${index + 1}`;
  if (!isRecord(input)) throw new Error(`${label} is invalid.`);
  const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  if (typeof input.method !== "string" || !validMethods.includes(input.method.toUpperCase())) {
    throw new Error(`${label} has an invalid method.`);
  }
  if (typeof input.path !== "string" || !input.path.trim()) {
    throw new Error(`${label} must have a path.`);
  }
  const requestContentType = input.requestContentType ?? "application/json";
  const responseContentType = input.responseContentType ?? "application/json";
  if (!isRestContentType(requestContentType) || !isRestContentType(responseContentType)) {
    throw new Error(`${label} has an unsupported content type.`);
  }
  const requestBodyExample = readString(input.requestBodyExample, "");
  const responseBody = readString(input.responseBody, "");
  const requestError = validateBodySyntax(requestBodyExample, requestContentType, `${label} request body`);
  if (requestError) throw new Error(requestError);
  if (input.requireExactRequestValues !== undefined && typeof input.requireExactRequestValues !== "boolean") {
    throw new Error(`${label} has an invalid exact-value matching setting.`);
  }
  const requireExactRequestValues = input.requireExactRequestValues === true;
  if (requireExactRequestValues && !requestBodyExample.trim()) {
    throw new Error(`${label} needs a request body example for exact-value matching.`);
  }
  const responseError = validateBodySyntax(responseBody, responseContentType, `${label} response body`);
  if (responseError) throw new Error(responseError);
  const statusCode = typeof input.statusCode === "number" ? input.statusCode : 200;
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw new Error(`${label} has an invalid status code.`);
  }

  return {
    method: input.method.toUpperCase() as RestEndpoint["method"],
    path: input.path.trim().startsWith("/") ? input.path.trim() : `/${input.path.trim()}`,
    description: readString(input.description, ""),
    requestBodyExample,
    responseBody,
    statusCode,
    responseHeaders: parseHeaders(input.responseHeaders, label),
    authenticationRequired: input.authenticationRequired !== false,
    requireExactRequestValues,
    requestContentType,
    responseContentType,
  };
}

function clearBodyValues(body: string, contentType: RestContentType): string {
  if (!body) return "";
  try {
    if (contentType === "application/json") {
      return JSON.stringify(clearValue(JSON.parse(body)), null, 2);
    }
    if (contentType === "application/xml") {
      if (XMLValidator.validate(body) !== true) return "";
      return xmlBuilder.build(clearValue(xmlParser.parse(body))).trim();
    }
    const sanitized = new URLSearchParams();
    new URLSearchParams(body).forEach((_value, key) => sanitized.append(key, ""));
    return sanitized.toString();
  } catch {
    return "";
  }
}

function clearValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clearValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, clearValue(child)])
    );
  }
  return "";
}

function parseHeaders(input: unknown, label: string): Record<string, string> {
  if (input === undefined) return {};
  if (!isRecord(input)) throw new Error(`${label} has invalid response headers.`);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    if (!name.trim() || typeof value !== "string") {
      throw new Error(`${label} has invalid response headers.`);
    }
    headers[name] = value;
  }
  return headers;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
