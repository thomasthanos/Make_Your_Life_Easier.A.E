// Every page of the app. Add an entry here and it shows up in the sidebar.
import type { Component } from "svelte";
import Gamepad2 from "@lucide/svelte/icons/gamepad-2";
import Music2 from "@lucide/svelte/icons/music-2";
import PackagePlus from "@lucide/svelte/icons/package-plus";
import Palette from "@lucide/svelte/icons/palette";
import SettingsIcon from "@lucide/svelte/icons/settings";
import Sparkles from "@lucide/svelte/icons/sparkles";
import Gauge from "@lucide/svelte/icons/gauge";
import Wrench from "@lucide/svelte/icons/wrench";
import CreativeHub from "./creative-hub/CreativeHub.svelte";
import GameSaves from "./game-saves/GameSaves.svelte";
import InstallApps from "./install-apps/InstallApps.svelte";
import SpotifyHub from "./spotify-hub/SpotifyHub.svelte";
import Settings from "./settings/Settings.svelte";
import SystemCleaner from "./system-cleaner/SystemCleaner.svelte";
import SystemMaintenance from "./system-maintenance/SystemMaintenance.svelte";
import WindowsOptimization from "./windows-optimization/WindowsOptimization.svelte";

export interface PageDef {
  id: string;
  label: string;
  icon: typeof PackagePlus;
  component: Component;
  /** Pin to the bottom group of the sidebar. */
  bottom?: boolean;
}

const defs = [
  { id: "install-apps", label: "Install Apps", icon: PackagePlus, component: InstallApps },
  { id: "spotify-hub", label: "Spotify Hub", icon: Music2, component: SpotifyHub },
  { id: "game-saves", label: "Game Saves", icon: Gamepad2, component: GameSaves },
  { id: "creative-hub", label: "Creative Hub", icon: Palette, component: CreativeHub },
  { id: "windows-optimization", label: "Windows Optimization", icon: Gauge, component: WindowsOptimization },
  { id: "system-cleaner", label: "System Cleaner", icon: Sparkles, component: SystemCleaner },
  { id: "system-maintenance", label: "System Maintenance", icon: Wrench, component: SystemMaintenance },
  { id: "settings", label: "Settings", icon: SettingsIcon, component: Settings, bottom: true },
] as const satisfies readonly PageDef[];

export type PageId = (typeof defs)[number]["id"];

export const pages: readonly (PageDef & { id: PageId })[] = defs;
