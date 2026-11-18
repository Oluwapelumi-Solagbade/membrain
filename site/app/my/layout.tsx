import { Suspense, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";

// The person (or the family member signed in to their record) sees their own next step; staff may look too.
export default function MyLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <RequireAuth roles={["participant", "clinician", "coordinator"]} signin="/signin/patient/" ownCheckin>
        {children}
      </RequireAuth>
    </Suspense>
  );
}
