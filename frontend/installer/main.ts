import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/background.css";
import "../styles/controls.css";

import { mount } from "svelte";
import Setup from "./Setup.svelte";
import { hardenWebview } from "../lib/desktop";

// Solid panels, like the app by default (see lib/settings.svelte.ts).
document.documentElement.classList.add("solid");
hardenWebview();

export default mount(Setup, { target: document.getElementById("setup")! });
