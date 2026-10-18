"use client";

import { useMemo, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AuthType, HeaderRow, RequestDraft, TesterMode, WsdlOperation } from "@/lib/tester-collections";
import { createHeader } from "@/components/request-collections/drafts";

export interface RequestEditorState {
  preRequestScript: string;
  postResponseScript: string;
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

type EditorKey = keyof RequestEditorState;
type EditorAction =
  | { type: "field"; key: EditorKey; value: SetStateAction<RequestEditorState[EditorKey]> }
  | { type: "load"; draft: RequestDraft }
  | { type: "patch"; value: Partial<RequestEditorState> };

function initialState(mode: TesterMode): RequestEditorState {
  return {
    preRequestScript: "", postResponseScript: "",
    mode,
    url: "",
    method: mode === "soap" ? "POST" : "GET",
    headers: mode === "soap"
      ? [createHeader("Content-Type", "text/xml; charset=utf-8"), createHeader("SOAPAction", "")]
      : [createHeader("Content-Type", "application/json")],
    body: "",
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

function reducer(state: RequestEditorState, action: EditorAction): RequestEditorState {
  if (action.type === "load") {
    const draft = action.draft;
    return {
      preRequestScript: draft.preRequestScript || "", postResponseScript: draft.postResponseScript || "",
      mode: draft.mode,
      url: draft.url,
      method: draft.mode === "soap" ? "POST" : draft.method,
      headers: draft.headers,
      body: draft.body,
      authType: draft.authType,
      token: draft.token,
      username: draft.username,
      password: draft.password,
      apiKeyName: draft.apiKeyName,
      wsdlUrl: draft.wsdlUrl,
      wsdlName: draft.wsdlName,
      operations: draft.operations,
      selectedOperation: draft.selectedOperation,
    };
  }
  if (action.type === "patch") return { ...state, ...action.value };
  const current = state[action.key];
  const value = typeof action.value === "function"
    ? (action.value as (previous: typeof current) => typeof current)(current)
    : action.value;
  return { ...state, [action.key]: value };
}

export function useRequestEditorController(startMode: TesterMode) {
  const [state, dispatch] = useReducer(reducer, startMode, initialState);
  const actions = useMemo(() => {
    const setter = <K extends EditorKey>(key: K): Dispatch<SetStateAction<RequestEditorState[K]>> =>
      (value) => dispatch({ type: "field", key, value } as EditorAction);
    return {
      setMode: setter("mode"), setUrl: setter("url"), setMethod: setter("method"),
      setHeaders: setter("headers"), setBody: setter("body"), setAuthType: setter("authType"),
      setToken: setter("token"), setUsername: setter("username"), setPassword: setter("password"),
      setApiKeyName: setter("apiKeyName"), setWsdlUrl: setter("wsdlUrl"), setWsdlName: setter("wsdlName"),
      setOperations: setter("operations"), setSelectedOperation: setter("selectedOperation"),
      loadDraft: (draft: RequestDraft) => dispatch({ type: "load", draft }),
      patchEditor: (value: Partial<RequestEditorState>) => dispatch({ type: "patch", value }),
    };
  }, []);
  return { state, ...actions };
}
