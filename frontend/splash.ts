import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/background.css";

import { mount } from "svelte";
import Splash from "./splash/Splash.svelte";
import ContextMenuHost from "./lib/components/ContextMenuHost.svelte";
import { hardenWebview } from "./lib/desktop";

// Solid panels always, like the app by default (see lib/settings.svelte.ts).
document.documentElement.classList.add("solid");
hardenWebview();
mount(ContextMenuHost, { target: document.body });

export default mount(Splash, { target: document.getElementById("splash")! });
