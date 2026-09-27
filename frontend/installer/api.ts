// Typed bridge to the setup crate (backend/installer/src/ui.rs).
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export interface SetupState {
  mode: "install" | "uninstall";
  product: string;
  /** What this setup installs; the installed version when uninstalling. */
  version: string;
  installed: { version: string | null; dir: string } | null;
  dir: string;
  /** Bytes on disk once installed. */
  size: number;
  shortcuts: { desktop: boolean; startMenu: boolean; startup: boolean };
  /** `/P`: installs at once and closes by itself. */
  passive: boolean;
  /** False for a setup built without the app inside. */
  ready: boolean;
}

export type Stage =
  | "closingApp"
  | "preparing"
  | "copying"
  | "registering"
  | "shortcuts"
  | "removingFiles"
  | "removingData"
  | "finishing";

export type Progress =
  | { event: "stage"; data: { stage: Stage } }
  | { event: "files"; data: { done: number; total: number; file: string } };

export interface InstallRequest {
  dir: string;
  desktop: boolean;
  startMenu: boolean;
  startup: boolean;
}

export interface SetupApi {
  state(): Promise<SetupState>;
  pickFolder(current: string): Promise<string | null>;
  running(dir: string): Promise<string[]>;
  checkFolder(dir: string): Promise<void>;
  /** Resolves with the install folder. */
  install(request: InstallRequest, onEvent: (e: Progress) => void): Promise<string>;
  uninstall(removeData: boolean, onEvent: (e: Progress) => void): Promise<void>;
  launch(): Promise<void>;
  exit(): Promise<void>;
}

function channel(onEvent: (e: Progress) => void): Channel<Progress> {
  const events = new Channel<Progress>();
  events.onmessage = onEvent;
  return events;
}

const tauriApi: SetupApi = {
  state: () => invoke("setup_state"),
  pickFolder: (current) => invoke("setup_pick_folder", { current }),
  running: (dir) => invoke("setup_running", { dir }),
  checkFolder: (dir) => invoke("setup_check_folder", { dir }),
  install: (request, onEvent) => invoke("setup_install", { request, onEvent: channel(onEvent) }),
  uninstall: (removeData, onEvent) =>
    invoke("setup_uninstall", { request: { removeData }, onEvent: channel(onEvent) }),
  launch: () => invoke("setup_launch"),
  exit: () => invoke("setup_exit"),
};

/** The real setup inside the app; in a dev browser, `?demo=` picks a fake. */
export async function loadApi(): Promise<SetupApi | null> {
  if (isTauri()) return tauriApi;
  const demo = new URLSearchParams(location.search).get("demo");
  if (import.meta.env.DEV && demo !== null) {
    const { previewApi } = await import("./preview");
    return previewApi(demo);
  }
  return null;
}
