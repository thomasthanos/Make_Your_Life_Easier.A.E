// The toolbar popup: the logins saved for the site in the current tab and
// for the sign-in frames inside it. It is part of the browser, not of the
// page, so it is also the safe way to fill a form embedded from another site.
const ext = globalThis.browser ?? globalThis.chrome;
const content = document.getElementById("content");
const site = document.getElementById("site");
const searchRow = document.getElementById("search-row");
const search = document.getElementById("search");

const send = (message) => ext.runtime.sendMessage(message).catch(() => ({ ok: false, error: "noHost" }));

const reasons = {
  noFields: "No sign-in field is ready in this page or frame. Open the sign-in form and try again.",
  noContent: "The sign-in frame is not ready. Reload the page and try again.",
  pageChanged: "The page changed while filling. Open the sign-in form and try again.",
  ambiguousFields: "This page has several password fields. Click the one to fill in the page, then try again.",
  insecureForm: "This form would send your password over plain http, so it is not filled.",
  locked: "Your vault locked meanwhile. Unlock it in MYLE and try again.",
  busy: "Too many requests in the last minute. Wait a moment and try again.",
  wrongSite: "That login is saved for another website.",
  notFound: "That login is no longer in your vault.",
};

async function openApp() {
  await send({ type: "open" });
  window.close();
}

/** A message in place of the list, with a button when there is something to do. */
function state(title, text, action) {
  const box = document.createElement("div");
  box.className = "state";
  const heading = document.createElement("b");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = text;
  box.append(heading, body);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = action;
    button.addEventListener("click", openApp);
    box.append(button);
  }
  searchRow.hidden = true;
  content.replaceChildren(box);
  box.querySelector("button")?.focus();
}

function explain(error) {
  switch (error) {
    case "locked":
      return state("Your vault is locked", "Unlock it in MYLE, then open this again.", "Unlock in MYLE");
    case "noVault":
      return state("No vault yet", "Create your password vault in MYLE first.", "Open MYLE");
    case "notRunning":
      return state("MYLE is not running", "Open it to fill in your logins.", "Open MYLE");
    case "noHost":
    case "disabled":
      return state("Browser filling is off", "Turn it on in MYLE: Password Manager → ⋯ → Browser filling.");
    case "insecure":
      return state("Not a secure page", "Logins are filled only on https pages.");
    case "busy":
      return state("Busy", reasons.busy);
    default:
      return state("Something went wrong", "Reload the page and try again.");
  }
}

function feedback(text) {
  content.querySelector(".feedback")?.remove();
  const p = document.createElement("p");
  p.className = "feedback";
  p.setAttribute("role", "alert");
  p.textContent = text;
  content.prepend(p);
}

/** A site's colour, the same every time (as in the app). */
function hueOf(text) {
  let hash = 7;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** The website's icon when MYLE has one, else the first letter on the site's colour. */
function avatarFor(login) {
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  const title = login.title || login.site || "?";
  avatar.style.setProperty("--hue", String(hueOf(login.site || title.toLowerCase())));
  const letter = (title.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  if (typeof login.icon === "string" && login.icon.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.alt = "";
    img.addEventListener("error", () => {
      avatar.classList.remove("image");
      avatar.replaceChildren(letter);
    });
    img.src = login.icon;
    avatar.classList.add("image");
    avatar.append(img);
  } else {
    avatar.textContent = letter;
  }
  return avatar;
}

function row(login, tabId) {
  const item = document.createElement("div");
  item.className = "login";
  const avatar = avatarFor(login);
  const text = document.createElement("span");
  text.className = "text";
  const title = document.createElement("b");
  title.textContent = login.title || login.site || "Login";
  const user = document.createElement("small");
  user.textContent = login.username || "No user name";
  // Saved for another host of this site, or for a frame from another site.
  const where = [login.exact ? "" : login.site, login.embedded ? `in a frame from ${login.frameSite}` : ""]
    .filter(Boolean).join(", ");
  if (where) {
    const other = document.createElement("span");
    other.className = "other";
    other.textContent = ` · ${where}`;
    user.append(other);
  }
  text.title = [title.textContent, user.textContent].join("\n");
  text.append(title, user);
  const fill = document.createElement("button");
  fill.type = "button";
  fill.textContent = "Fill";
  fill.addEventListener("click", async () => {
    fill.disabled = true;
    fill.textContent = "Filling…";
    const result = await send({ type: "fillTab", tabId, frameId: login.frameId, id: login.id });
    if (result?.ok && result.applied) {
      window.close();
    } else {
      feedback(reasons[result?.error] ?? "This login could not be filled. Try the sign-in field in the page.");
      fill.disabled = false;
      fill.textContent = "Fill";
    }
  });
  item.append(avatar, text, fill);
  item.dataset.search = [login.title, login.username, login.site, login.frameSite].join(" ").toLowerCase();
  return item;
}

function filter() {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const item of content.querySelectorAll(".login")) {
    item.hidden = !words.every((word) => item.dataset.search.includes(word));
    if (!item.hidden) shown++;
  }
  content.querySelector(".none")?.remove();
  if (!shown) {
    const none = document.createElement("p");
    none.className = "note none";
    none.textContent = "No login matches.";
    content.append(none);
  }
}

async function load() {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  let topSite = "";
  try {
    topSite = new URL(tab?.url ?? "").hostname.replace(/^www\./, "");
  } catch {
    // Not a web page.
  }
  site.textContent = topSite || "No website";
  if (!Number.isInteger(tab?.id) || !tab?.url || !/^https:\/\/|^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(tab.url)) {
    return state("Nothing to fill here", "Open a sign-in page to fill in a login.");
  }
  const answer = await send({ type: "tabLogins", tabId: tab.id });
  if (!answer?.ok) return explain(answer?.error);
  if (!answer.logins.length) {
    return state("No saved login", `Nothing is saved for ${topSite} or its sign-in frames yet. Add this website to a login in MYLE.`);
  }
  content.replaceChildren(...answer.logins.map((login) => row(login, tab.id)));
  if (answer.logins.length > 4) {
    searchRow.hidden = false;
    search.focus();
  } else {
    content.querySelector(".login button")?.focus();
  }
}

search.addEventListener("input", filter);
search.addEventListener("keydown", (event) => {
  const first = [...content.querySelectorAll(".login")].find((item) => !item.hidden);
  if (event.key === "Enter" && first) first.querySelector("button").click();
  if (event.key === "ArrowDown" && first) {
    event.preventDefault();
    first.querySelector("button").focus();
  }
});
content.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const buttons = [...content.querySelectorAll(".login:not([hidden]) button")];
  const at = buttons.indexOf(document.activeElement);
  if (at < 0) return;
  event.preventDefault();
  const next = at + (event.key === "ArrowDown" ? 1 : -1);
  if (next < 0 && !searchRow.hidden) search.focus();
  else buttons[Math.max(0, Math.min(next, buttons.length - 1))].focus();
});
document.getElementById("open").addEventListener("click", openApp);

void load().catch(() => state("Could not read this tab", "Reload the page and try again."));
