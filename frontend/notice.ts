import "./styles/tokens.css";
import "./styles/base.css";

import { mount } from "svelte";
import Notice from "./notice/Notice.svelte";
import { hardenWebview } from "./lib/desktop";

hardenWebview();

export default mount(Notice, { target: document.getElementById("notice")! });
