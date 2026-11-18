import type { Metadata } from "next";
import { EnrolView } from "@/components/clinician/enrol/EnrolView";

export const metadata: Metadata = {
  title: "Enrol a participant | MemBrain",
  description: "Enrolment by a programme coordinator: the safety screen first, identity in a separate vault, consent for each type of data, informant, health context and the session plan.",
};

export default function EnrolPage() {
  return <EnrolView />;
}
