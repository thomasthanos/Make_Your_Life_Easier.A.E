use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowsOptimizationAction {
    LaunchCtt,
    LaunchSparkle,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowsOptimizationStage {
    Preparing,
    WaitingForAdmin,
    ResolvingRelease,
    Downloading,
    Verifying,
    Extracting,
    Launching,
    Running,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(
    tag = "event",
    content = "data",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum WindowsOptimizationEvent {
    Stage {
        job_id: String,
        stage: WindowsOptimizationStage,
    },
    Progress {
        job_id: String,
        fraction: f64,
        downloaded: Option<u64>,
        total: Option<u64>,
    },
    Line {
        job_id: String,
        text: String,
        replace: bool,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowsOptimizationResult {
    Done,
    Cancelled,
    NeedsAdmin,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsOptimizationOutcome {
    pub result: WindowsOptimizationResult,
    pub job_id: String,
    pub action: WindowsOptimizationAction,
    pub note: Option<String>,
}

impl WindowsOptimizationOutcome {
    pub fn new(
        result: WindowsOptimizationResult,
        job_id: impl Into<String>,
        action: WindowsOptimizationAction,
        note: Option<String>,
    ) -> Self {
        Self {
            result,
            job_id: job_id.into(),
            action,
            note,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SparkleCacheState {
    pub cached: bool,
    pub version: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveJob {
    pub job_id: String,
    pub action: WindowsOptimizationAction,
    pub stage: WindowsOptimizationStage,
    pub progress: Option<f64>,
    pub downloaded: Option<u64>,
    pub total: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsOptimizationSnapshot {
    pub sparkle: SparkleCacheState,
    pub auto_logon: AutoLogonSnapshot,
    pub firmware_restart: FirmwareRestartSnapshot,
    pub active_job: Option<ActiveJob>,
    pub last_outcome: Option<WindowsOptimizationOutcome>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FirmwareType {
    Uefi,
    LegacyBios,
    Unknown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareRestartSnapshot {
    pub firmware_type: FirmwareType,
    pub available: bool,
    pub blocked_reason: Option<String>,
    pub active: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FirmwareRestartResult {
    Scheduled,
    Cancelled,
    NeedsAdmin,
    Unsupported,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareRestartOutcome {
    pub result: FirmwareRestartResult,
    pub note: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AutoLogonStatus {
    Enabled,
    Disabled,
    Conflict,
    Unavailable,
    Working,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AutoLogonAccountType {
    Local,
    Microsoft,
    Domain,
    Entra,
    Unknown,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AutoLogonOperation {
    Enable,
    Disable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoLogonSnapshot {
    pub status: AutoLogonStatus,
    pub display_name: String,
    pub account_name: String,
    pub account_type: AutoLogonAccountType,
    pub configured_user: Option<String>,
    pub blocked_reason: Option<String>,
    pub owned_by_app: bool,
    pub active_operation: Option<AutoLogonOperation>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AutoLogonSetResult {
    Enabled,
    Disabled,
    Cancelled,
    NeedsAdmin,
    Conflict,
    Unsupported,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoLogonOutcome {
    pub result: AutoLogonSetResult,
    pub note: Option<String>,
}
