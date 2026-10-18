"use client";

import Link from "@/components/AppLink";
import { usePathname } from "@/routing";
import { signOutUser } from "@/app/actions/auth-actions";
import ThemeToggle from "@/components/ThemeToggle";
import { clearCollectionClient } from "@/lib/tester-collection-client";
import { useAppStore } from "@/lib/app-store";

interface UserNavProps {
  displayName: string | null;
  isAdmin: boolean;
}

export default function UserNav({ displayName, isAdmin }: UserNavProps) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-indigo-300">Webservice Mocker</span>
        <ThemeToggle />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <ThemeToggle />
      {displayName && (
        <span className="text-sm text-indigo-200">{displayName}</span>
      )}
      {isAdmin && (
        <Link href="/admin" className="text-xs text-indigo-200 hover:text-white">
          Admin
        </Link>
      )}
      <form action={signOutUser} onSubmit={() => { clearCollectionClient(); useAppStore.getState().clear(); }}>
        <button
          type="submit"
          className="text-xs px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 border border-indigo-500 rounded text-white font-medium"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
