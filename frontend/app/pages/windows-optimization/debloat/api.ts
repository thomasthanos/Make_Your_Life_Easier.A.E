// Typed bridge to the debloater (backend/src/debloat). The page sends only
// ids of the backend's fixed tables.
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export type Category = "privacy" | "taskbar" | "explorer" | "ai" | "system" | "apps";
export type Risk = "safe" | "caution";
export type TweakState = "applied" | "notApplied" | "partial" | "unavailable";
export type AppGroup = "microsoft" | "bing" | "xbox" | "thirdParty";

export interface TweakStatus {
  id: string;
  title: string;
  summary: string;
  category: Category;
  risk: Risk;
  /** Part of the one-click Debloat. */
  debloat: boolean;
  /** Asked again on its own before it runs. */
  confirm: string | null;
  state: TweakState;
  /** MYLE applied it and kept what was there before. */
  canUndo: boolean;
}

export interface AppStatus {
  id: string;
  title: string;
  group: AppGroup;
  recommended: boolean;
  /** Installed packages for this user; empty when it is not installed. */
  packages: string[];
  removedByMyle: boolean;
  storeId: string | null;
}

export type StartAlignment = "left" | "center";
export type StartLayout = "default" | "morePins" | "moreRecommendations";
export type StartAllAppsView = "category" | "grid" | "list";

export interface StartMenuStatus {
  supported: boolean;
  alignment: StartAlignment;
  layout: StartLayout;
  allAppsView: StartAllAppsView;
  hideRecommended: boolean;
  showRecentApps: boolean;
  showMostUsedApps: boolean;
  showRecentFiles: boolean;
  showRecommendations: boolean;
  showAccountNotifications: boolean;
  folders: string[];
  hasPinsBackup: boolean;
}

export interface StartMenuUpdate {
  alignment?: StartAlignment;
  layout?: StartLayout;
  allAppsView?: StartAllAppsView;
  showRecentApps?: boolean;
  showMostUsedApps?: boolean;
  showRecentFiles?: boolean;
  showRecommendations?: boolean;
  showAccountNotifications?: boolean;
  folders?: string[];
}

export interface DebloatStatus {
  windows: { build: number; name: string; windows11: boolean };
  tweaks: TweakStatus[];
  apps: AppStatus[];
  startMenu: StartMenuStatus;
  adminReady: boolean;
}

export type RestorePoint = { result: "created" } | { result: "protectionOff" } | { result: "failed"; message: string };

export type StepState = "running" | "done" | "unchanged" | "failed";

export interface Step {
  id: string;
  label: string;
  state: StepState;
  detail: string | null;
}

export type DebloatEvent = { event: "step"; data: Step };

export interface DebloatOutcome {
  changed: number;
  failed: { label: string; message: string }[];
  reboot: boolean;
  needsAdmin: boolean;
}

export interface DebloatApi {
  status(): Promise<DebloatStatus>;
  restorePoint(turnOn: boolean): Promise<RestorePoint>;
  run(tweaks: string[], apps: string[], onEvent: (event: DebloatEvent) => void): Promise<DebloatOutcome>;
  undo(tweaks: string[], onEvent: (event: DebloatEvent) => void): Promise<DebloatOutcome>;
  openStore(app: string): Promise<void>;
  startMenuSet(update: StartMenuUpdate): Promise<StartMenuStatus>;
  startMenuHideRecommended(hide: boolean): Promise<StartMenuStatus>;
  startMenuApplyPins(pins: string[]): Promise<StartMenuStatus>;
  startMenuRestorePins(): Promise<StartMenuStatus>;
}

function channel(onEvent: (event: DebloatEvent) => void): Channel<DebloatEvent> {
  const events = new Channel<DebloatEvent>();
  events.onmessage = onEvent;
  return events;
}

const tauriApi: DebloatApi = {
  status: () => invoke("debloat_status"),
  restorePoint: (turnOn) => invoke("debloat_restore_point", { turnOn }),
  run: (tweaks, apps, onEvent) => invoke("debloat_run", { tweaks, apps, onEvent: channel(onEvent) }),
  undo: (tweaks, onEvent) => invoke("debloat_undo", { tweaks, onEvent: channel(onEvent) }),
  openStore: (app) => invoke("debloat_open_store", { app }),
  startMenuSet: (update) => invoke("debloat_start_menu_set", { update }),
  startMenuHideRecommended: (hide) => invoke("debloat_start_menu_hide_recommended", { hide }),
  startMenuApplyPins: (pins) => invoke("debloat_start_menu_apply_pins", { pins }),
  startMenuRestorePins: () => invoke("debloat_start_menu_restore_pins"),
};

