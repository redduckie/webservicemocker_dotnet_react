"use client";

import { useCallback, useState } from "react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

export function useDirtyEditorsGuard(pageDirty = false) {
  const [dirtyEditorIds, setDirtyEditorIds] = useState<Set<string>>(() => new Set());
  const setEditorDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyEditorIds((current) => {
      const alreadyDirty = current.has(id);
      if (alreadyDirty === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const hasUnsavedChanges = pageDirty || dirtyEditorIds.size > 0;
  return { ...useUnsavedChangesGuard(hasUnsavedChanges), setEditorDirty, hasUnsavedChanges };
}
