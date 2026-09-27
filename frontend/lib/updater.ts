// Typed bridge to the Rust updater (backend/src/updater.rs).
import { Channel, invoke } from "@tauri-apps/api/core";

export interface UpdateAsset {
  name: string;
  url: string;
  size: number;
  digest: string | null;
}

export type UpdateCheck =
  | { status: "upToDate"; current: string; latest: string }
  | { status: "available"; current: string; latest: string; notes: string; asset: UpdateAsset }
  | { status: "notConfigured"; current: string };

export type DownloadEvent =
  | { event: "started"; data: { total: number | null } }
  | { event: "progress"; data: { downloaded: number; total: number | null } }
  | { event: "verifying" }
  | { event: "installing" };

export function checkForUpdate(): Promise<UpdateCheck> {
  return invoke<UpdateCheck>("check_for_update");
}

/**
 * Downloads, verifies and launches the installer. In a real update the app
 * exits once the installer starts, so the promise only resolves in demo mode.
 */
export function installUpdate(asset: UpdateAsset, onEvent: (e: DownloadEvent) => void): Promise<void> {
  const channel = new Channel<DownloadEvent>();
  channel.onmessage = onEvent;
  return invoke<void>("install_update", { asset, onEvent: channel });
}

/** Sizes and shows the main window, then closes the splash. */
export function finishStartup(): Promise<void> {
  return invoke<void>("finish_startup");
}

export function formatBytes(bytes: number): string {
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
