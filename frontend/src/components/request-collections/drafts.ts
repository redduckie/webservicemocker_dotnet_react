import type { HeaderRow, RequestDraft, TesterMode } from "@/lib/tester-collections";

export interface DraftCollection {
  tabs: Record<TesterMode, RequestDraft[]>;
  activeIds: Record<TesterMode, string>;
}

let nextHeaderId = 1;

export function createHeader(name = "", value = ""): HeaderRow {
  return { id: nextHeaderId++, name, value };
}

export function createDraft(mode: TesterMode, number: number): RequestDraft {
  return {
    id: `${mode}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: `${mode === "rest" ? "REST" : "SOAP"} request ${number}`,
    mode,
    url: "",
    method: mode === "soap" ? "POST" : "GET",
    headers: mode === "soap"
      ? [createHeader("Content-Type", "text/xml; charset=utf-8"), createHeader("SOAPAction", "")]
      : [createHeader("Content-Type", "application/json")],
    body: "",
    preRequestScript: "",
    postResponseScript: "",
    authType: "none",
    token: "",
    username: "",
    password: "",
    apiKeyName: "X-API-Key",
    wsdlUrl: "",
    wsdlName: "",
    operations: [],
    selectedOperation: "",
  };
}

export function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `Basic ${btoa(binary)}`;
}
