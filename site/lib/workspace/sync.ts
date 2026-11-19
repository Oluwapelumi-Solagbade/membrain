// Shared cross-component and cross-tab workspace update notifier.
// When a concern is raised, a check-in submitted, or an action recorded, this broadcasts to all
// workspace providers and active views so the clinician queue and case pages update immediately.

export function notifyWorkspaceSync(detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("membrain:sync", { detail }));
    window.localStorage.setItem("membrain.sync_tick", Date.now().toString());
  } catch {
    /* ignore storage or dispatch errors in restricted environments */
  }
}
