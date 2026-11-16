import type { ReactNode } from "react";
import { Shell } from "@/components/clinician/Shell";
import { WorkspaceProvider } from "@/components/clinician/WorkspaceProvider";

export default function ClinicianLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
