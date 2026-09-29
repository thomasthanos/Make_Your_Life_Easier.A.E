// MYLE Passwords: the go-between for the page and the app.
//
// Pages (content.js) and the popup ask here; this asks the app through the
// native messaging host ("com.thomasthanos.myle"). The page's address always
// comes from the browser (sender.url or webNavigation), never from the page.
//
// Our script in a page may ask only about its own frame: its logins, a fill,
// a new password, and saving what the user typed and sent there. A sign-in
// form embedded from another site is filled only from the toolbar popup,
// where the user sees whose it is. Only the popup looks across a tab's frames.
const ext = globalThis.browser ?? globalThis.chrome;
const HOST = "com.thomasthanos.myle";
const OWN_PAGES = ext.runtime.getURL("");
/** A sent login waits this long for the next page, and then for a click. */
const WAIT_FOR_PAGE = 60_000;
const WAIT_FOR_CLICK = 3 * 60_000;
/** A password suggested in a sign-up form, until that form is sent. */
const KEEP_SUGGESTED = 30 * 60_000;

async function ask(message) {
  try {
    return await ext.runtime.sendNativeMessage(HOST, message);
  } catch (error) {
    // The app is not installed, or browser filling is off in it.
    return { ok: false, error: "noHost", detail: String(error?.message ?? error) };
  }
}

function hostOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The same host, or one inside the other (login.example.com, example.com). */
function sameSite(a, b) {
  const ha = hostOf(a);
  const hb = hostOf(b);
  return !!ha && !!hb && (ha === hb || ha.endsWith(`.${hb}`) || hb.endsWith(`.${ha}`));
}

function allowedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

const text = (value, max) => typeof value === "string" && value.length <= max;
const refused = { ok: false, error: "badRequest" };

// --- Who is asking ------------------------------------------------------------

/** One of this extension's own pages: the toolbar popup. */
const fromPopup = (sender) => typeof sender.url === "string" && sender.url.startsWith(OWN_PAGES);

/** Our script in a frame of a page we fill, in the tab the user is looking at. */
const fromPage = (sender) =>
  !fromPopup(sender) &&
  Number.isInteger(sender.tab?.id) &&
  sender.tab.active !== false &&
  Number.isInteger(sender.frameId) &&
  allowedUrl(sender.url) &&
  (!sender.documentLifecycle || sender.documentLifecycle === "active");

/** For a frame inside a page of another site: that page's host, else "". */
async function embeddedIn(sender) {
  if (sender.frameId === 0) return "";
  let top = "";
  try {
    top = (await ext.webNavigation.getFrame({ tabId: sender.tab.id, frameId: 0 }))?.url ?? "";
  } catch {
    // Not known: treated as another site.
  }
  return sameSite(sender.url, top) ? "" : hostOf(top) || "another site";
}

let lastOpen = 0;

/** Brings MYLE forward, at most every two seconds. */
function openApp() {
  if (Date.now() - lastOpen < 2000) return { ok: true };
  lastOpen = Date.now();
  return ask({ type: "open" });
}

// --- The popup: every sign-in frame of the tab ------------------------------------

async function framesFor(tabId) {
  if (!Number.isInteger(tabId)) return null;
  const tab = await ext.tabs.get(tabId);
  if (!tab?.active) return null;
  const frames = await ext.webNavigation.getAllFrames({ tabId });
  return (frames ?? [])
    .filter((frame) => allowedUrl(frame.url) && (!frame.documentLifecycle || frame.documentLifecycle === "active"))
    .sort((a, b) => a.frameId - b.frameId);
}

async function inspectFrame(tabId, frameId) {
  try {
    const reply = await ext.tabs.sendMessage(tabId, { type: "inspect" }, { frameId });
    return {
      fields: reply?.fields === true,
      password: reply?.password === true,
      focused: reply?.focused === true,
      insecure: reply?.insecure === true,
    };
  } catch {
    return { fields: false, password: false, focused: false, insecure: false };
  }
}

