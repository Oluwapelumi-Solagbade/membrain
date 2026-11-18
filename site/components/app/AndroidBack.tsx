"use client";

// Inside the Android app, the phone's back button goes back a screen (closing a case, leaving the check-in) and only
// leaves the app when there is nowhere to go back to. Capacitor's App plugin is reached through the native bridge, so
// the site needs no extra package; on the web this does nothing.
import { useEffect } from "react";

type Handle = { remove: () => Promise<void> | void };
type AppPlugin = { addListener: (e: "backButton", cb: (ev: { canGoBack: boolean }) => void) => Promise<Handle> | Handle; exitApp: () => Promise<void> };

export function AndroidBack() {
  useEffect(() => {
    const App = (window as unknown as { Capacitor?: { Plugins?: { App?: AppPlugin } } }).Capacitor?.Plugins?.App;
    if (!App) return;
    const h = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
    return () => {
      void Promise.resolve(h).then((x) => x.remove());
    };
  }, []);
  return null;
}
