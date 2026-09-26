// State of the System Cleaner page: the fixed categories, their measured sizes,
// and what the user picked. The page never sends a path, only category ids.
//
// Administrator rights are asked for once, when a scan starts: the answer
// decides whether the system folders (Prefetch, C:\Windows\Temp, the update
// cache…) are measured, and later whether cleaning includes them.
import { isTauri } from "@tauri-apps/api/core";
import { SvelteSet } from "svelte/reactivity";
import { confirm } from "../../../lib/confirm.svelte";
import { readJson, writeJson } from "../../../lib/storage";
import { toast } from "../../../lib/toast.svelte";
import { cleanerApi, formatSize, type CleanerCategory } from "./api";

const KEY = { selected: "cleaner.selected", lastCleaned: "cleaner.lastCleaned" };

/** The backend's answer when the UAC prompt is declined. */
const DECLINED = "Administrator approval was declined.";

export interface Measured {
  bytes: number;
  files: number;
  /** Holds files only an administrator can read, and no approval was given. */
  locked: boolean;
}

type Phase = "idle" | "scanning" | "cleaning";

const isStringArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

class CleanerState {
  categories = $state<CleanerCategory[]>([]);
  sizes = $state<Record<string, Measured>>({});
  readonly selected = new SvelteSet<string>(readJson<string[]>(KEY.selected, [], isStringArray));
  /** Emptied since the last scan: unchecked and switched off until then. */
  readonly cleaned = new SvelteSet<string>();
  phase = $state<Phase>("idle");
  /** False until the first scan finishes, so sizes stay blank instead of "0 B". */
  scanned = $state(false);
  /** The answer to the scan's UAC prompt; null before the first scan. */
  adminGranted = $state<boolean | null>(null);
  progress = $state<{ done: number; total: number; current: string } | null>(null);
  lastCleaned = $state<number | null>(readJson<number | null>(KEY.lastCleaned, null, (v) => typeof v === "number"));
  error = $state<string | null>(null);
  #loaded = false;

  readonly total = $derived(Object.values(this.sizes).reduce((sum, m) => sum + m.bytes, 0));
  readonly selectedBytes = $derived(
    [...this.selected].reduce((sum, id) => sum + (this.sizes[id]?.bytes ?? 0), 0),
  );
  readonly lockedIds = $derived(this.categories.filter((c) => this.sizes[c.id]?.locked).map((c) => c.id));
  readonly busy = $derived(this.phase !== "idle");
  /** What "Select all" covers: everything not emptied since the scan. */
  readonly selectable = $derived(this.categories.filter((c) => !this.cleaned.has(c.id)));
  readonly allSelected = $derived(
    this.selectable.length > 0 && this.selectable.every((c) => this.selected.has(c.id)),
  );

  readonly status = $derived.by(() => {
    if (this.phase === "scanning") return "Scanning…";
    if (this.phase === "cleaning") return "Cleaning…";
    if (!this.scanned) return "Ready to scan";
    if (this.lockedIds.length) return "System folders skipped (no administrator)";
    return "Scan completed";
  });

  async load() {
    if (!isTauri() || this.#loaded) return;
    try {
      this.categories = await cleanerApi.categories();
      this.#loaded = true;
      // Drop ids from an older build so nothing invisible stays selected.
      const known = new Set(this.categories.map((c) => c.id));
      for (const id of [...this.selected]) if (!known.has(id)) this.selected.delete(id);
    } catch (err) {
      this.error = message(err);
    }
  }

  isCleaned(id: string) {
    return this.cleaned.has(id);
  }

  toggle(id: string) {
    if (this.busy || this.cleaned.has(id)) return;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.#persistSelection();
  }

  toggleAll() {
    if (this.busy) return;
    if (this.allSelected) this.selected.clear();
    else for (const category of this.selectable) this.selected.add(category.id);
    this.#persistSelection();
  }

  /**
   * Measures everything. The UAC prompt for the system folders appears right
   * away and runs next to the normal pass; declining it only leaves those
   * folders out.
   */
  async scan() {
    if (this.busy) return;
    this.phase = "scanning";
    this.error = null;
    this.sizes = {};
    this.cleaned.clear();

    // The elevated pass reports the whole category (the user's folders
    // included), so it wins over the normal pass whichever finishes first.
    const user: Record<string, Measured> = {};
    const admin: Record<string, Measured> = {};
    const show = (id: string) => (this.sizes[id] = admin[id] ?? user[id]);

    const wantsAdmin = this.categories.some((c) => c.mayNeedAdmin);
    const adminPass = wantsAdmin
      ? cleanerApi
          .scanElevated((e) => {
            admin[e.data.id] = { bytes: e.data.bytes, files: e.data.files, locked: false };
            show(e.data.id);
          })
          .then(
            () => null,
            (err) => message(err),
          )
      : Promise.resolve(null);

    try {
      await cleanerApi.scan((e) => {
        user[e.data.id] = { bytes: e.data.bytes, files: e.data.files, locked: e.data.locked };
        show(e.data.id);
      });
      this.scanned = true;
    } catch (err) {
      this.error = message(err);
      toast.error(`Scan failed: ${message(err)}`);
    }

    const adminError = await adminPass;
    if (wantsAdmin) this.#afterAdminScan(adminError);
    this.phase = "idle";
  }

  /** Asks for administrator rights again after a declined prompt. */
  async allowAdmin() {
    if (this.busy) return;
    this.phase = "scanning";
    try {
      await cleanerApi.scanElevated((e) => {
        this.sizes[e.data.id] = { bytes: e.data.bytes, files: e.data.files, locked: false };
      });
      this.#afterAdminScan(null);
    } catch (err) {
      this.#afterAdminScan(message(err));
    } finally {
      this.phase = "idle";
    }
  }

  #afterAdminScan(error: string | null) {
    this.adminGranted = error === null;
    if (error === null) return;
    if (error === DECLINED) toast.info("System folders were left out: administrator approval was declined.");
    else toast.error(`System folders could not be measured: ${error}`);
  }

