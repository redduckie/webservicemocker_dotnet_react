"use client";

import { useMemo, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CollectionSummary, RequestDraft, TesterMode } from "@/lib/tester-collections";
import type { DraftCollection } from "@/components/request-collections/drafts";

export interface RequestCollectionState {
  draftTabs: Record<TesterMode, RequestDraft[]>;
  activeDraftIds: Record<TesterMode, string>;
  draftStorageReady: boolean;
  savedStateSignature: string | null;
  saveConfirmation: boolean;
  collections: CollectionSummary[];
  collectionId: string;
  collectionName: string;
  collectionMode: TesterMode;
  collectionRevision: string;
  collectionBusy: boolean;
  collectionError: string | null;
  requestFilter: string;
  collectionSearch: string;
  workspaceOpen: boolean;
}

type Key = keyof RequestCollectionState;
type Action =
  | { type: "field"; key: Key; value: SetStateAction<RequestCollectionState[Key]> }
  | { type: "patch"; value: Partial<RequestCollectionState> };

function reducer(state: RequestCollectionState, action: Action): RequestCollectionState {
  if (action.type === "patch") return { ...state, ...action.value };
  const current = state[action.key];
  const value = typeof action.value === "function"
    ? (action.value as (previous: typeof current) => typeof current)(current)
    : action.value;
  return { ...state, [action.key]: value };
}

export function useRequestCollectionController(initialDrafts: DraftCollection, mode: TesterMode, workspaceOpen: boolean) {
  const [state, dispatch] = useReducer(reducer, {
    draftTabs: initialDrafts.tabs,
    activeDraftIds: initialDrafts.activeIds,
    draftStorageReady: false,
    savedStateSignature: null,
    saveConfirmation: false,
    collections: [],
    collectionId: "",
    collectionName: "My collection",
    collectionMode: mode,
    collectionRevision: "",
    collectionBusy: true,
    collectionError: null,
    requestFilter: "",
    collectionSearch: "",
    workspaceOpen,
  });
  const actions = useMemo(() => {
    const setter = <K extends Key>(key: K): Dispatch<SetStateAction<RequestCollectionState[K]>> =>
      (value) => dispatch({ type: "field", key, value } as Action);
    return {
      setDraftTabs: setter("draftTabs"), setActiveDraftIds: setter("activeDraftIds"),
      setDraftStorageReady: setter("draftStorageReady"), setSavedStateSignature: setter("savedStateSignature"),
      setSaveConfirmation: setter("saveConfirmation"), setCollections: setter("collections"),
      setCollectionId: setter("collectionId"), setCollectionName: setter("collectionName"),
      setCollectionMode: setter("collectionMode"), setCollectionRevision: setter("collectionRevision"),
      setCollectionBusy: setter("collectionBusy"), setCollectionError: setter("collectionError"),
      setRequestFilter: setter("requestFilter"),
      setCollectionSearch: setter("collectionSearch"), setWorkspaceOpen: setter("workspaceOpen"),
      patchCollectionState: (value: Partial<RequestCollectionState>) => dispatch({ type: "patch", value }),
    };
  }, []);
  return { state, ...actions };
}
