export interface Project {
  id: string;
  name: string;
  wsdlContent: string;
  createdAt: string;
  operations: Operation[];
  mockUrl: string;
  enabled?: boolean;
  sessionToken?: string;
}

export interface Operation {
  name: string;
  soapAction: string;
  responseXml: string;
  requestXml?: string;
  customized?: boolean;
}

export interface RequestLog {
  id: string;
  projectId: string;
  operationName: string | null;
  timestamp: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  requestBodySizeBytes?: number;
  requestBodyTruncated?: boolean;
  responseBody: string;
  matched: boolean;
}

export interface ActiveSession {
  displayName: string;
  token: string;
  apiKey: string;
  loginAt: string;
  lastSeen: string;
  features: import("./access").FeatureAccess;
}

// REST Mock types

export type RestContentType =
  | "application/json"
  | "application/xml"
  | "application/x-www-form-urlencoded";

export interface RestProject {
  id: string;
  name: string;
  createdAt: string;
  endpoints: RestEndpoint[];
  mockBaseUrl: string;
  enabled?: boolean;
  sessionToken?: string;
}

export interface RestEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  requestBodyExample: string;
  responseBody: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  authenticationRequired?: boolean;
  requireExactRequestValues?: boolean;
  requestContentType?: RestContentType;
  responseContentType?: RestContentType;
}

export interface RestRequestLog {
  id: string;
  projectId: string;
  endpointId: string | null;
  timestamp: string;
  method: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  requestBodySizeBytes?: number;
  requestBodyTruncated?: boolean;
  responseBody: string;
  statusCode: number;
  matched: boolean;
}
