import { Suspense, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";

// A family member answers on the person's own sign-in; clinical staff can enter it for them (after a phone call, say).
export default function InformantLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <RequireAuth roles={["participant", "clinician", "coordinator"]} signin="/signin/patient/" ownCheckin>
        {children}
      </RequireAuth>
    </Suspense>
  );
}
