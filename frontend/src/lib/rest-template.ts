import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { RestContentType } from "./types";

const MAX_TEMPLATE_LENGTH = 200_000;
const MAX_RENDERED_LENGTH = 2_000_000;
const MAX_LOOP_ITEMS = 500;
const MAX_LOOP_DEPTH = 10;
const FORBIDDEN_PATH_PARTS = new Set(["__proto__", "prototype", "constructor"]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  trimValues: true,
});

type TemplateNode =
  | { type: "text"; value: string }
  | { type: "expression"; value: string }
  | { type: "each"; path: string; children: TemplateNode[] };

interface RenderContext {
  value: unknown;
  root: unknown;
  parent?: RenderContext;
  index?: number;
  length?: number;
}

interface RenderState {
  contentType: RestContentType;
  loopItems: number;
}

export class RestTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestTemplateError";
  }
}

export interface SyntaxIssue {
  message: string;
  line: number;
  column: number;
}

export function getJsonSyntaxIssue(body: string, label: string): SyntaxIssue | null {
  try {
    JSON.parse(body);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reportedLocation = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
    if (reportedLocation) {
      const line = Number(reportedLocation[1]);
      const column = Number(reportedLocation[2]);
      return { message: `${label} must be valid JSON at line ${line}, column ${column}`, line, column };
    }

    const positionMatch = /position\s+(\d+)/i.exec(message);
    const position = positionMatch ? Number(positionMatch[1]) : body.length;
    const location = getLineAndColumn(body, position);
    return {
      message: `${label} must be valid JSON at line ${location.line}, column ${location.column}`,
      ...location,
    };
  }
}

export function getErrorLine(message: string | null): number | null {
  if (!message) return null;
  const match = /\bline\s+(\d+)\b/i.exec(message);
  return match ? Number(match[1]) : null;
}

export interface RenderRestTemplateOptions {
  template: string;
  requestBody: string;
  requestContentType: RestContentType;
  responseContentType: RestContentType;
  pathParams?: Record<string, string>;
  includeDescendantAliases?: boolean;
}

export function renderRestResponseTemplate(options: RenderRestTemplateOptions): string {
  if (options.template.length > MAX_TEMPLATE_LENGTH) {
    throw new RestTemplateError("Response templates are limited to 200 KB.");
  }

  const requestData = parseRequestData(options.requestBody, options.requestContentType);
  const root = createRootContext(
    requestData,
    options.pathParams || {},
    options.includeDescendantAliases === true
  );
  const nodes = parseTemplate(options.template);
  const rendered = renderNodes(nodes, { value: root, root }, {
    contentType: options.responseContentType,
    loopItems: 0,
  }, 0);

  if (rendered.length > MAX_RENDERED_LENGTH) {
    throw new RestTemplateError("The rendered response exceeds the 2 MB limit.");
  }
  return rendered;
}

export function validateRestResponseTemplate(options: RenderRestTemplateOptions): string | null {
  let rendered: string;
  try {
    rendered = renderRestResponseTemplate(options);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid response template";
  }
  if (!rendered) return null;
  if (options.responseContentType === "application/json") {
    return getJsonSyntaxIssue(rendered, "Rendered response body")?.message || null;
  }
  if (options.responseContentType === "application/xml") {
    const validation = XMLValidator.validate(rendered);
    if (validation !== true) {
      const error = typeof validation === "object" && validation && "err" in validation
        ? (validation as { err?: { line?: number; col?: number } }).err
        : undefined;
      if (error?.line && error.col) {
        return `Rendered response body must be valid XML at line ${error.line}, column ${error.col}`;
      }
      return "Rendered response body must be valid XML";
    }
  }
  return null;
}

export function getPathParams(actualPath: string, patternPath: string): Record<string, string> {
  const patternParts = patternPath.split("/").filter(Boolean);
  const actualParts = actualPath.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  patternParts.forEach((part, index) => {
    if (part.startsWith(":") && actualParts[index]) {
      params[part.slice(1)] = decodeURIComponentSafely(actualParts[index]);
    }
  });
  return params;
}