async function loginsForTab(tabId) {
  let frames;
  try {
    frames = await framesFor(tabId);
  } catch {
    return { ok: false, error: "pageChanged" };
  }
  if (!frames?.length) return { ok: false, error: "insecure" };
  const topUrl = frames.find((frame) => frame.frameId === 0)?.url ?? "";

  const items = [];
  const seen = new Map();
  // The main page is useful even before its sign-in form appears. For embedded
  // sites, list only frames where our content script sees a login field.
  for (const frame of frames) {
    const inspection = await inspectFrame(tabId, frame.frameId);
    if (frame.frameId !== 0 && !inspection.fields) continue;
    const answer = await ask({ type: "logins", url: frame.url });
    if (!answer?.ok) return answer;
    const frameSite = hostOf(frame.url);
    const embedded = frame.frameId !== 0 && !sameSite(frame.url, topUrl);
    const rank = Number(inspection.fields) + Number(inspection.password) + Number(inspection.focused) * 2;
    for (const login of answer.logins ?? []) {
      const key = `${new URL(frame.url).origin}:${login.id}`;
      const item = { ...login, frameId: frame.frameId, frameSite, embedded };
      const previous = seen.get(key);
      if (previous) {
        // Prefer the frame whose sign-in field is focused, then a password
        // field over a lone email field on the same origin.
        if (rank > previous.rank) {
          items[previous.index] = item;
          previous.rank = rank;
        }
      } else {
        seen.set(key, { index: items.length, rank });
        items.push(item);
      }
    }
  }
  return { ok: true, logins: items, site: hostOf(topUrl) };
}

async function fillTab(tabId, frameId, id) {
  if (!Number.isInteger(frameId) || !text(id, 100)) return refused;
  let frames;
  try {
    frames = await framesFor(tabId);
  } catch {
    return { ok: false, error: "pageChanged" };
  }
  const frame = frames?.find((item) => item.frameId === frameId);
  if (!frame) return { ok: false, error: "pageChanged" };
  const inspection = await inspectFrame(tabId, frameId);
  if (!inspection.fields) return { ok: false, error: "noFields" };
  // Refused before the vault is asked for the password.
  if (inspection.insecure) return { ok: false, error: "insecureForm" };

  // Authorize the real frame URL with the vault immediately before sending to
  // that exact frame. The content script checks its origin once more.
  const credentials = await ask({ type: "fill", id, url: frame.url });
  if (!credentials?.ok) return credentials;
  try {
    const current = (await framesFor(tabId))?.find((item) => item.frameId === frameId);
    if (!current || current.url !== frame.url) return { ok: false, error: "pageChanged" };
    const reply = await ext.tabs.sendMessage(tabId, {
      type: "apply",
      origin: new URL(frame.url).origin,
      username: credentials.username,
      password: credentials.password,
    }, { frameId });
    return reply?.applied === true ? { ok: true, applied: true } :
      { ok: false, error: reply?.error ?? "noFields" };
  } catch {
    return { ok: false, error: "noContent" };
  }
}

// --- Offering to save ------------------------------------------------------------
//
// A login the user typed and sent is kept in the browser's memory (never on
// disk), under a random nonce, until the next page of that site offers to
// save it. The page gets only the nonce and the user name back, never the
// password, and "save" works only with the nonce of an offer it was shown.

const pendingKey = (tabId) => `pending:${tabId}`;
const suggestedKey = (tabId) => `suggested:${tabId}`;

async function readPending(tabId) {
  const key = pendingKey(tabId);
  const found = (await ext.storage.session.get(key))[key];
  if (!found) return null;
  if (Date.now() >= (found.shownAt ? found.shownAt + WAIT_FOR_CLICK : found.at + WAIT_FOR_PAGE)) {
    await ext.storage.session.remove(key);
    return null;
  }
  return found;
}

/** A strong password from the app, for the sign-up form the user clicked. */
async function suggest(sender) {
  const answer = await ask({ type: "generate" });
  if (answer?.ok) {
    await ext.storage.session.set({
      [suggestedKey(sender.tab.id)]: { password: answer.password, url: sender.url, at: Date.now() },
    });
  }
  return answer;
}

