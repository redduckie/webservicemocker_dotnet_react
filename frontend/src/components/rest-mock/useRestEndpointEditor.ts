"use client";

import { useMemo, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { RestContentType, RestEndpoint } from "@/lib/types";

export interface RestEndpointEditorState {
  method: RestEndpoint["method"];
  path: string;
  description: string;
  responseBody: string;
  requestBodyExample: string;
  requestContentType: RestContentType;
  responseContentType: RestContentType;
  statusCode: number;
  authenticationRequired: boolean;
  requireExactRequestValues: boolean;
}

type Key = keyof RestEndpointEditorState;
type Action =
  | { type: "field"; key: Key; value: SetStateAction<RestEndpointEditorState[Key]> }
  | { type: "load"; endpoint: RestEndpoint };

export function endpointEditorState(endpoint: RestEndpoint): RestEndpointEditorState {
  return {
    method: endpoint.method,
    path: endpoint.path,
    description: endpoint.description || "",
    responseBody: endpoint.responseBody,
    requestBodyExample: endpoint.requestBodyExample || "",
    requestContentType: endpoint.requestContentType || "application/json",
    responseContentType: endpoint.responseContentType || "application/json",
    statusCode: endpoint.statusCode,
    authenticationRequired: endpoint.authenticationRequired !== false,
    requireExactRequestValues: endpoint.requireExactRequestValues === true,
  };
}

export function endpointEditorSignature(value: RestEndpointEditorState): string {
  return JSON.stringify(value);
}

function reducer(state: RestEndpointEditorState, action: Action): RestEndpointEditorState {
  if (action.type === "load") return endpointEditorState(action.endpoint);
  const current = state[action.key];
  const value = typeof action.value === "function"
    ? (action.value as (previous: typeof current) => typeof current)(current)
    : action.value;
  return { ...state, [action.key]: value };
}

export function useRestEndpointEditor(endpoint: RestEndpoint) {
  const [state, dispatch] = useReducer(reducer, endpoint, endpointEditorState);
  const actions = useMemo(() => {
    const setter = <K extends Key>(key: K): Dispatch<SetStateAction<RestEndpointEditorState[K]>> =>
      (value) => dispatch({ type: "field", key, value } as Action);
    return {
      setMethod: setter("method"), setPath: setter("path"), setDescription: setter("description"),
      setResponseBody: setter("responseBody"), setRequestBodyExample: setter("requestBodyExample"),
      setRequestContentType: setter("requestContentType"), setResponseContentType: setter("responseContentType"),
      setStatusCode: setter("statusCode"), setAuthenticationRequired: setter("authenticationRequired"),
      setRequireExactRequestValues: setter("requireExactRequestValues"),
      loadEndpoint: (saved: RestEndpoint) => dispatch({ type: "load", endpoint: saved }),
    };
  }, []);
  return { state, ...actions };
}
