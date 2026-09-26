import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { tick } from "svelte";
import { confirm } from "../../../lib/confirm.svelte";
import { operationGate } from "../../../lib/operation-gate.svelte";
import { toast } from "../../../lib/toast.svelte";
import {
  windowsOptimizationApi,
  type AutoLogonOutcome,
  type AutoLogonOperation,
  type AutoLogonState,
  type FirmwareRestartOutcome,
  type WindowsOptimizationAction,
  type WindowsOptimizationEvent,
  type WindowsOptimizationJob,
  type WindowsOptimizationOutcome,
  type WindowsOptimizationSnapshot,
  type WindowsOptimizationStage,
} from "./api";

export type ToolStatus = "Ready" | "Completed" | "Cancelled" | "Error";

export interface ConsoleBuffer {
  lines: string[];
  open: boolean;
  dropped: number;
}

const MAX_LINES = 1200;
const TRIM_TO = 1000;
const POLL_MS = 1500;

export const STAGE_LABELS: Record<WindowsOptimizationStage, string> = {
  preparing: "Preparing",
  waitingForAdmin: "Waiting for UAC",
  resolvingRelease: "Resolving release",
  downloading: "Downloading",
  verifying: "Verifying",
  extracting: "Extracting",
  launching: "Launching",
  running: "Running",
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class WindowsOptimizationState {
  snapshot = $state<WindowsOptimizationSnapshot | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);
  startingAction = $state<WindowsOptimizationAction | null>(null);
  autoLogonRequest = $state<AutoLogonOperation | null>(null);
  firmwareRestartRequest = $state(false);
  biosDialogOpen = $state(false);
  liveJob = $state<WindowsOptimizationJob | null>(null);
  stopping = $state(false);
  console = $state<ConsoleBuffer>({ lines: [], open: false, dropped: 0 });
  statuses = $state<Record<WindowsOptimizationAction, ToolStatus>>({
    launchCtt: "Ready",
    launchSparkle: "Ready",
  });

  #pollTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeJob = $derived(this.liveJob ?? this.snapshot?.activeJob ?? null);
  readonly activeAction = $derived(this.startingAction ?? this.activeJob?.action ?? null);
  readonly autoLogonBusy = $derived(
    this.autoLogonRequest !== null || isAutoLogonActive(this.snapshot?.autoLogon),
  );
  readonly firmwareRestartBusy = $derived(
    this.firmwareRestartRequest || this.snapshot?.firmwareRestart.active === true,
  );
  readonly ownBusy = $derived(
    this.activeAction !== null || this.autoLogonBusy || this.firmwareRestartBusy,
  );
  readonly externallyLocked = $derived(operationGate.lockedFor("windows-optimization"));
  readonly locked = $derived(this.ownBusy || this.externallyLocked);

  async load() {
    if (!isTauri() || this.loading) return;
    this.loading = true;
    try {
      this.applySnapshot(await windowsOptimizationApi.getState());
      this.error = null;
    } catch (error) {
      this.error = message(error);
    } finally {
      this.loading = false;
    }
  }

  statusOf(action: WindowsOptimizationAction): string {
    if (this.activeAction !== action) return this.statuses[action];
    return this.activeJob ? STAGE_LABELS[this.activeJob.stage] : "Preparing";
  }

  progressOf(action: WindowsOptimizationAction): number | null {
    return this.activeAction === action ? (this.activeJob?.progress ?? null) : null;
  }

  transferOf(action: WindowsOptimizationAction): string | null {
    if (this.activeAction !== action || !this.activeJob?.downloaded) return null;
    const downloaded = formatBytes(this.activeJob.downloaded);
    const total = this.activeJob.total ? formatBytes(this.activeJob.total) : null;
    return total ? `${downloaded} / ${total}` : downloaded;
  }

  autoLogonStatus(): string {
    if (this.autoLogonRequest === "enable") return "Enabling";
    if (this.autoLogonRequest === "disable") return "Disabling";
    const state = this.snapshot?.autoLogon;
    if (!state) return this.loading ? "Checking" : "Unavailable";
    if (state.activeOperation === "enable") return "Enabling";
    if (state.activeOperation === "disable") return "Disabling";
    return state.status.charAt(0).toUpperCase() + state.status.slice(1);
  }

  firmwareRestartStatus(): "Ready" | "Unavailable" | "Processing" {
    if (this.firmwareRestartBusy) return "Processing";
    return this.snapshot?.firmwareRestart.available ? "Ready" : "Unavailable";
  }

  openBiosDialog() {
    if (this.locked || !this.snapshot?.firmwareRestart.available) return;
    this.biosDialogOpen = true;
  }

  dismissBiosDialog() {
    if (!this.firmwareRestartBusy) this.biosDialogOpen = false;
  }

  async restartToFirmware() {
    if (this.locked || !this.snapshot?.firmwareRestart.available) return;
    if (!operationGate.begin("windows-optimization")) {
      toast.info("Finish the current app task before restarting to BIOS / UEFI.");
      return;
    }

    this.firmwareRestartRequest = true;
    this.error = null;
    toast.info("Save your work now. Windows will request administrator approval next.");
    try {
      await tick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const outcome = await windowsOptimizationApi.restartToFirmware();
      this.reportFirmwareRestartOutcome(outcome);
      if (outcome.result === "scheduled") this.biosDialogOpen = false;
    } catch (error) {
      toast.error(`Restart to BIOS / UEFI: ${message(error)}`);
    } finally {
      this.firmwareRestartRequest = false;
      operationGate.end("windows-optimization");
      await this.load();
    }
  }

  async setAutoLogon(enabled: boolean) {
    if (this.locked) return;
    const state = this.snapshot?.autoLogon;
    if (!state) return;

    const approved = await confirm(
      enabled
        ? {
            title: "Enable automatic Windows sign-in?",
            message:
              "Windows will sign in to this account automatically after startup. Anyone with physical access to this PC may be able to access the account. Windows will request the account password securely; a PIN or Windows Hello cannot be used.",
            confirmLabel: "Enable Auto-Logon",
            cancelLabel: "Cancel",
            danger: true,
          }
        : state.status === "conflict"
          ? {
              title: "Disable another Auto-Logon configuration?",
              message:
                `Auto-Logon is configured for ${state.configuredUser ?? "another Windows account"}. Disable that configuration and remove its stored sign-in secret?`,
              confirmLabel: "Disable Auto-Logon",
              cancelLabel: "Keep enabled",
              danger: true,
            }
          : {
              title: "Disable automatic Windows sign-in?",
              message:
                "Windows will require a normal sign-in again after startup. The stored Auto-Logon secret will be removed.",
              confirmLabel: "Disable Auto-Logon",
              cancelLabel: "Keep enabled",
            },
    );
    if (!approved || this.locked) return;

    if (!operationGate.begin("windows-optimization")) {
      toast.info("Finish the current app task before changing Auto-Logon.");
      return;
    }
    this.autoLogonRequest = enabled ? "enable" : "disable";
    this.error = null;
    try {
      const outcome = await windowsOptimizationApi.setAutoLogon(enabled);
      this.reportAutoLogonOutcome(outcome);
    } catch (error) {
      toast.error(`Windows Auto-Logon: ${message(error)}`);
    } finally {
      this.autoLogonRequest = null;
      operationGate.end("windows-optimization");
      await this.load();
    }
  }

  async launchCtt() {
    if (this.locked) return;
    const approved = await confirm({
      title: "Run remote administrator script?",
      message:
        "Chris Titus Utility's official command downloads and executes its current remote PowerShell script in one step. This app cannot verify that script with a checksum before it runs. Continue only if you trust christitus.com and GitHub project ChrisTitusTech/winutil.",
      confirmLabel: "Launch as administrator",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (approved && !this.locked) await this.run("launchCtt");
  }

  async launchSparkle() {
    if (!this.locked) await this.run("launchSparkle");
  }

  async cancel() {
    const job = this.activeJob;
    if (!job || this.stopping) return;
    this.stopping = true;
    try {
      await windowsOptimizationApi.cancel(job.jobId);
    } catch (error) {
      this.stopping = false;
      toast.error(`Could not request cancellation: ${message(error)}`);
    }
  }

  toggleConsole() {
    this.console.open = !this.console.open;
  }

  async openGithub(tool: "ctt" | "sparkle") {
    const url =
      tool === "ctt"
        ? "https://github.com/ChrisTitusTech/winutil"
        : "https://github.com/thedogecraft/sparkle";
    try {
      await openUrl(url);
    } catch (error) {
      toast.error(`Could not open the project page: ${message(error)}`);
    }
  }

  private applySnapshot(snapshot: WindowsOptimizationSnapshot) {
    this.snapshot = snapshot;
    if (
      snapshot.activeJob ||
      isAutoLogonActive(snapshot.autoLogon) ||
      snapshot.firmwareRestart.active
    ) {
      this.liveJob = snapshot.activeJob;
      if (snapshot.activeJob?.action === "launchCtt") this.console.open = true;
      operationGate.begin("windows-optimization");
      this.watchBackendOperation();
    } else if (
      !this.startingAction &&
      !this.autoLogonRequest &&
      !this.firmwareRestartRequest
    ) {
      this.liveJob = null;
      operationGate.end("windows-optimization");
      if (snapshot.lastOutcome) this.applyOutcome(snapshot.lastOutcome);
    }
  }

  private watchBackendOperation() {
    if (this.#pollTimer) return;
    const poll = async () => {
      this.#pollTimer = null;
      if (
        (!this.activeJob &&
          !isAutoLogonActive(this.snapshot?.autoLogon) &&
          !this.snapshot?.firmwareRestart.active) ||
        this.startingAction ||
        this.autoLogonRequest ||
        this.firmwareRestartRequest
      ) return;
      try {
        const snapshot = await windowsOptimizationApi.getState();
        const previous = this.activeAction;
        this.snapshot = snapshot;
        this.liveJob = snapshot.activeJob;
        if (
          snapshot.activeJob ||
          isAutoLogonActive(snapshot.autoLogon) ||
          snapshot.firmwareRestart.active
        ) {
          this.#pollTimer = setTimeout(poll, POLL_MS);
        } else {
          if (snapshot.lastOutcome) this.applyOutcome(snapshot.lastOutcome);
          else if (previous) this.statuses[previous] = "Error";
          operationGate.end("windows-optimization");
        }
      } catch {
        this.#pollTimer = setTimeout(poll, POLL_MS);
      }
    };
    this.#pollTimer = setTimeout(poll, POLL_MS);
  }

  private async run(action: WindowsOptimizationAction) {
    if (this.locked || !operationGate.begin("windows-optimization")) {
      toast.info("Finish the current app task before launching another tool.");
      return;
    }
    this.startingAction = action;
    this.statuses[action] = "Ready";
    this.stopping = false;
    this.error = null;
    if (action === "launchCtt") {
      this.console = { lines: ["Launch requested."], open: true, dropped: 0 };
    }
    try {
      const outcome = await windowsOptimizationApi.run(action, (event) =>
        this.onEvent(action, event),
      );
      this.applyOutcome(outcome);
      this.reportOutcome(outcome);
    } catch (error) {
      const text = message(error);
      this.statuses[action] = "Error";
      if (action === "launchCtt") this.append(`Error: ${text}`);
      toast.error(`${titleOf(action)}: ${text}`);
    } finally {
      this.startingAction = null;
      this.liveJob = null;
      this.stopping = false;
      operationGate.end("windows-optimization");
      await this.load();
    }
  }

  private onEvent(
    action: WindowsOptimizationAction,
    event: WindowsOptimizationEvent,
  ) {
    if (event.event === "stage") {
      this.liveJob = {
        jobId: event.data.jobId,
        action,
        stage: event.data.stage,
        progress: null,
        downloaded: null,
        total: null,
      };
      if (action === "launchCtt") this.append(`${STAGE_LABELS[event.data.stage]}…`);
    } else if (event.event === "progress") {
      if (this.liveJob?.jobId === event.data.jobId) {
        this.liveJob.progress = Math.max(0, Math.min(1, event.data.fraction));
        this.liveJob.downloaded = event.data.downloaded;
        this.liveJob.total = event.data.total;
      }
    } else if (action === "launchCtt") {
      this.append(event.data.text, event.data.replace);
    }
  }

  private append(text: string, replace = false) {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (replace && this.console.lines.length && lines.length) {
      this.console.lines[this.console.lines.length - 1] = lines.shift()!;
    }
    this.console.lines.push(...lines);
    if (this.console.lines.length > MAX_LINES) {
      const remove = this.console.lines.length - TRIM_TO;
      this.console.lines.splice(0, remove);
      this.console.dropped += remove;
    }
  }

  private applyOutcome(outcome: WindowsOptimizationOutcome) {
    if (outcome.result === "done") this.statuses[outcome.action] = "Completed";
    else if (outcome.result === "cancelled") this.statuses[outcome.action] = "Cancelled";
    else this.statuses[outcome.action] = "Error";
  }

  private reportOutcome(outcome: WindowsOptimizationOutcome) {
    const title = titleOf(outcome.action);
    if (outcome.result === "done") {
      toast.success(`${title} finished.${outcome.note ? ` ${outcome.note}` : ""}`);
    } else if (outcome.result === "cancelled") {
      toast.info(`${title} was stopped. Changes already applied by the tool were not reverted.`);
    } else {
      toast.info(`${title} needs administrator approval to start.`);
    }
  }

  private reportAutoLogonOutcome(outcome: AutoLogonOutcome) {
    const suffix = outcome.note ? ` ${outcome.note}` : "";
    if (outcome.result === "enabled") {
      toast.success(`Windows Auto-Logon is enabled.${suffix}`);
    } else if (outcome.result === "disabled") {
      toast.success(`Windows Auto-Logon is disabled.${suffix}`);
    } else if (outcome.result === "cancelled") {
      toast.info("The Auto-Logon change was cancelled.");
    } else if (outcome.result === "needsAdmin") {
      toast.info("Administrator approval is required to change Auto-Logon.");
    } else if (outcome.result === "conflict") {
      toast.error(`A different Auto-Logon configuration is active.${suffix}`);
    } else {
      toast.error(`Auto-Logon is not available for this account or Windows configuration.${suffix}`);
    }
  }

  private reportFirmwareRestartOutcome(outcome: FirmwareRestartOutcome) {
    const suffix = outcome.note ? ` ${outcome.note}` : "";
    if (outcome.result === "scheduled") {
      toast.info(`Windows accepted the BIOS / UEFI restart request.${suffix}`);
    } else if (outcome.result === "cancelled") {
      toast.error(`Administrator approval was cancelled. Your PC was not restarted.${suffix}`);
    } else if (outcome.result === "needsAdmin") {
      toast.error(`Administrator approval is required to restart to BIOS / UEFI.${suffix}`);
    } else {
      toast.error(`Restart to BIOS / UEFI is unavailable on this system.${suffix}`);
    }
  }
}

function isAutoLogonActive(state: AutoLogonState | null | undefined): boolean {
  return state?.status === "working" || state?.activeOperation != null;
}

function titleOf(action: WindowsOptimizationAction): string {
  return action === "launchCtt" ? "Chris Titus Utility" : "Sparkle";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export const windowsOptimizationState = new WindowsOptimizationState();
