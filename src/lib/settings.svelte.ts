import { readFlag, writeFlag } from "./storage";

const PERF_LITE_KEY = "myle.perfLite";

/** Visual preferences that apply to the whole document. */
class Settings {
  perfLite = $state(readFlag(PERF_LITE_KEY, false));

  constructor() {
    this.apply();
  }

  setPerfLite(value: boolean) {
    this.perfLite = value;
    writeFlag(PERF_LITE_KEY, value);
    this.apply();
  }

  private apply() {
    document.documentElement.classList.toggle("perf-lite", this.perfLite);
  }
}

export const settings = new Settings();
