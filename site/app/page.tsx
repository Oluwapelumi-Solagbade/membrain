import { Landing } from "@/components/landing/Landing";
import { MobileApp } from "@/components/app/MobileApp";

// In the Android build (NEXT_PUBLIC_MOBILE=1) the home screen is the app itself; on the web it is the landing page.
export default function HomePage() {
  return process.env.NEXT_PUBLIC_MOBILE === "1" ? <MobileApp /> : <Landing lang="en" />;
}
