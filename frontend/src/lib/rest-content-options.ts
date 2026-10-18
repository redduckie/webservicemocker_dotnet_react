import type { RestContentType } from "./types";

export const REST_CONTENT_TYPE_OPTIONS: Array<{ value: RestContentType; label: string }> = [
  { value: "application/json", label: "JSON (application/json)" },
  { value: "application/xml", label: "XML (application/xml)" },
  { value: "application/x-www-form-urlencoded", label: "Form URL Encoded (application/x-www-form-urlencoded)" },
];

export function defaultResponseBody(contentType: RestContentType): string {
  if (contentType === "application/xml") {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<response>\n  <message>success</message>\n</response>';
  }
  if (contentType === "application/x-www-form-urlencoded") return "message=success";
  return '{\n  "message": "success"\n}';
}

export function requestBodyPlaceholder(contentType: RestContentType): string {
  if (contentType === "application/xml") {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<request>\n  <name>John</name>\n</request>';
  }
  if (contentType === "application/x-www-form-urlencoded") {
    return "grant_type=client_credentials&client_id=example-client&client_secret=example-secret";
  }
  return '{\n  "name": "John",\n  "email": "john@example.com"\n}';
}

export function isDefaultResponseBody(body: string): boolean {
  return body === "{}" || REST_CONTENT_TYPE_OPTIONS.some(
    (option) => body === defaultResponseBody(option.value)
  );
}
