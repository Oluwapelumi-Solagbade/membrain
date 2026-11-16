import { Suspense, type ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Shell } from "@/components/clinician/Shell";
import { WorkspaceProvider } from "@/components/clinician/WorkspaceProvider";

export default function ClinicianLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <RequireAuth roles={["clinician", "coordinator"]} signin="/signin/clinician/">
        <WorkspaceProvider>
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </RequireAuth>
    </Suspense>
  );
}
