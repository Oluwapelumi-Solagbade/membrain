import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ModeBanner } from "@/components/ModeBanner";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const plexArabic = IBM_Plex_Sans_Arabic({ variable: "--font-plex-arabic", subsets: ["arabic"], weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], weight: ["500", "600"] });

const description =
  "Noticed a change in memory or thinking? Describe it in Gulf Arabic or English. MemBrain checks for urgent signs first, prepares the facts for a clinician and follows the referral until someone is seen.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL when deploying, so share previews link to the real address.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "MemBrain | From the first worry to the right clinician",
  description,
  applicationName: "MemBrain",
  openGraph: { type: "website", siteName: "MemBrain", title: "MemBrain", description },
  twitter: { card: "summary_large_image", title: "MemBrain", description },
};

export const viewport: Viewport = {
  themeColor: "#0f3f2c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexArabic.variable} ${plexMono.variable} ${sourceSerif.variable} antialiased`}>
      <body className="font-sans">
        <ModeBanner />
        {children}
      </body>
    </html>
  );
}
