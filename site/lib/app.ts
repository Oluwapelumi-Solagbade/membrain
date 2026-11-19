// The MemBrain mobile app: the same site, shown through a phone-first shell (components/app). It runs at /app/ on the
// web, and is the whole site in the Android build (NEXT_PUBLIC_MOBILE=1, packaged by mobile/ with Capacitor), where "/"
// is the app. Pages the app opens (check-in, concern chat, family questionnaire) come back to it instead of the website.
"use client";

export const MOBILE_BUILD = process.env.NEXT_PUBLIC_MOBILE === "1";
export const APP_HOME = MOBILE_BUILD ? "/" : "/app/";
const FLAG = "membrain.inApp";

/** Called by the app shell: the pages it opens then return to it. */
export function markInApp() {
  try {
    window.sessionStorage.setItem(FLAG, "1");
  } catch {
    /* storage unavailable */
  }
}

/** True inside the Android app, or after this tab opened the app at /app/. Read it after mount (it depends on the tab). */
export function inApp(): boolean {
  if (MOBILE_BUILD) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

/** Where "home" is: the app when in it, otherwise the website (in the person's language). */
export const homeHref = (lang: "en" | "ar" = "en") => (inApp() ? APP_HOME : lang === "ar" ? "/ar/" : "/");
/** A case, opened inside the app when in it, otherwise in the clinician workspace. */
export const appCaseHref = (id: string) => (inApp() ? `${APP_HOME}?case=${encodeURIComponent(id)}` : `/clinician/case/?id=${encodeURIComponent(id)}`);

/** The APK, built by .github/workflows/android.yml and attached to the "android-latest" release on every push. */
export const APK_URL = "https://github.com/teamcerebrospark/membrain/releases/download/android-latest/MemBrain.apk";
