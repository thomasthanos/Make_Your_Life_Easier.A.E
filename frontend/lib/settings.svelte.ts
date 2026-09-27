import { readFlag, writeFlag } from "./storage";

const GLASS_KEY = "myle.glass";

/**
 * Visual preferences that apply to the whole document.
 *
 * Solid panels are the design; "Glass effects" turns on the translucent,
 * blurred look instead. `:root.solid` is set whenever glass is off, and the
 * splash and the setup window always use it.
 */
class Settings {
  glass = $state(readFlag(GLASS_KEY, false));

  constructor() {
    this.apply();
  }

  /** Re-reads the saved value (after account sync replaced it). */
  reload() {
    this.glass = readFlag(GLASS_KEY, this.glass);
    this.apply();
  }

  setGlass(value: boolean) {
    this.glass = value;
    writeFlag(GLASS_KEY, value);
    this.apply();
  }

  private apply() {
    document.documentElement.classList.toggle("solid", !this.glass);
  }
}

export const settings = new Settings();
