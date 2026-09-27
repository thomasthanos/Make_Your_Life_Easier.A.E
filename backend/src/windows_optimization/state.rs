use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use super::models::{
    ActiveJob, AutoLogonOperation, WindowsOptimizationAction, WindowsOptimizationOutcome,
    WindowsOptimizationStage,
};

struct CancellationInner {
    cancelled: AtomicBool,
    stop: Mutex<Option<PathBuf>>,
}

#[derive(Clone)]
pub struct Cancellation(Arc<CancellationInner>);

impl Cancellation {
    pub fn cancel(&self) {
        self.0.cancelled.store(true, Ordering::Release);
        if let Some(stop) = self
            .0
            .stop
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
        {
            let _ = std::fs::write(stop, b"");
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.0.cancelled.load(Ordering::Acquire)
    }

    pub fn register_stop_file(&self, path: PathBuf) {
        *self
            .0
            .stop
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(path.clone());
        if self.is_cancelled() {
            let _ = std::fs::write(path, b"");
        }
    }
}

#[derive(Clone)]
struct Running {
    public: ActiveJob,
    cancellation: Cancellation,
}

#[derive(Default)]
struct Inner {
    active: Option<Running>,
    active_auto_logon: Option<AutoLogonOperation>,
    firmware_restart_active: bool,
    last_outcome: Option<WindowsOptimizationOutcome>,
}

#[derive(Clone, Default)]
pub struct WindowsOptimizationState(Arc<Mutex<Inner>>);

pub struct FirmwareRestartGuard {
    state: WindowsOptimizationState,
}

impl Drop for FirmwareRestartGuard {
    fn drop(&mut self) {
        self.state.lock().firmware_restart_active = false;
    }
}

impl WindowsOptimizationState {
    pub fn begin(
        &self,
        job_id: String,
        action: WindowsOptimizationAction,
    ) -> Result<Cancellation, String> {
        let mut inner = self.lock();
        if inner.active.is_some()
            || inner.active_auto_logon.is_some()
            || inner.firmware_restart_active
        {
            return Err("A Windows optimization tool is already running.".into());
        }
        let cancellation = Cancellation(Arc::new(CancellationInner {
            cancelled: AtomicBool::new(false),
            stop: Mutex::new(None),
        }));
        // A failed new run must not make the frontend redisplay the outcome
        // of an older run when it refreshes state after the error.
        inner.last_outcome = None;
        inner.active = Some(Running {
            public: ActiveJob {
                job_id,
                action,
                stage: WindowsOptimizationStage::Preparing,
                progress: None,
                downloaded: None,
                total: None,
            },
            cancellation: cancellation.clone(),
        });
        Ok(cancellation)
    }

    pub fn active(&self) -> Option<ActiveJob> {
        self.lock().active.as_ref().map(|job| job.public.clone())
    }

    pub fn last_outcome(&self) -> Option<WindowsOptimizationOutcome> {
        self.lock().last_outcome.clone()
    }

    pub fn update(
        &self,
        job_id: &str,
        stage: WindowsOptimizationStage,
        progress: Option<f64>,
        downloaded: Option<u64>,
        total: Option<u64>,
    ) {
        if let Some(active) = self
            .lock()
            .active
            .as_mut()
            .filter(|job| job.public.job_id == job_id)
        {
            active.public.stage = stage;
            active.public.progress = progress.map(|value| value.clamp(0.0, 1.0));
            active.public.downloaded = downloaded;
            active.public.total = total;
        }
    }

    pub fn finish(&self, outcome: WindowsOptimizationOutcome) {
        let mut inner = self.lock();
        if inner
            .active
            .as_ref()
            .is_some_and(|job| job.public.job_id == outcome.job_id)
        {
            inner.active = None;
        }
        inner.last_outcome = Some(outcome);
    }

    pub fn fail(&self, job_id: &str) {
        let mut inner = self.lock();
        if inner
            .active
            .as_ref()
            .is_some_and(|job| job.public.job_id == job_id)
        {
            inner.active = None;
        }
    }

    pub fn cancel(&self, job_id: &str) {
        if let Some(job) = self
            .lock()
            .active
            .as_ref()
            .filter(|job| job.public.job_id == job_id)
        {
            job.cancellation.cancel();
        }
    }

    pub fn cancel_all(&self) {
        if let Some(job) = self.lock().active.as_ref() {
            job.cancellation.cancel();
        }
    }

    pub fn begin_auto_logon(&self, operation: AutoLogonOperation) -> Result<(), String> {
        let mut inner = self.lock();
        if inner.active.is_some()
            || inner.active_auto_logon.is_some()
            || inner.firmware_restart_active
        {
            return Err("Another Windows optimization action is already running.".into());
        }
        inner.active_auto_logon = Some(operation);
        Ok(())
    }

    pub fn active_auto_logon(&self) -> Option<AutoLogonOperation> {
        self.lock().active_auto_logon
    }

    pub fn finish_auto_logon(&self) {
        self.lock().active_auto_logon = None;
    }

    pub fn begin_firmware_restart(&self) -> Result<FirmwareRestartGuard, String> {
        let mut inner = self.lock();
        if inner.active.is_some()
            || inner.active_auto_logon.is_some()
            || inner.firmware_restart_active
        {
            return Err("Another Windows optimization action is already running.".into());
        }
        inner.firmware_restart_active = true;
        Ok(FirmwareRestartGuard {
            state: self.clone(),
        })
    }

    pub fn firmware_restart_active(&self) -> bool {
        self.lock().firmware_restart_active
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_job_runs_and_cancel_is_scoped() {
        let state = WindowsOptimizationState::default();
        let cancellation = state
            .begin("one".into(), WindowsOptimizationAction::LaunchCtt)
            .unwrap();
        assert!(
            state
                .begin("two".into(), WindowsOptimizationAction::LaunchSparkle)
                .is_err()
        );
        state.cancel("other");
        assert!(!cancellation.is_cancelled());
        state.cancel("one");
        assert!(cancellation.is_cancelled());
    }

    #[test]
    fn auto_logon_and_tool_jobs_block_each_other() {
        let state = WindowsOptimizationState::default();
        state.begin_auto_logon(AutoLogonOperation::Enable).unwrap();
        assert!(
            state
                .begin("tool".into(), WindowsOptimizationAction::LaunchCtt)
                .is_err()
        );
        state.finish_auto_logon();

        let _tool = state
            .begin("tool".into(), WindowsOptimizationAction::LaunchCtt)
            .unwrap();
        assert!(state.begin_auto_logon(AutoLogonOperation::Disable).is_err());
    }

    #[test]
    fn firmware_restart_blocks_every_windows_optimization_action_and_clears_on_drop() {
        let state = WindowsOptimizationState::default();
        let restart = state.begin_firmware_restart().unwrap();
        assert!(state.firmware_restart_active());
        assert!(
            state
                .begin("tool".into(), WindowsOptimizationAction::LaunchCtt)
                .is_err()
        );
        assert!(state.begin_auto_logon(AutoLogonOperation::Enable).is_err());
        assert!(state.begin_firmware_restart().is_err());

        drop(restart);
        assert!(!state.firmware_restart_active());
        assert!(state.begin_auto_logon(AutoLogonOperation::Disable).is_ok());
    }
}
