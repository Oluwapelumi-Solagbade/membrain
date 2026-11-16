import { Suspense, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";

// Patients sign in to do their own check-in; clinical staff can start one for anyone (an assisted check-in).
export default function CheckinLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <RequireAuth roles={["participant", "clinician", "coordinator"]} signin="/signin/patient/" ownCheckin>
        {children}
      </RequireAuth>
    </Suspense>
  );
}
