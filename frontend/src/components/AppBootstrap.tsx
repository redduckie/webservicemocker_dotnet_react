"use client";

import { useEffect } from "react";
import { usePathname } from "@/routing";
import { useAppStore } from "@/lib/app-store";

export default function AppBootstrap() {
  const pathname = usePathname();
  const load = useAppStore((state) => state.load);
  const clear = useAppStore((state) => state.clear);

  useEffect(() => {
    if (pathname === "/login" || pathname === "/access") {
      clear();
    } else if (!pathname.startsWith("/admin")) {
      void load();
    }
  }, [clear, load, pathname]);

  return null;
}
