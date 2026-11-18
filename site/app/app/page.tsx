import type { Metadata, Viewport } from "next";
import { MobileApp } from "@/components/app/MobileApp";

export const metadata: Metadata = {
  title: "MemBrain app",
  description: "The MemBrain mobile app: the clinician's dashboard, map, alerts and reports, and the person's check-in, family questionnaire and plan.",
};
export const viewport: Viewport = { themeColor: "#0f3f2c", viewportFit: "cover" };

export default function AppPage() {
  return <MobileApp />;
}
