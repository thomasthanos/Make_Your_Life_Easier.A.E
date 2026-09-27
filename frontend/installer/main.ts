import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/background.css";
import "../styles/controls.css";

import { mount } from "svelte";
import Setup from "./Setup.svelte";
import { hardenWebview } from "../lib/desktop";

hardenWebview();

export default mount(Setup, { target: document.getElementById("setup")! });
