"use client";

import { useEffect, useState } from "react";
import { getBackend, LIVE_DEMO_URL, serverExpected } from "@/lib/workspace/backend";

/* Shown on every page when the live MemBrain server could not be reached, so nobody mistakes the in-browser copy for
 * the real demo: there, nothing is saved and the AI (Gulf Whisper, MedGemma) is off. */
export function ModeBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!serverExpected()) return;
    getBackend().then((b) => setOffline(b.mode !== "server")).catch(() => setOffline(true));
  }, []);
  if (!offline) return null;
  return (
    <div role="alert" className="sticky top-0 z-[60] bg-[#8f1d3b] px-4 py-2.5 text-center text-[14px] font-medium text-white">
      Offline copy: the MemBrain server could not be reached, so nothing you enter is saved and speech AI and MedGemma are off.{" "}
      <a href={LIVE_DEMO_URL} className="underline underline-offset-2">Open the live demo</a> or reload in a minute.
    </div>
  );
}
