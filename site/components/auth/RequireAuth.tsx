"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Mark } from "../Logo";
import { useSession, type Role } from "@/lib/auth";

/** Shows the page only to someone signed in with one of `roles`; everyone else goes to `signin` and comes back after.
 *  A patient in the check-in is always taken to their own record. */
export function RequireAuth({ roles, signin, children, ownCheckin = false }: { roles: Role[]; signin: string; children: ReactNode; ownCheckin?: boolean }) {
  const { session, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const allowed = !!session && roles.includes(session.user.role);
  const wrongRecord = allowed && ownCheckin && session!.user.role === "participant" && params.get("id") !== session!.user.pid;

  useEffect(() => {
    if (!ready) return;
    if (!allowed) {
      const next = pathname + (params.toString() ? `?${params}` : "");
      const lang = params.get("lang");
      router.replace(`${signin}?next=${encodeURIComponent(next)}${lang ? `&lang=${lang}` : ""}`);
    } else if (wrongRecord) {
      const q = new URLSearchParams(params.toString());
      q.set("id", session!.user.pid!);
      router.replace(`${pathname}?${q}`);
    }
  }, [ready, allowed, wrongRecord, pathname, params, router, signin, session]);

  if (!ready || !allowed || wrongRecord) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-paper">
        <Mark className="h-12 w-auto opacity-90" />
        <Loader2 size={18} className="animate-spin text-muted" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
