// The debloater's page state. It lives outside the components so switching
// tabs or pages keeps the choices and a run's progress.
import { SvelteSet } from "svelte/reactivity";
import { confirm } from "../../../../lib/confirm.svelte";
import { operationGate } from "../../../../lib/operation-gate.svelte";
import { toast } from "../../../../lib/toast.svelte";
import { debloatApi as api, type AppStatus, type DebloatEvent, type DebloatOutcome, type DebloatStatus, type StartMenuUpdate, type Step, type TweakStatus } from "./api";
import { pinCatalog } from "./catalog";
import { appPresetIds, initialSkipped, pendingTweakIds, tweakPresetSkipped, type SelectionPreset } from "./selection";

const SKIPPED_KEY = "myle.debloat.skipped";
const APPS_KEY = "myle.debloat.apps";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function loadSet(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

function saveSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // A preference only.
  }
}

export type Tab = "debloat" | "tweaks" | "startMenu" | "apps" | "tools";
const savedSkipped = loadSet(SKIPPED_KEY);

class DebloatState {
  tab = $state<Tab>("debloat");
  status = $state<DebloatStatus | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);
  /** Debloat tweaks the user switched off for the one-click run. */
  skipped = new SvelteSet<string>(savedSkipped ?? []);
  #tweakDefaultsPending = savedSkipped === null;
  readonly selectedPins = new SvelteSet<string>(pinCatalog.filter((item) => item.essential).map((item) => item.id));
  views = $state({
    debloat: { query: "", filter: "all" },
    tweaks: { query: "", filter: "all" },
    apps: { query: "", filter: "all" },
  });
  /** Apps chosen for removal; `null` until the status tells which are recommended. */
  #apps: SvelteSet<string> | null = null;
  appsVersion = $state(0);
  busy = $state(false);
  startMenuBusy = $state(false);
  /** What the current (or last) run did, step by step. */
  steps = $state<Step[]>([]);
  /** How many steps the current run has, known before they start. */
  expected = $state(0);
  outcome = $state<DebloatOutcome | null>(null);
  /** The phase of a run: for the button and the progress header. */
  phase = $state<"idle" | "restorePoint" | "running" | "done">("idle");

  readonly locked = $derived(this.busy || this.startMenuBusy || operationGate.lockedFor("windows-optimization"));

  readonly debloatTweaks = $derived((this.status?.tweaks ?? []).filter((tweak) => tweak.debloat && tweak.state !== "unavailable"));

  /** Installed apps chosen for removal. */
  readonly chosenApps = $derived.by(() => {
    void this.appsVersion;
    const chosen = this.#apps;
    return (this.status?.apps ?? []).filter((app) => app.packages.length > 0 && chosen?.has(app.id));
  });

  /** The one-click run: the switched-on tweaks not already in place. */
  readonly plannedTweaks = $derived.by(() => {
    const ids = new Set(pendingTweakIds(this.debloatTweaks, this.skipped));
    return this.debloatTweaks.filter((tweak) => ids.has(tweak.id));
  });

  readonly installedApps = $derived((this.status?.apps ?? []).filter((app) => app.packages.length > 0));

  async load() {
    this.loading = true;
    try {
      this.status = await api.status();
      this.error = null;
      if (this.#tweakDefaultsPending) {
        for (const id of initialSkipped(this.status.tweaks, null)) this.skipped.add(id);
        saveSet(SKIPPED_KEY, this.skipped);
        this.#tweakDefaultsPending = false;
      }
      if (!this.#apps) {
        const saved = loadSet(APPS_KEY);
        this.#apps = new SvelteSet(saved ?? appPresetIds(this.status.apps, "recommended"));
        this.appsVersion++;
      }
    } catch (error) {
      this.error = message(error);
    } finally {
      this.loading = false;
    }
  }

  isAppChosen(id: string) {
    void this.appsVersion;
    return this.#apps?.has(id) ?? false;
  }

  setApp(id: string, on: boolean) {
    if (this.locked || !this.#apps || !this.installedApps.some((app) => app.id === id)) return;
    if (on) this.#apps.add(id);
    else this.#apps.delete(id);
    saveSet(APPS_KEY, this.#apps);
    this.appsVersion++;
  }

  selectApps(which: "recommended" | "all" | "none") {
    if (this.locked || !this.#apps || !this.status) return;
    this.#apps.clear();
    for (const id of appPresetIds(this.status.apps, which)) this.#apps.add(id);
    saveSet(APPS_KEY, this.#apps);
    this.appsVersion++;
  }

  setTweak(id: string, on: boolean) {
    if (this.locked || !this.debloatTweaks.some((tweak) => tweak.id === id && tweak.state !== "applied")) return;
    if (on) this.skipped.delete(id);
    else this.skipped.add(id);
    saveSet(SKIPPED_KEY, this.skipped);
  }

  selectTweaks(preset: SelectionPreset) {
    if (this.locked || !this.status) return;
    const next = tweakPresetSkipped(this.status.tweaks, this.skipped, preset);
    this.skipped.clear();
    for (const id of next) this.skipped.add(id);
    saveSet(SKIPPED_KEY, this.skipped);
  }

  togglePin(id: string) {
    if (this.locked || !this.status?.startMenu.supported) return;
    if (this.selectedPins.has(id)) this.selectedPins.delete(id);
    else this.selectedPins.add(id);
  }

  selectPins(preset: "essential" | "all" | "none") {
    if (this.locked || !this.status?.startMenu.supported) return;
    this.selectedPins.clear();
    for (const item of pinCatalog) {
      if (preset === "all" || (preset === "essential" && item.essential)) this.selectedPins.add(item.id);
    }
  }

  #onStep = (step: Step) => {
    const at = this.steps.findIndex((known) => known.id === step.id);
    if (at >= 0) this.steps[at] = step;
    else this.steps.push(step);
  };

  #onEvent = (event: DebloatEvent) => this.#onStep(event.data);

  /** Asks for a restore point first; false when the run should stop. */
  async #restorePoint(): Promise<boolean> {
    this.phase = "restorePoint";
    this.#onStep({ id: "restore-point", label: "Create a restore point", state: "running", detail: null });
    let result;
    try {
      result = await api.restorePoint(false);
      if (result.result === "protectionOff") {
        this.#onStep({ id: "restore-point", label: "Create a restore point", state: "running", detail: "System Protection is off" });
        if (
          await confirm({
            title: "System Protection is off",
            message:
              "Windows keeps no restore points for this PC. Turn System Protection on for the Windows drive, so a restore point can be created now? It uses a little disk space for restore points.",
            confirmLabel: "Turn it on",
            cancelLabel: "Not now",
          })
        ) {
          result = await api.restorePoint(true);
        }
      }
    } catch (error) {
      const text = message(error);
      this.#onStep({ id: "restore-point", label: "Create a restore point", state: "failed", detail: text });
      if (text.includes("declined")) {
        toast.error("Administrator approval was declined, so nothing was changed.");
        return false;
      }
      result = { result: "failed" as const, message: text };
    }
    if (result.result === "created") {
      this.#onStep({ id: "restore-point", label: "Create a restore point", state: "done", detail: null });
      return true;
    }
    const why = result.result === "failed" ? result.message : "System Protection is off.";
    this.#onStep({ id: "restore-point", label: "Create a restore point", state: "failed", detail: why });
    return confirm({
      title: "Continue without a restore point?",
      message: `The restore point could not be created: ${why}\n\nMYLE can still undo its own changes from the Tweaks tab.`,
      confirmLabel: "Continue",
      cancelLabel: "Stop",
    });
  }

  async #perform(work: () => Promise<DebloatOutcome>, withRestorePoint: boolean, steps: number) {
    if (this.locked || !operationGate.begin("windows-optimization")) {
      toast.error("Another app task is running. Try again when it finishes.");
      return;
    }
    this.busy = true;
    this.steps = [];
    this.outcome = null;
    this.expected = steps + (withRestorePoint ? 1 : 0);
    try {
      if (withRestorePoint && !(await this.#restorePoint())) {
        this.phase = "idle";
        return;
      }
      this.phase = "running";
      const outcome = await work();
      this.outcome = outcome;
      this.phase = "done";
      if (outcome.needsAdmin) toast.error("Administrator approval was declined, so machine-wide changes were not made.");
      else if (outcome.failed.length) toast.error(`${outcome.failed.length} step${outcome.failed.length === 1 ? "" : "s"} could not be completed.`);
      else toast.success(outcome.reboot ? "Done. Restart Windows to finish." : "Done.");
    } catch (error) {
      this.phase = "idle";
      toast.error(message(error));
    } finally {
      this.busy = false;
      operationGate.end("windows-optimization");
      await this.load();
    }
  }

  /** Asks about the tweaks that ask again (Edge); returns those still wanted. */
  async #confirmEach(tweaks: TweakStatus[]): Promise<TweakStatus[] | null> {
    const wanted: TweakStatus[] = [];
    for (const tweak of tweaks) {
      if (tweak.confirm && !(await confirm({ title: tweak.title, message: tweak.confirm, confirmLabel: "Yes, go ahead", cancelLabel: "Skip it", danger: true }))) {
        continue;
      }
      wanted.push(tweak);
    }
    return wanted;
  }

  /** The one-click Debloat. */
  async debloat() {
    if (this.locked) return;
    const apps = this.chosenApps;
    const tweaks = this.plannedTweaks;
    if (!tweaks.length && !apps.length) {
      toast.info("Everything chosen is already done.");
      return;
    }
    const lines = [
      ...tweaks.map((tweak) => `• ${tweak.title}`),
      ...(apps.length ? [`• Remove ${apps.length} app${apps.length === 1 ? "" : "s"}: ${apps.map((app) => app.title).join(", ")}`] : []),
    ];
    const ok = await confirm({
      title: "Apply selected changes?",
      message: `A restore point is created first, then:\n${lines.join("\n")}`,
      confirmLabel: "Apply selected",
    });
    if (!ok) return;
    const chosen = await this.#confirmEach(tweaks);
    if (!chosen) return;
    const ids = chosen.map((tweak) => tweak.id);
    const appIds = apps.map((app) => app.id);
    if (!ids.length && !appIds.length) return;
    await this.#perform(() => api.run(ids, appIds, this.#onEvent), true, ids.length + appIds.length);
  }

  async apply(tweak: TweakStatus) {
    if (this.locked || tweak.state === "unavailable") return;
    const chosen = await this.#confirmEach([tweak]);
    if (!chosen?.length) return;
    await this.#perform(() => api.run([tweak.id], [], this.#onEvent), false, 1);
  }

  async undo(tweaks: TweakStatus[]): Promise<boolean> {
    if (this.locked || !tweaks.length) return false;
    const single = tweaks.length === 1 ? tweaks[0] : null;
    const isUndo = single ? single.canUndo : true;
    const ok = await confirm({
      title: single ? `${isUndo ? "Undo" : "Turn off"} “${single.title}”?` : `Undo ${tweaks.length} changes?`,
      message: single
        ? isUndo
          ? "What MYLE changed is put back exactly as it was before."
          : "This setting will be switched back to the Windows default."
        : `Everything MYLE changed is put back exactly as it was before:\n${tweaks.map((tweak) => `• ${tweak.title}`).join("\n")}`,
      confirmLabel: isUndo ? "Undo" : "Turn off",
    });
    if (!ok) return false;
    await this.#perform(() => api.undo(tweaks.map((tweak) => tweak.id), this.#onEvent), false, tweaks.length);
    return true;
  }

  async removeApps(apps: AppStatus[]) {
    if (this.locked || !apps.length) return;
    const ok = await confirm({
      title: `Remove ${apps.length} app${apps.length === 1 ? "" : "s"}?`,
      message: `For every user of this PC, and for new ones:\n${apps.map((app) => `• ${app.title}`).join("\n")}\n\nApps removed here can be installed again from the Microsoft Store.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await this.#perform(() => api.run([], apps.map((app) => app.id), this.#onEvent), false, apps.length);
  }

  async openStore(app: AppStatus) {
    try {
      await api.openStore(app.id);
    } catch (error) {
      toast.error(message(error));
    }
  }

  async setStartMenu(update: StartMenuUpdate) {
    if (this.locked || !this.status?.startMenu.supported || !operationGate.begin("windows-optimization")) return;
    this.startMenuBusy = true;
    try {
      const next = await api.startMenuSet(update);
      if (this.status) this.status.startMenu = next;
    } catch (error) {
      toast.error(message(error));
    } finally {
      this.startMenuBusy = false;
      operationGate.end("windows-optimization");
    }
  }

  async setHideRecommended(hide: boolean) {
    if (this.locked || !this.status?.startMenu.supported || !operationGate.begin("windows-optimization")) return;
    this.startMenuBusy = true;
    try {
      const next = await api.startMenuHideRecommended(hide);
      if (this.status) this.status.startMenu = next;
      toast.success(hide ? "Recommended section hidden." : "Recommended section restored.");
    } catch (error) {
      toast.error(message(error));
    } finally {
      this.startMenuBusy = false;
      operationGate.end("windows-optimization");
    }
  }

  async applyStartPins(pins: string[], label: string) {
    if (this.locked || !this.status?.startMenu.supported) return;
    const ok = await confirm({
      title: `${label}?`,
      message:
        pins.length === 0
          ? "Your current Start Menu pins will be backed up first, then all pinned apps will be cleared from the Start Menu."
          : "Your current Start Menu pins will be backed up first, then the Start Menu will be updated with your selected apps.",
      confirmLabel: "Apply",
    });
    if (!ok) return;
    if (this.locked || !operationGate.begin("windows-optimization")) return;
    this.startMenuBusy = true;
    try {
      const next = await api.startMenuApplyPins(pins);
      if (this.status) this.status.startMenu = next;
      toast.success("Start Menu pinned apps updated.");
    } catch (error) {
      toast.error(message(error));
    } finally {
      this.startMenuBusy = false;
      operationGate.end("windows-optimization");
    }
  }

  async restoreStartPins() {
    if (this.locked || !this.status?.startMenu.supported || !operationGate.begin("windows-optimization")) return;
    this.startMenuBusy = true;
    try {
      const next = await api.startMenuRestorePins();
      if (this.status) this.status.startMenu = next;
      toast.success("Previous Start Menu pins restored.");
    } catch (error) {
      toast.error(message(error));
    } finally {
      this.startMenuBusy = false;
      operationGate.end("windows-optimization");
    }
  }
}

export const debloat = new DebloatState();
