import { XMLParser, XMLValidator } from "fast-xml-parser";
import { RestContentType } from "./types";
import { defaultResponseBody, REST_CONTENT_TYPE_OPTIONS } from "./rest-content-options";
import { getExactRequestValueErrors, getRequiredRequestBodyError } from "./request-validation";
import { getJsonSyntaxIssue } from "./rest-template";

export { defaultResponseBody };

const REST_CONTENT_TYPES = REST_CONTENT_TYPE_OPTIONS.map((option) => option.value);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  trimValues: true,
});

export function isRestContentType(value: unknown): value is RestContentType {
  return typeof value === "string" && REST_CONTENT_TYPES.includes(value as RestContentType);
}

export function validateBodySyntax(
  body: string,
  contentType: RestContentType,
  label: string
): string | null {
  if (!body) return null;
  if (contentType === "application/json") {
    return getJsonSyntaxIssue(body, label)?.message || null;
  }
  if (contentType === "application/xml") {
    const result = XMLValidator.validate(body);
    if (result !== true) {
      const error = typeof result === "object" && result && "err" in result
        ? (result as { err?: { line?: number; col?: number } }).err
        : undefined;
      if (error?.line && error.col) {
        return `${label} must be valid XML at line ${error.line}, column ${error.col}`;
      }
      return `${label} must be valid XML`;
    }
  }
  return null;
}

export function validateRequestBody(
  exampleBody: string,
  actualBody: string,
  contentType: RestContentType,
  requireExactValues = false
): string[] {
  const requiredBodyError = getRequiredRequestBodyError(exampleBody, actualBody);
  if (requiredBodyError) return [requiredBodyError];
  if (!actualBody.trim()) return [];
  const syntaxError = validateBodySyntax(actualBody, contentType, "Request body");
  if (syntaxError) return [syntaxError];
  if (!exampleBody) return [];

  if (contentType === "application/x-www-form-urlencoded") {
    const example = new URLSearchParams(exampleBody);
    const actual = new URLSearchParams(actualBody);
    const missingErrors = [...new Set(example.keys())]
      .filter((key) => !actual.has(key))
      .map((key) => `Missing required field "${key}"`);
    if (missingErrors.length > 0 || !requireExactValues) return missingErrors;
    return getExactRequestValueErrors(formToObject(example), formToObject(actual));
  }

  try {
    const example = contentType === "application/json"
      ? JSON.parse(exampleBody)
      : xmlParser.parse(exampleBody);
    const actual = contentType === "application/json"
      ? JSON.parse(actualBody)
      : xmlParser.parse(actualBody);
    const errors: string[] = [];
    compareTypes(example, actual, "", errors);
    if (errors.length === 0 && requireExactValues) {
      errors.push(...getExactRequestValueErrors(example, actual));
    }
    return errors;
  } catch {
    return [];
  }
}

function formToObject(params: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  params.forEach((value, key) => {
    const existing = result[key];
    if (existing === undefined) result[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else result[key] = [existing, value];
  });
  return result;
}

export function extractBodyFields(
  body: string,
  contentType: RestContentType
): Record<string, string> {
  if (!body) return {};
  try {
    if (contentType === "application/x-www-form-urlencoded") {
      const fields: Record<string, string> = {};
      new URLSearchParams(body).forEach((value, key) => {
        fields[key] = value;
      });
      return fields;
    }
    const parsed = contentType === "application/json" ? JSON.parse(body) : xmlParser.parse(body);
    return flattenObject(parsed);
  } catch {
    return {};
  }
}

function flattenObject(value: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (value === null || typeof value !== "object") {
    if (prefix) result[prefix] = String(value ?? "");
    return result;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, flattenObject(child, fullKey));
    } else {
      result[fullKey] = Array.isArray(child) ? child.map(String).join(",") : String(child ?? "");
    }
  }
  return result;
}

function compareTypes(example: unknown, actual: unknown, path: string, errors: string[]): void {
  if (actual === undefined) {
    errors.push(`Missing required field "${path}"`);
    return;
  }
  const exampleType = getValueType(example);
  const actualType = getValueType(actual);
  if (exampleType !== actualType) {
    errors.push(`Type mismatch at "${path}": expected ${exampleType}, got ${actualType}`);
    return;
  }
  if (exampleType === "object" && example !== null && actual !== null) {
    const exampleObject = example as Record<string, unknown>;
    const actualObject = actual as Record<string, unknown>;
    for (const key of Object.keys(exampleObject)) {
      compareTypes(exampleObject[key], actualObject[key], path ? `${path}.${key}` : key, errors);
    }
  }
  if (exampleType === "array") {
    const exampleItems = example as unknown[];
    const actualItems = actual as unknown[];
    if (exampleItems.length > 0) {
      actualItems.forEach((item, index) => compareTypes(exampleItems[0], item, `${path}[${index}]`, errors));
    }
  }
}

function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