function parseRequestData(body: string, contentType: RestContentType): unknown {
  if (!body.trim()) return {};
  try {
    if (contentType === "application/json") return JSON.parse(body);
    if (contentType === "application/xml") return xmlParser.parse(body);
    const result: Record<string, string | string[]> = {};
    new URLSearchParams(body).forEach((value, key) => {
      const existing = result[key];
      if (existing === undefined) result[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else result[key] = [existing, value];
    });
    return result;
  } catch {
    throw new RestTemplateError("The request body could not be parsed for response templating.");
  }
}

function createRootContext(
  body: unknown,
  pathParams: Record<string, string>,
  includeDescendantAliases: boolean
): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (!FORBIDDEN_PATH_PARTS.has(key)) root[key] = value;
    }
  }
  for (const [key, value] of Object.entries(pathParams)) {
    if (!FORBIDDEN_PATH_PARTS.has(key)) root[key] = value;
  }
  if (includeDescendantAliases) addDescendantAliases(body, root);
  root.request = { body, pathParams };
  return root;
}

function addDescendantAliases(value: unknown, root: Record<string, unknown>): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("@_") || FORBIDDEN_PATH_PARTS.has(key)) continue;
    if (!Object.prototype.hasOwnProperty.call(root, key)) root[key] = child;
    if (Array.isArray(child)) {
      if (child.length > 0) addDescendantAliases(child[0], root);
    } else {
      addDescendantAliases(child, root);
    }
  }
}

function parseTemplate(template: string): TemplateNode[] {
  const root: TemplateNode[] = [];
  const stack: Array<{ path: string; children: TemplateNode[] }> = [];
  let target = root;
  let cursor = 0;
  const tokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(template)) !== null) {
    if (match.index > cursor) target.push({ type: "text", value: template.slice(cursor, match.index) });
    const expression = match[1].trim();
    if (expression.startsWith("#each ")) {
      const path = expression.slice(6).trim();
      validatePath(path);
      const node: Extract<TemplateNode, { type: "each" }> = { type: "each", path, children: [] };
      target.push(node);
      stack.push({ path, children: target });
      if (stack.length > MAX_LOOP_DEPTH) {
        throw new RestTemplateError(`Template loops cannot be nested more than ${MAX_LOOP_DEPTH} levels.`);
      }
      target = node.children;
    } else if (expression === "/each") {
      const parent = stack.pop();
      if (!parent) throw new RestTemplateError("Found {{/each}} without a matching {{#each ...}}.");
      target = parent.children;
    } else {
      validateExpression(expression);
      target.push({ type: "expression", value: expression });
    }
    cursor = tokenPattern.lastIndex;
  }

  if (cursor < template.length) target.push({ type: "text", value: template.slice(cursor) });
  if (stack.length > 0) {
    throw new RestTemplateError(`Missing {{/each}} for collection "${stack[stack.length - 1].path}".`);
  }
  return root;
}

function validateExpression(expression: string): void {
  const helperMatch = /^(json|length)\s+(.+)$/.exec(expression);
  if (helperMatch) {
    validatePath(helperMatch[2].trim());
    return;
  }
  if (expression.startsWith("#") || expression.startsWith("/")) {
    throw new RestTemplateError(`Unsupported template instruction "{{${expression}}}".`);
  }
  validatePath(expression);
}

function validatePath(path: string): void {
  const parentPrefix = /^(?:\.\.\/)+/.exec(path)?.[0] || "";
  const value = path.slice(parentPrefix.length);
  const valid = /^(?:this|@[a-z]+|[A-Za-z0-9_$-]+)(?:(?:\.[A-Za-z0-9_$*-]+)|(?:\[(?:\d+|\*)\]))*$/.test(value);
  if (!valid) throw new RestTemplateError(`Invalid template path "${path}".`);
  for (const part of tokenizePath(value)) {
    if (FORBIDDEN_PATH_PARTS.has(part)) {
      throw new RestTemplateError(`Template path "${path}" is not allowed.`);
    }
  }
}

