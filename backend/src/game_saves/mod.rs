mod atomic;
mod cloud;
pub(crate) mod commands;
mod detection;
mod engine;
mod headless;
mod models;
mod parser;
mod scan_cache;
mod settings;
mod state;
mod undo;

pub use headless::run_headless_auto_backup;
pub(crate) use state::GameSavesReservation;
pub use state::GameSavesState;

pub(crate) fn reserve_operations(
    app: &tauri::AppHandle,
    state: &GameSavesState,
) -> Result<GameSavesReservation, String> {
    state.reserve_idle(&settings::config_root(app)?)
}