async function submitted(message, sender) {
  if (!text(message.username, 256) || !text(message.password, 512) || !message.password) return refused;
  const tabId = sender.tab.id;
  const known = await ask({ type: "known", url: sender.url, username: message.username, password: message.password });
  let offer = known?.ok && !known.known;
  if (!known?.ok && known?.error === "locked") {
    // A password MYLE suggested is offered even while the vault is locked:
    // the user may know no other copy of it.
    const key = suggestedKey(tabId);
    const suggested = (await ext.storage.session.get(key))[key];
    offer = suggested?.password === message.password && Date.now() - suggested.at < KEEP_SUGGESTED &&
      sameSite(suggested.url, sender.url);
  }
  if (offer) {
    await ext.storage.session.set({
      [pendingKey(tabId)]: {
        url: sender.url,
        username: message.username,
        password: message.password,
        update: known?.update === true,
        at: Date.now(),
        nonce: crypto.randomUUID(),
      },
    });
  }
  return { ok: true };
}

async function offer(sender) {
  const found = await readPending(sender.tab.id);
  // An identity provider can redirect through another site before returning
  // to the sign-in site: the offer waits for a page of that site.
  if (!found || !sameSite(found.url, sender.url)) return null;
  if (!found.shownAt) {
    found.shownAt = Date.now();
    await ext.storage.session.set({ [pendingKey(sender.tab.id)]: found });
  }
  return { nonce: found.nonce, username: found.username, update: found.update, site: hostOf(found.url) };
}

async function answerOffer(message, sender, save) {
  if (!text(message.nonce, 64)) return refused;
  const found = await readPending(sender.tab.id);
  if (!found?.shownAt || found.nonce !== message.nonce || !sameSite(found.url, sender.url)) {
    return { ok: false, error: "expired" };
  }
  if (save) {
    const answer = await ask({ type: "save", url: found.url, username: found.username, password: found.password });
    // Locked, say: the offer stays, to save once the vault is open.
    if (!answer?.ok) return answer;
  }
  await ext.storage.session.remove([pendingKey(sender.tab.id), suggestedKey(sender.tab.id)]);
  return { ok: true };
}

ext.tabs.onRemoved.addListener((tabId) => {
  void ext.storage.session.remove([pendingKey(tabId), suggestedKey(tabId)]);
});

// --- Requests ---------------------------------------------------------------------

async function handle(message, sender) {
  if (typeof message?.type !== "string") return refused;
  if (fromPopup(sender)) {
    switch (message.type) {
      case "status":
        return ask({ type: "status" });
      case "open":
        return openApp();
      case "tabLogins":
        return loginsForTab(message.tabId);
      case "fillTab":
        return fillTab(message.tabId, message.frameId, message.id);
      default:
        return refused;
    }
  }
  if (!fromPage(sender)) return refused;
  switch (message.type) {
    case "open":
      return openApp();
    case "logins":
    case "fill":
    case "generate": {
      const top = await embeddedIn(sender);
      if (top) return { ok: false, error: "embedded", site: hostOf(sender.url), top };
      if (message.type === "logins") return ask({ type: "logins", url: sender.url });
      if (message.type === "generate") return suggest(sender);
      return text(message.id, 100) ? ask({ type: "fill", id: message.id, url: sender.url }) : refused;
    }
    case "submitted":
      // A form sent to the app: ask whether the login is new, and if so offer
      // to save it on the next page (the form usually navigates).
      return (await embeddedIn(sender)) ? { ok: true } : submitted(message, sender);
    case "pending":
      return sender.frameId === 0 ? offer(sender) : null;
    case "save":
    case "dismiss":
      return sender.frameId === 0 ? answerOffer(message, sender, message.type === "save") : refused;
    default:
      return { ok: false, error: "unknown" };
  }
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only this extension's own pages and scripts.
  if (sender.id !== ext.runtime.id) return false;
  handle(message, sender).then(sendResponse, () => sendResponse({ ok: false, error: "failed" }));
  return true;
});