function renderNodes(
  nodes: TemplateNode[],
  context: RenderContext,
  state: RenderState,
  depth: number
): string {
  let output = "";
  for (const node of nodes) {
    if (node.type === "text") {
      output = appendChecked(output, node.value);
      continue;
    }
    if (node.type === "expression") {
      output = appendChecked(output, renderExpression(node.value, context));
      continue;
    }

    const collection = resolvePath(node.path, context);
    if (!Array.isArray(collection)) continue;
    state.loopItems += collection.length;
    if (state.loopItems > MAX_LOOP_ITEMS) {
      throw new RestTemplateError(`A response can render at most ${MAX_LOOP_ITEMS} collection items.`);
    }
    const renderedItems = collection.map((item, index) => renderNodes(
      node.children,
      {
        value: item,
        root: context.root,
        parent: context,
        index,
        length: collection.length,
      },
      state,
      depth + 1
    ));
    const separator = state.contentType === "application/json" ? "," : "";
    output = appendChecked(output, renderedItems.join(separator));
  }
  return output;
}

function renderExpression(expression: string, context: RenderContext): string {
  const helperMatch = /^(json|length)\s+(.+)$/.exec(expression);
  if (helperMatch) {
    const value = resolvePath(helperMatch[2].trim(), context);
    if (helperMatch[1] === "length") {
      if (Array.isArray(value) || typeof value === "string") return String(value.length);
      if (value && typeof value === "object") return String(Object.keys(value).length);
      return "0";
    }
    return JSON.stringify(value === undefined ? null : value) ?? "null";
  }

  const value = resolvePath(expression, context);
  if (value === undefined) return `{{${expression}}}`;
  if (value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function resolvePath(path: string, originalContext: RenderContext): unknown {
  let context = originalContext;
  while (path.startsWith("../")) {
    context = context.parent || context;
    path = path.slice(3);
  }

  if (path === "@index") return context.index;
  if (path === "@first") return context.index === 0;
  if (path === "@last") return context.index !== undefined && context.index === (context.length || 0) - 1;

  const parts = tokenizePath(path);
  const explicitlyCurrent = parts[0] === "this";
  if (explicitlyCurrent) parts.shift();
  let value = resolveParts(context.value, parts);
  if (value === undefined && !explicitlyCurrent && context.value !== context.root) {
    value = resolveParts(context.root, parts);
  }
  return value;
}

function tokenizePath(path: string): string[] {
  return path.replace(/\[(\d+|\*)\]/g, ".$1").split(".").filter(Boolean);
}

function resolveParts(value: unknown, parts: string[]): unknown {
  if (parts.length === 0) return value;
  const [part, ...rest] = parts;
  if (FORBIDDEN_PATH_PARTS.has(part)) return undefined;
  if (part === "*") {
    if (!Array.isArray(value)) return undefined;
    return value.map((item) => resolveParts(item, rest)).filter((item) => item !== undefined);
  }
  if (value === null || typeof value !== "object") return undefined;
  if (!Object.prototype.hasOwnProperty.call(value, part)) return undefined;
  return resolveParts((value as Record<string, unknown>)[part], rest);
}

function appendChecked(current: string, addition: string): string {
  if (current.length + addition.length > MAX_RENDERED_LENGTH) {
    throw new RestTemplateError("The rendered response exceeds the 2 MB limit.");
  }
  return current + addition;
}

function decodeURIComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getLineAndColumn(body: string, position: number): { line: number; column: number } {
  const safePosition = Math.max(0, Math.min(position, body.length));
  const lines = body.slice(0, safePosition).split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}
