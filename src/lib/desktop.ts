// Makes the webview behave like a native window in release builds:
// no browser context menu and no reload/print/find shortcuts.
export function hardenWebview(): void {
  if (import.meta.env.DEV) return;

  document.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest("input, textarea, .selectable")) e.preventDefault();
  });

  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const blocked =
      key === "f5" ||
      key === "f7" ||
      (e.ctrlKey && (key === "r" || key === "p" || key === "f" || key === "g" || key === "u"));
    if (blocked) e.preventDefault();
  });
}
