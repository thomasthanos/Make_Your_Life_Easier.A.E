import { Channel, invoke } from "@tauri-apps/api/core";

export type WindowsOptimizationAction = "launchCtt" | "launchSparkle";
export type WindowsOptimizationStage =
  | "preparing"
  | "waitingForAdmin"
  | "resolvingRelease"
  | "downloading"
  | "verifying"
  | "extracting"
  | "launching"
  | "running";
export type WindowsOptimizationResult = "done" | "cancelled" | "needsAdmin";

export type AutoLogonStatus =
  | "enabled"
  | "disabled"
  | "conflict"
  | "unavailable"
  | "working";
export type AutoLogonAccountType =
  | "local"
  | "microsoft"
  | "domain"
  | "entra"
  | "unknown";
export type AutoLogonOperation = "enable" | "disable";
export type AutoLogonResult =
  | "enabled"
  | "disabled"
  | "cancelled"
  | "needsAdmin"
  | "conflict"
  | "unsupported";

export type FirmwareType = "uefi" | "legacyBios" | "unknown";
export type FirmwareRestartResult =
  | "scheduled"
  | "cancelled"
  | "needsAdmin"
  | "unsupported";

export interface AutoLogonState {
  status: AutoLogonStatus;
  displayName: string;
  accountName: string;
  accountType: AutoLogonAccountType;
  configuredUser: string | null;
  ownedByApp: boolean;
  activeOperation: AutoLogonOperation | null;
  blockedReason: string | null;
}

export interface AutoLogonOutcome {
  result: AutoLogonResult;
  note: string | null;
}

export interface FirmwareRestartState {
  firmwareType: FirmwareType;
  available: boolean;
  blockedReason: string | null;
  active: boolean;
}

export interface FirmwareRestartOutcome {
  result: FirmwareRestartResult;
  note: string | null;
}

export interface SparkleCacheState {
  cached: boolean;
  version: string | null;
}

export interface WindowsOptimizationJob {
  jobId: string;
  action: WindowsOptimizationAction;
  stage: WindowsOptimizationStage;
  progress: number | null;
  downloaded: number | null;
  total: number | null;
}

export interface WindowsOptimizationOutcome {
  result: WindowsOptimizationResult;
  jobId: string;
  action: WindowsOptimizationAction;
  note: string | null;
}

export interface WindowsOptimizationSnapshot {
  sparkle: SparkleCacheState;
  autoLogon: AutoLogonState;
  firmwareRestart: FirmwareRestartState;
  activeJob: WindowsOptimizationJob | null;
  lastOutcome: WindowsOptimizationOutcome | null;
}

export type WindowsOptimizationEvent =
  | { event: "stage"; data: { jobId: string; stage: WindowsOptimizationStage } }
  | {
      event: "progress";
      data: {
        jobId: string;
        fraction: number;
        downloaded: number | null;
        total: number | null;
      };
    }
  | { event: "line"; data: { jobId: string; text: string; replace: boolean } };

function channel(
  onEvent: (event: WindowsOptimizationEvent) => void,
): Channel<WindowsOptimizationEvent> {
  const value = new Channel<WindowsOptimizationEvent>();
  value.onmessage = onEvent;
  return value;
}

export const windowsOptimizationApi = {
  getState: () =>
    invoke<WindowsOptimizationSnapshot>("windows_optimization_get_state"),
  run: (
    action: WindowsOptimizationAction,
    onEvent: (event: WindowsOptimizationEvent) => void,
  ) =>
    invoke<WindowsOptimizationOutcome>("windows_optimization_run", {
      action,
      onEvent: channel(onEvent),
    }),
  cancel: (jobId: string) =>
    invoke<void>("windows_optimization_cancel", { jobId }),
  setAutoLogon: (enabled: boolean) =>
    invoke<AutoLogonOutcome>("windows_optimization_set_auto_logon", { enabled }),
  restartToFirmware: () =>
    invoke<FirmwareRestartOutcome>("windows_optimization_restart_to_firmware"),
};
