import type { Metadata } from "next";
import { ReferralsView } from "@/components/clinician/referrals/ReferralsView";

export const metadata: Metadata = {
  title: "Referrals | MemBrain",
  description: "Every referral, tracked through the closed loop until follow-up is documented, and the service directory.",
};

export default function ReferralsPage() {
  return <ReferralsView />;
}
