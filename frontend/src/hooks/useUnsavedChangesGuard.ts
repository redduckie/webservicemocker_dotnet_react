"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/routing";

export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const bypassUnloadWarning = useRef(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestAction = useCallback((action: () => void) => {
    if (!isDirty) {
      action();
      return;
    }
    setPendingAction(() => action);
  }, [isDirty]);

  const stay = useCallback(() => setPendingAction(null), []);
  const discard = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassUnloadWarning.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (destination.pathname === current.pathname && destination.search === current.search) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      requestAction(() => {
        bypassUnloadWarning.current = true;
        if (destination.origin === current.origin) {
          router.push(`${destination.pathname}${destination.search}${destination.hash}`);
        } else {
          window.location.assign(destination.href);
        }
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [isDirty, requestAction, router]);

  return {
    requestAction,
    dialogProps: {
      open: pendingAction !== null,
      onStay: stay,
      onDiscard: discard,
    },
  };
}
