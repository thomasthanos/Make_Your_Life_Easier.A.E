//! Where each tweak stands on this PC, read without administrator rights:
//! the registry, services, scheduled tasks, the time format and the
//! installed Store apps.

use serde::Serialize;

use super::catalog::{self, Hive, Op, Tweak};
use super::system;
use super::undo::Store;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum State {
    Applied,
    NotApplied,
    /// Some of it is in place.
    Partial,
    /// Not for this version of Windows.
    Unavailable,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TweakStatus {
    pub id: &'static str,
    pub title: &'static str,
    pub summary: &'static str,
    pub category: catalog::Category,
    pub risk: catalog::Risk,
    pub debloat: bool,
    pub confirm: Option<&'static str>,
    pub state: State,
    /// MYLE applied it and kept what was there before.
    pub can_undo: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub id: &'static str,
    pub title: &'static str,
    pub group: catalog::AppGroup,
    pub recommended: bool,
    /// Its packages installed for this user; empty when it is not.
    pub packages: Vec<String>,
    /// Removed by MYLE: it can be installed again from the Store.
    pub removed_by_myle: bool,
    pub store_id: Option<&'static str>,
}

/// One operation's standing: `None` when it does not apply here (a
/// service or task this PC does not have, or one the user set by hand).
fn op_applied(op: &Op, packages: &[String]) -> Option<bool> {
    match *op {
        Op::Reg { best_effort: true, .. } => None,
        Op::Reg { hive, path, name, data, .. } => Some(system::read(hive, path, name).matches(data)),
        Op::Service { name, to, from } => {
            let current = system::start_type(name).ok()??;
            if current.rank() >= to.rank() {
                Some(true)
            } else if from.contains(&current) {
                Some(false)
            } else {
                None
            }
        }
        Op::Task { folder, name } => system::task_enabled(folder, name).ok()?.map(|enabled| !enabled),
        Op::Appx { app } => {
            let name = catalog::Name::Exact(app);
            Some(!packages.iter().any(|package| name.matches(package)))
        }
        Op::Clock24 => system::time_formats().ok().map(|(short, _)| system::is_24h(&short)),
        Op::RemoveEdge => Some(!system::edge_installed()),
    }
}

pub fn tweak_state(tweak: &Tweak, build: u32, packages: &[String]) -> State {
    if !tweak.builds.contains(build) {
        return State::Unavailable;
    }
    let states: Vec<bool> = tweak.ops.iter().filter_map(|op| op_applied(op, packages)).collect();
    match (states.iter().filter(|&&on| on).count(), states.len()) {
        (_, 0) => State::Applied,
        (on, all) if on == all => State::Applied,
        (0, _) => State::NotApplied,
        _ => State::Partial,
    }
}

pub fn tweaks(build: u32, packages: &[String], store: &Store) -> Vec<TweakStatus> {
    catalog::TWEAKS
        .iter()
        .map(|tweak| TweakStatus {
            id: tweak.id,
            title: tweak.title,
            summary: tweak.summary,
            category: tweak.category,
            risk: tweak.risk,
            debloat: tweak.debloat,
            confirm: tweak.confirm,
            state: tweak_state(tweak, build, packages),
            can_undo: store.tweaks.contains_key(tweak.id),
        })
        .collect()
}

pub fn apps(packages: &[String], store: &Store) -> Vec<AppStatus> {
    catalog::APPS
        .iter()
        .map(|app| AppStatus {
            id: app.id,
            title: app.title,
            group: app.group,
            recommended: app.recommended,
            packages: packages
                .iter()
                .filter(|package| app.name.matches(package) && catalog::removable(package).is_some_and(|found| found.id == app.id))
                .cloned()
                .collect(),
            removed_by_myle: store.removed_apps.contains(app.id),
            store_id: app.store_id,
        })
        .collect()
}

/// Whether a tweak changes anything the administrator helper must do.
pub fn needs_admin(tweak: &Tweak) -> bool {
    tweak.ops.iter().any(|op| !matches!(op, Op::Reg { hive: Hive::User, .. } | Op::Clock24))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_tweak_has_a_state_on_this_pc() {
        let info = system::windows_info();
        let packages = system::installed_packages();
        let store = Store::default();
        let all = tweaks(info.build, &packages, &store);
        assert_eq!(all.len(), catalog::TWEAKS.len());
        println!("{}", info.name);
        for tweak in &all {
            println!("{:<24} {:?}", tweak.id, tweak.state);
        }
        for app in apps(&packages, &store).iter().filter(|app| !app.packages.is_empty()) {
            println!("installed: {} {:?}", app.title, app.packages);
        }
        let classic = all.iter().find(|t| t.id == "classic-context-menu").unwrap();
        if !info.windows11 {
            assert_eq!(classic.state, State::Unavailable);
        }
        assert_eq!(apps(&packages, &store).len(), catalog::APPS.len());
    }

    #[test]
    fn what_runs_as_administrator() {
        assert!(needs_admin(catalog::find("telemetry").unwrap()));
        assert!(needs_admin(catalog::find("edge").unwrap()));
        assert!(!needs_admin(catalog::find("clock-24h").unwrap()));
        assert!(!needs_admin(catalog::find("taskbar-search").unwrap()));
        assert!(!needs_admin(catalog::find("classic-context-menu").unwrap()));
    }
}
