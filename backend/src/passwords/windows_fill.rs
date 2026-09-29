//! User-invoked filling into a Windows program. Ctrl+Shift+L remembers the
//! foreground program; the vault page lets the user choose one linked login
//! and which value to type into the field that was focused there.

use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::ptr::null_mut;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, RegisterHotKey, SendInput, UnregisterHotKey, VK_L,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetGUIThreadInfo, GetMessageW, GetWindowThreadProcessId, IsWindow, MSG,
    SetForegroundWindow, GUITHREADINFO, WM_HOTKEY,
};
use zeroize::Zeroizing;

use super::{PasswordsState, browser};

const HOTKEY_ID: i32 = 0x4d59;
const TARGET_LIFETIME: Duration = Duration::from_secs(90);
pub const TARGET_EVENT: &str = "passwords-windows-target";
const BROWSERS: [&str; 4] = ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"];

fn linked_exe(value: &str) -> &str {
    value.rsplit(['\\', '/']).next().unwrap_or(value).trim_matches('"')
}

fn same_path(left: &Path, right: &Path) -> bool {
    let left = left.canonicalize().unwrap_or_else(|_| left.to_path_buf());
    let right = right.canonicalize().unwrap_or_else(|_| right.to_path_buf());
    left.to_string_lossy().eq_ignore_ascii_case(&right.to_string_lossy())
}

fn focused_control(thread: u32) -> Option<usize> {
    let mut info = GUITHREADINFO { cbSize: size_of::<GUITHREADINFO>() as u32, ..Default::default() };
    if unsafe { GetGUIThreadInfo(thread, &mut info) } == 0 || info.hwndFocus.is_null() {
        return None;
    }
    Some(info.hwndFocus as usize)
}

#[derive(Clone, Serialize)]
pub struct WindowsTargetInfo {
    exe: String,
    path: String,
}

#[derive(Clone)]
struct Target {
    window: usize,
    pid: u32,
    thread: u32,
    focus: Option<usize>,
    exe: String,
    path: PathBuf,
    at: Instant,
}

#[derive(Clone, Default)]
pub struct WindowsFillState {
    target: Arc<Mutex<Option<Target>>>,
    available: Arc<AtomicBool>,
}

pub fn start(app: AppHandle, target: WindowsFillState) {
    std::thread::spawn(move || unsafe {
        if RegisterHotKey(null_mut(), HOTKEY_ID, MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT, VK_L as u32) == 0 {
            return;
        }
        target.available.store(true, Ordering::Release);
        let mut message: MSG = std::mem::zeroed();
        while GetMessageW(&mut message, null_mut(), 0, 0) > 0 {
            if message.message != WM_HOTKEY || message.wParam != HOTKEY_ID as usize {
                continue;
            }
            let window = GetForegroundWindow();
            if window.is_null() {
                continue;
            }
            let mut pid = 0;
            let thread = GetWindowThreadProcessId(window, &mut pid);
            let Some(path) = browser::process_path(pid) else { continue };
            let Some(exe) = path.file_name().and_then(|name| name.to_str()).map(str::to_lowercase) else { continue };
            if pid == std::process::id() || BROWSERS.contains(&exe.as_str()) {
                continue;
            }
            *target.target.lock().unwrap_or_else(|p| p.into_inner()) = Some(Target {
                window: window as usize,
                pid,
                thread,
                focus: focused_control(thread),
                exe: exe.clone(),
                path: path.clone(),
                at: Instant::now(),
            });
            let _ = app.emit(TARGET_EVENT, WindowsTargetInfo {
                exe,
                path: path.to_string_lossy().into_owned(),
            });
            browser::open_vault(&app);
        }
        target.available.store(false, Ordering::Release);
        UnregisterHotKey(null_mut(), HOTKEY_ID);
    });
}

#[tauri::command]
pub fn passwords_windows_hotkey_status(target: State<'_, WindowsFillState>) -> bool {
    target.available.load(Ordering::Acquire)
}

#[tauri::command]
pub fn passwords_windows_fill(
    target: State<'_, WindowsFillState>,
    state: State<'_, PasswordsState>,
    id: String,
    field: String,
) -> Result<(), String> {
    if !matches!(field.as_str(), "username" | "password") {
        return Err("Choose a user name or password.".into());
    }
    let selected = target.target.lock().unwrap_or_else(|p| p.into_inner()).clone()
        .ok_or("Press Ctrl+Shift+L in the program again.")?;
    if selected.at.elapsed() > TARGET_LIFETIME {
        return Err("The program selection expired. Press Ctrl+Shift+L there again.".into());
    }
    let window = selected.window as *mut c_void;
    let mut pid = 0;
    let thread = unsafe { GetWindowThreadProcessId(window, &mut pid) };
    if unsafe { IsWindow(window) } == 0 || pid != selected.pid || thread != selected.thread ||
        !browser::process_path(pid).is_some_and(|path| same_path(&path, &selected.path))
    {
        return Err("That program window has closed. Press Ctrl+Shift+L again.".into());
    }

    // Check the link again at the moment of filling. A stale UI selection
    // cannot type a credential into a different program.
    let value = state.with(|vault| {
        let entry = vault.summaries()?.into_iter().find(|entry| entry.id == id)
            .ok_or("That login no longer exists.")?;
        if !entry.apps.iter().any(|app| {
            let linked = Path::new(app.exe.trim_matches('"'));
            linked.is_absolute() && same_path(linked, &selected.path)
        }) {
            let name_match = entry.apps.iter().any(|app| linked_exe(&app.exe).eq_ignore_ascii_case(&selected.exe));
            return Err(if name_match {
                "This login is linked by file name only. Edit it and link the full program path shown above."
            } else {
                "This login is not linked to that program."
            }.into());
        }
        if field == "password" {
            vault.password(&id)
        } else {
            Ok(Zeroizing::new(vault.username(&id)?))
        }
    })?;
    if value.is_empty() {
        return Err("The selected field is empty in this login.".into());
    }

    if unsafe { SetForegroundWindow(window) } == 0 {
        return Err("Windows could not focus that program. Click its field and try again.".into());
    }
    std::thread::sleep(Duration::from_millis(40));
    if unsafe { GetForegroundWindow() } != window {
        return Err("Windows could not focus that program. Click its field and try again.".into());
    }
    let Some(focus) = selected.focus else {
        return Err("Windows could not identify the focused field. Click it and press Ctrl+Shift+L again.".into());
    };
    if focused_control(thread) != Some(focus) {
        return Err("The focused field changed. Click the intended field and press Ctrl+Shift+L again.".into());
    }
    type_text(&value, window, thread, focus)?;
    *target.target.lock().unwrap_or_else(|p| p.into_inner()) = None;
    Ok(())
}

fn type_text(text: &str, window: *mut c_void, thread: u32, focus: usize) -> Result<(), String> {
    for unit in text.encode_utf16() {
        if unsafe { GetForegroundWindow() } != window || focused_control(thread) != Some(focus) {
            return Err("The focused field changed while filling. Click it and press Ctrl+Shift+L again.".into());
        }
        let mut inputs = [INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: 0, wScan: unit, dwFlags: KEYEVENTF_UNICODE, time: 0, dwExtraInfo: 0 } },
        }, INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: 0, wScan: unit, dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } },
        }];
        let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<INPUT>() as i32) };
        // The scan code carries one UTF-16 unit of the secret.
        unsafe { std::ptr::write_volatile(&mut inputs, std::mem::zeroed()) };
        if sent != 2 {
            return Err("Windows blocked typing into that program. Try copying the field instead.".into());
        }
    }
    Ok(())
}
