//! Real changes to Windows, for Windows Sandbox or a throwaway VM only:
//! every tweak is applied and undone for real, and everything must be back
//! exactly as it was. They refuse to run anywhere else.
//!
//! In the sandbox, as administrator:
//!   set MYLE_DEBLOAT_SANDBOX=1
//!   myle_lib-<hash>.exe sandbox_ --ignored --test-threads=1 --nocapture

use super::catalog::{self, Hive, Op, TWEAKS};
use super::helper::{self, Request};
use super::system::{self, Value};
use super::undo::Saved;
use super::{apply_user, detect, undo_user};

/// Only in Windows Sandbox (its account) or where a VM says so explicitly.
fn throwaway_windows() {
    assert_eq!(
        std::env::var("MYLE_DEBLOAT_SANDBOX").as_deref(),
        Ok("1"),
        "These tests change Windows: run them only in Windows Sandbox or a throwaway VM, with MYLE_DEBLOAT_SANDBOX=1."
    );
    let user = std::env::var("USERNAME").unwrap_or_default();
    assert!(
        user.eq_ignore_ascii_case("WDAGUtilityAccount") || std::env::var("MYLE_DEBLOAT_VM").as_deref() == Ok("1"),
        "Not Windows Sandbox (user {user}); in a VM also set MYLE_DEBLOAT_VM=1."
    );
}

/// Everything the tweaks touch, as it is now.
#[derive(Debug, PartialEq)]
enum Seen {
    Reg { value: Value, key: bool },
    Service(Option<catalog::Start>),
    Task(Option<bool>),
    Clock(String, String),
    Other,
}

fn look(op: &Op) -> Seen {
    match *op {
        Op::Reg { hive, path, name, .. } => Seen::Reg {
            value: system::read(hive, path, name),
            key: system::first_missing(hive, path).is_none(),
        },
        Op::Service { name, .. } => Seen::Service(system::start_type(name).unwrap()),
        Op::Task { folder, name } => Seen::Task(system::task_enabled(folder, name).unwrap()),
        Op::Clock24 => {
            let (short, long) = system::time_formats().unwrap();
            Seen::Clock(short, long)
        }
        Op::Appx { .. } | Op::RemoveEdge => Seen::Other,
    }
}

fn apply(tweak: &'static catalog::Tweak) -> Vec<Saved> {
    let (mut saved, errors) = apply_user(tweak);
    assert!(errors.is_empty(), "{}: {errors:?}", tweak.id);
    let reply = helper::handle(Request::Apply { tweak: tweak.id.into() });
    assert!(reply.errors.is_empty(), "{}: {:?}", tweak.id, reply.errors);
    saved.extend(reply.saved);
    saved
}

fn undo(tweak: &'static catalog::Tweak, saved: &[Saved]) {
    let (undone, errors) = undo_user(tweak, saved);
    assert!(errors.is_empty(), "{}: {errors:?}", tweak.id);
    let machine: Vec<Saved> = saved.iter().filter(|record| !undone.contains(&record.op)).cloned().collect();
    let reply = helper::handle(Request::Undo { tweak: tweak.id.into(), saved: machine.clone() });
    assert!(reply.errors.is_empty(), "{}: {:?}", tweak.id, reply.errors);
    assert_eq!(reply.undone.len() + undone.len(), saved.len(), "{}: everything kept was put back", tweak.id);
}

#[test]
#[ignore = "changes Windows: Windows Sandbox or a throwaway VM only"]
fn sandbox_every_tweak_applies_and_undoes_exactly() {
    throwaway_windows();
    let build = system::windows_info().build;
    let tweaks: Vec<&'static catalog::Tweak> = TWEAKS
        .iter()
        .filter(|tweak| tweak.builds.contains(build) && !tweak.ops.iter().any(|op| matches!(op, Op::RemoveEdge | Op::Appx { .. })))
        .collect();
    let before: Vec<Vec<Seen>> = tweaks.iter().map(|tweak| tweak.ops.iter().map(look).collect()).collect();

    let mut kept = Vec::new();
    for tweak in &tweaks {
        let saved = apply(tweak);
        let state = detect::tweak_state(tweak, build, &system::installed_packages());
        println!("{:<24} applied: {state:?} ({} kept)", tweak.id, saved.len());
        assert_eq!(state, detect::State::Applied, "{}", tweak.id);
        kept.push(saved);
    }
    // Applying again changes nothing and keeps nothing new.
    for tweak in &tweaks {
        assert!(apply(tweak).is_empty(), "{} applied twice", tweak.id);
    }
    for (tweak, saved) in tweaks.iter().zip(&kept) {
        undo(tweak, saved);
    }

    let after: Vec<Vec<Seen>> = tweaks.iter().map(|tweak| tweak.ops.iter().map(look).collect()).collect();
    for ((tweak, was), is) in tweaks.iter().zip(&before).zip(&after) {
        for (index, (was, is)) in was.iter().zip(is).enumerate() {
            // A value Windows refused (best effort) was never changed.
            assert_eq!(was, is, "{} op {index} is not as it was", tweak.id);
        }
        println!("{:<24} back exactly as it was", tweak.id);
    }
}

#[test]
#[ignore = "changes Windows: Windows Sandbox or a throwaway VM only"]
fn sandbox_edge_goes_and_webview2_stays() {
    throwaway_windows();
    if !system::edge_installed() {
        println!("Edge is not installed here: nothing to test.");
        return;
    }
    let webview = system::program_files_x86().join(r"Microsoft\EdgeWebView\Application");
    let had_webview = webview.is_dir();
    let edge = catalog::find("edge").unwrap();
    let reply = helper::handle(Request::Apply { tweak: edge.id.into() });
    assert!(reply.errors.is_empty(), "{:?}", reply.errors);
    assert!(!system::edge_installed(), "Edge is gone");
    assert_eq!(webview.is_dir(), had_webview, "WebView2 stays");
    let allow = system::read(Hive::Machine, r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdateDev", "AllowUninstall");
    assert_eq!(allow, Value::Absent, "the uninstall permission is taken back");
}

#[test]
#[ignore = "changes Windows: Windows Sandbox or a throwaway VM only"]
fn sandbox_a_restore_point_is_made() {
    throwaway_windows();
    let reply = helper::handle(Request::RestorePoint { turn_on: true });
    println!("{:?}", reply.restore_point);
    assert!(reply.restore_point.is_some());
}
