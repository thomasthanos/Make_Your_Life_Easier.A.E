import type { AppStatus, TweakStatus } from "./api";

export type SelectionPreset = "recommended" | "all" | "none";

export function initialSkipped(tweaks: readonly TweakStatus[], saved: readonly string[] | null): Set<string> {
  return new Set(saved ?? tweaks.filter((tweak) => tweak.debloat && tweak.risk === "caution").map((tweak) => tweak.id));
}

export function pendingTweakIds(tweaks: readonly TweakStatus[], skipped: ReadonlySet<string>): string[] {
  return tweaks.filter((tweak) => tweak.debloat && (tweak.state === "notApplied" || tweak.state === "partial") && !skipped.has(tweak.id)).map((tweak) => tweak.id);
}

export function tweakPresetSkipped(tweaks: readonly TweakStatus[], skipped: ReadonlySet<string>, preset: SelectionPreset): Set<string> {
  const next = new Set(skipped);
  for (const tweak of tweaks) {
    if (!tweak.debloat || tweak.state === "unavailable") continue;
    const selected = preset === "all" || (preset === "recommended" && tweak.risk === "safe");
    if (selected) next.delete(tweak.id);
    else next.add(tweak.id);
  }
  return next;
}

export function appPresetIds(apps: readonly Pick<AppStatus, "id" | "packages" | "recommended">[], preset: SelectionPreset): string[] {
  return apps.filter((app) => app.packages.length > 0 && (preset === "all" || (preset === "recommended" && app.recommended))).map((app) => app.id);
}