/** In a plain browser (`npx vite`): a pretend PC, to work on the page. */
function previewApi(): DebloatApi {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const tweak = (id: string, title: string, summary: string, category: Category, debloat: boolean, state: TweakState, extra: Partial<TweakStatus> = {}): TweakStatus => ({
    id, title, summary, category, risk: "safe", debloat, confirm: null, state, canUndo: false, ...extra,
  });
  let tweaks: TweakStatus[] = [
    tweak("telemetry", "Turn off telemetry", "Diagnostic data, advertising ID, tailored experiences, typing and inking data, feedback prompts, and the Connected User Experiences service and tasks.", "privacy", true, "partial"),
    tweak("edge", "Remove Microsoft Edge", "Uninstalls the Edge browser. WebView2, which MYLE and other apps are built on, stays.", "apps", true, "notApplied", { risk: "caution", confirm: "Remove Microsoft Edge? Links that open in Edge by default will ask for another browser." }),
    tweak("clock-24h", "24-hour clock", "The taskbar clock and every app show the time as 13:45 instead of 1:45 PM.", "system", true, "notApplied"),
    tweak("background-apps", "Stop Store apps running in the background", "Store apps no longer run, update tiles or use the network while they are closed.", "system", true, "notApplied"),
    tweak("services", "Set unneeded services to manual", "Maps, Program Compatibility Assistant, Distributed Link Tracking and Storage start only when something needs them.", "system", true, "partial"),
    tweak("copilot", "Turn off Copilot", "Removes the Copilot app and button, and turns off Recall, Click to Do and the AI features in Notepad.", "ai", true, "notApplied"),
    tweak("location", "Turn off location tracking", "Apps and Windows can no longer ask where the PC is.", "privacy", true, "notApplied"),
    tweak("taskbar-search", "Hide search on the taskbar", "Removes the search box or icon; Start still searches when you type.", "taskbar", true, "notApplied"),
    tweak("end-task", "End Task on right-click", "Right-click an app on the taskbar to close it at once.", "taskbar", true, "applied"),
    tweak("taskview-widgets", "Hide Task View and Widgets", "Removes the Task View button and the Widgets board from the taskbar.", "taskbar", true, "partial"),
    tweak("bing", "Remove Bing from search", "Start searches only your PC: no web results, no Bing suggestions.", "privacy", true, "notApplied"),
    tweak("classic-context-menu", "Classic right-click menu", "The full Windows 10 right-click menu in File Explorer.", "explorer", true, "notApplied"),
    tweak("suggestions", "Stop suggested apps and ads", "Windows no longer installs promoted apps by itself, nor shows suggestions.", "privacy", true, "partial"),
    tweak("activity-history", "Turn off activity history", "Windows stops recording which apps and files you use.", "privacy", false, "applied", { canUndo: true }),
    tweak("delivery-optimization", "No update sharing with other PCs", "Windows Update downloads only from Microsoft.", "system", false, "notApplied"),
    tweak("game-dvr", "Turn off Game DVR", "No background recording of games by the Xbox Game Bar.", "system", false, "notApplied"),
    tweak("file-extensions", "Show file extensions", "File Explorer shows .exe, .pdf and the rest.", "explorer", false, "applied"),
    tweak("hidden-files", "Show hidden files", "File Explorer shows hidden files and folders.", "explorer", false, "notApplied"),
    tweak("dark-mode", "Dark mode", "Windows and apps use the dark theme.", "system", false, "applied"),
    tweak("taskbar-left", "Taskbar icons on the left", "Start and the taskbar icons sit on the left.", "taskbar", false, "notApplied"),
    tweak("mouse-acceleration", "Turn off mouse acceleration", "The pointer moves as far as the mouse does.", "system", false, "notApplied"),
    tweak("sticky-keys", "No Sticky Keys prompt", "Pressing Shift five times no longer asks about Sticky Keys.", "system", false, "notApplied"),
  ];
  const app = (id: string, title: string, group: AppGroup, recommended: boolean, installed: boolean, storeId: string | null = null): AppStatus => ({
    id, title, group, recommended, packages: installed ? [`Preview.${id}`] : [], removedByMyle: false, storeId,
  });
  let apps: AppStatus[] = [
    app("clipchamp", "Clipchamp", "microsoft", true, true, "9P1J8S7CCWWT"),
    app("get-started", "Get Started (Tips)", "microsoft", true, true),
    app("office-hub", "Microsoft 365 (Office)", "microsoft", true, true),
    app("solitaire", "Solitaire Collection", "microsoft", true, true),
    app("todo", "Microsoft To Do", "microsoft", true, true),
    app("feedback-hub", "Feedback Hub", "microsoft", true, true),
    app("dev-home", "Dev Home", "microsoft", true, true),
    app("copilot", "Microsoft Copilot", "microsoft", true, true),
    app("calculator", "Calculator", "microsoft", false, true),
    app("photos", "Photos", "microsoft", false, true),
    app("notepad", "Notepad", "microsoft", false, true),
    app("snipping-tool", "Snipping Tool", "microsoft", false, true),
    app("phone-link", "Phone Link", "microsoft", false, true),
    app("bing-news", "Bing News", "bing", true, true, "9WZDNCRFHVFW"),
    app("bing-weather", "Bing Weather", "bing", true, true, "9WZDNCRFJ3Q2"),
    app("bing-search", "Bing Search", "bing", true, true),
    app("xbox-app", "Xbox", "xbox", false, true),
    app("xbox-game-bar", "Xbox Game Bar", "xbox", false, true),
    app("candy-crush", "Candy Crush Saga", "thirdParty", true, true),
    app("tiktok", "TikTok", "thirdParty", true, true),
    app("spotify", "Spotify", "thirdParty", false, true),
    app("maps", "Maps", "microsoft", true, false),
  ];
  const run = async (ids: string[], appIds: string[], onEvent: (event: DebloatEvent) => void, undo: boolean) => {
    let changed = 0;
    for (const id of ids) {
      const found = tweaks.find((t) => t.id === id);
      if (!found) continue;
      const label = undo ? `Undo: ${found.title}` : found.title;
      onEvent({ event: "step", data: { id, label, state: "running", detail: null } });
      await wait(id === "edge" ? 2200 : 450);
      const already = !undo && found.state === "applied";
      onEvent({ event: "step", data: { id, label, state: already ? "unchanged" : "done", detail: null } });
      if (!already) changed++;
      tweaks = tweaks.map((t) => (t.id === id ? { ...t, state: undo ? "notApplied" : "applied", canUndo: !undo } : t));
    }
    for (const appId of appIds) {
      const found = apps.find((a) => a.id === appId);
      if (!found?.packages.length) continue;
      const id = `app:${appId}`;
      onEvent({ event: "step", data: { id, label: `Remove ${found.title}`, state: "running", detail: null } });
      await wait(350);
      onEvent({ event: "step", data: { id, label: `Remove ${found.title}`, state: "done", detail: null } });
      apps = apps.map((a) => (a.id === appId ? { ...a, packages: [], removedByMyle: true } : a));
      changed++;
    }
    onEvent({ event: "step", data: { id: "explorer", label: "Restart Explorer", state: "running", detail: null } });
    await wait(600);
    onEvent({ event: "step", data: { id: "explorer", label: "Restart Explorer", state: "done", detail: null } });
    return { changed, failed: [], reboot: ids.includes("services"), needsAdmin: false };
  };
  let startMenu: StartMenuStatus = {
    supported: true,
    alignment: "center",
    layout: "default",
    allAppsView: "category",
    hideRecommended: false,
    showRecentApps: true,
    showMostUsedApps: true,
    showRecentFiles: true,
    showRecommendations: true,
    showAccountNotifications: true,
    folders: ["downloads", "settings"],
    hasPinsBackup: false,
  };
  return {
    async status() {
      await wait(250);
      return { windows: { build: 26200, name: "Windows 11 Pro 25H2 (26200.6584)", windows11: true }, tweaks, apps, startMenu, adminReady: false };
    },
    async restorePoint() {
      await wait(1200);
      return { result: "created" };
    },
    run: (tweaksToRun, appIds, onEvent) => run(tweaksToRun, appIds, onEvent, false),
    undo: (ids, onEvent) => run(ids, [], onEvent, true),
    async openStore() {},
    async startMenuSet(update) {
      await wait(150);
      startMenu = { ...startMenu, ...update };
      return startMenu;
    },
    async startMenuHideRecommended(hide) {
      await wait(400);
      startMenu = {
        ...startMenu,
        hideRecommended: hide,
        ...(hide ? { showRecentApps: false, showRecentFiles: false, showRecommendations: false } : { showRecentApps: true, showRecentFiles: true }),
      };
      return startMenu;
    },
    async startMenuApplyPins() {
      await wait(900);
      startMenu = { ...startMenu, hasPinsBackup: true };
      return startMenu;
    },
    async startMenuRestorePins() {
      await wait(700);
      return startMenu;
    },
  };
}

export const debloatApi: DebloatApi = isTauri() ? tauriApi : previewApi();