  async clean() {
    if (this.busy || !this.selected.size) return;
    const chosen = this.categories.filter((c) => this.selected.has(c.id) && !this.cleaned.has(c.id));
    if (!chosen.length) return;
    const ids = chosen.map((c) => c.id);
    // Admin folders are included only when the scan's prompt was approved;
    // otherwise they are skipped here without asking again.
    const adminIds = chosen.filter((c) => c.mayNeedAdmin).map((c) => c.id);
    const withAdmin = this.adminGranted === true && adminIds.length > 0;
    const adminLine = withAdmin
      ? "\n\nWindows will ask for administrator approval once more to empty the system folders."
      : adminIds.length
        ? "\n\nSystem folders are skipped: administrator approval was not given during the scan."
        : "";

    const ok = await confirm({
      title: "Clean selected items?",
      message:
        `${chosen.map((c) => `• ${c.title}`).join("\n")}\n\nThis frees about ${formatSize(this.selectedBytes)} and cannot be undone.` +
        adminLine,
      confirmLabel: "Clean now",
      danger: true,
    });
    if (!ok || this.busy) return;

    this.phase = "cleaning";
    this.progress = { done: 0, total: ids.length, current: "" };
    let freed = 0;
    let skipped = 0;
    try {
      const summary = await cleanerApi.clean(ids, (e) => {
        if (e.event === "progress") this.progress = e.data;
        else this.#applyCleaned(e.data.id, e.data.bytes, e.data.files);
      });
      freed += summary.freed;
      skipped += summary.skipped;

      // The first pass already deleted files; a declined or failed UAC step
      // must not hide that, so it is reported on its own.
      let adminNote: string | null = null;
      if (withAdmin) {
        this.progress = { done: 0, total: adminIds.length, current: "Administrator" };
        try {
          const elevated = await cleanerApi.cleanElevated(adminIds, (e) => {
            if (e.event === "progress") this.progress = e.data;
            else this.#applyCleaned(e.data.id, e.data.bytes, e.data.files);
          });
          freed += elevated.freed;
          // Files the user pass could not delete were retried as administrator.
          skipped = elevated.skipped + Math.max(0, skipped - elevated.files);
        } catch (err) {
          adminNote = `The system folders were skipped: ${message(err)}`;
        }
      }

      for (const id of ids) {
        this.cleaned.add(id);
        this.selected.delete(id);
      }
      this.#persistSelection();
      this.lastCleaned = Date.now();
      writeJson(KEY.lastCleaned, this.lastCleaned);
      toast.success(`Successfully freed up ${formatSize(freed)}!`);
      if (skipped) toast.info(`${skipped} file${skipped === 1 ? " was" : "s were"} in use and left alone.`);
      if (adminNote) toast.info(adminNote);
    } catch (err) {
      toast.error(`Cleaning failed: ${message(err)}`);
    } finally {
      this.phase = "idle";
      this.progress = null;
    }
  }

  /** Subtracts what a pass freed from a category's measured size. */
  #applyCleaned(id: string, bytes: number, files: number) {
    const before = this.sizes[id];
    if (!before) return;
    this.sizes[id] = {
      bytes: Math.max(0, before.bytes - bytes),
      files: Math.max(0, before.files - files),
      locked: before.locked,
    };
  }

  #persistSelection() {
    writeJson(KEY.selected, [...this.selected]);
  }
}

export const cleanerState = new CleanerState();
