import type { Metadata } from "next";
import { SettingsView } from "@/components/clinician/programme/SettingsView";

export const metadata: Metadata = {
  title: "Settings | MemBrain",
  description: "Data source, the thresholds every level comes from, and the audit log.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
