import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/background.css";

import { mount } from "svelte";
import Splash from "./splash/Splash.svelte";
import { hardenWebview } from "./lib/desktop";

hardenWebview();

export default mount(Splash, { target: document.getElementById("splash")! });
