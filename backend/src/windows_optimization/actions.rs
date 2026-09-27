use std::path::PathBuf;

use tauri::AppHandle;

use crate::apps::process::ERROR_CANCELLED;
use crate::apps::{Cleanup, JobHandle};
use crate::download::{self, CANCELLED};

use super::cache;
use super::models::{
    WindowsOptimizationAction, WindowsOptimizationEvent, WindowsOptimizationOutcome,
    WindowsOptimizationResult, WindowsOptimizationStage,
};
use super::release;
use super::runner::{self, Reporter};
use super::state::Cancellation;

pub async fn launch_ctt(
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
) -> Result<WindowsOptimizationOutcome, String> {
    reporter.stage(WindowsOptimizationStage::Preparing);
    reporter.line(
        "The official christitus.com bootstrap will be downloaded and executed without a pre-run checksum.",
    );
    let code = runner::launch_ctt(cancellation, reporter).await?;
    classify_launch(
        code,
        cancellation,
        reporter,
        WindowsOptimizationAction::LaunchCtt,
        "Chris Titus Utility closed.",
    )
}

pub async fn launch_sparkle(
    app: &AppHandle,
    _job: &JobHandle,
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
    cleanup: &Cleanup,
) -> Result<WindowsOptimizationOutcome, String> {
    reporter.stage(WindowsOptimizationStage::Preparing);
    let cached = cache::detect(app)?;
    let executable = if let Some(executable) = cached.executable {
        reporter.line(format!(
            "Using verified portable Sparkle {} from the local cache.",
            cached.state.version.as_deref().unwrap_or("build")
        ));
        executable
    } else {
        install_sparkle(app, cancellation, reporter, cleanup).await?
    };

    if cancellation.is_cancelled() {
        return Err(CANCELLED.into());
    }
    reporter.stage(WindowsOptimizationStage::Launching);
    reporter.line("Launching the verified Sparkle portable app…");
    let code = runner::launch_program(&executable, cancellation, reporter).await?;
    classify_launch(
        code,
        cancellation,
        reporter,
        WindowsOptimizationAction::LaunchSparkle,
        "Sparkle closed.",
    )
}

async fn install_sparkle(
    app: &AppHandle,
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
    cleanup: &Cleanup,
) -> Result<PathBuf, String> {
    reporter.stage(WindowsOptimizationStage::ResolvingRelease);
    reporter.line("Resolving the latest stable portable Sparkle release from GitHub…");
    let release = release::resolve_sparkle().await?;
    reporter.line(format!(
        "Selected Sparkle {} ({}) with its published SHA-256.",
        release.version, release.asset_name
    ));
    if cancellation.is_cancelled() {
        return Err(CANCELLED.into());
    }

    let target = cache::root(app)?;
    let parent = target.parent().ok_or("Sparkle cache has no parent.")?;
    std::fs::create_dir_all(parent).map_err(download::err)?;
    let work = parent.join(format!(".sparkle-download-{}", reporter.job_id));
    let staged = parent.join(format!(".sparkle-stage-{}", reporter.job_id));
    cleanup.add(work.clone());
    cleanup.add(staged.clone());
    tokio::fs::create_dir_all(&work)
        .await
        .map_err(download::err)?;
    let archive = work.join(&release.asset_name);

    reporter.stage(WindowsOptimizationStage::Downloading);
    release::download_verified(&release, &archive, cancellation, |downloaded, total| {
        reporter.progress(downloaded, total);
    })
    .await?;
    reporter.stage(WindowsOptimizationStage::Verifying);
    reporter.line("The downloaded portable ZIP matches Sparkle's published SHA-256.");

    reporter.stage(WindowsOptimizationStage::Extracting);
    let archive_for_extract = archive.clone();
    let staged_for_extract = staged.clone();
    let cancellation_for_extract = cancellation.clone();
    let channel = reporter.channel.clone();
    let state = reporter.state.clone();
    let job_id = reporter.job_id.to_string();
    let executable = tauri::async_runtime::spawn_blocking(move || {
        release::extract_verified_zip(
            &archive_for_extract,
            &staged_for_extract,
            &cancellation_for_extract,
            |done, total| {
                let fraction = if total > 0 {
                    (done as f64 / total as f64).clamp(0.0, 1.0)
                } else {
                    0.0
                };
                state.update(
                    &job_id,
                    WindowsOptimizationStage::Extracting,
                    Some(fraction),
                    Some(done),
                    Some(total),
                );
                let _ = channel.send(WindowsOptimizationEvent::Progress {
                    job_id: job_id.clone(),
                    fraction,
                    downloaded: Some(done),
                    total: Some(total),
                });
            },
        )
    })
    .await
    .map_err(download::err)??;
    if cancellation.is_cancelled() {
        return Err(CANCELLED.into());
    }
    let relative = cache::write_metadata(&staged, &executable, &release.version, &release.digest)?;

    let swap = cache::DirectorySwap::apply(&staged, &target, reporter.job_id)?;
    let installed = target.join(relative);
    if !installed.is_file() {
        return Err("Sparkle.exe was lost while committing the portable cache.".into());
    }
    if let Some(backup) = swap.commit() {
        cleanup.add(backup);
    }
    reporter.fraction(1.0);
    reporter.line(format!(
        "Sparkle {} is verified and ready to launch.",
        release.version
    ));
    Ok(installed)
}

fn classify_launch(
    code: i32,
    cancellation: &Cancellation,
    reporter: &Reporter<'_>,
    action: WindowsOptimizationAction,
    success_note: &str,
) -> Result<WindowsOptimizationOutcome, String> {
    if cancellation.is_cancelled() {
        return Ok(WindowsOptimizationOutcome::new(
            WindowsOptimizationResult::Cancelled,
            reporter.job_id,
            action,
            Some(
                "The external tool was stopped; changes it already applied were not reverted."
                    .into(),
            ),
        ));
    }
    if code == ERROR_CANCELLED {
        return Ok(WindowsOptimizationOutcome::new(
            WindowsOptimizationResult::NeedsAdmin,
            reporter.job_id,
            action,
            Some("Administrator approval was declined.".into()),
        ));
    }
    if code != 0 {
        return Err(format!("The external tool exited with code {code}."));
    }
    Ok(WindowsOptimizationOutcome::new(
        WindowsOptimizationResult::Done,
        reporter.job_id,
        action,
        Some(success_note.into()),
    ))
}

#[cfg(test)]
mod tests {
    use super::super::state::WindowsOptimizationState;
    use super::*;

    #[test]
    fn uac_decline_is_not_reported_as_success() {
        let state = WindowsOptimizationState::default();
        let cancellation = state
            .begin("job".into(), WindowsOptimizationAction::LaunchCtt)
            .unwrap();
        let outcome = WindowsOptimizationOutcome::new(
            WindowsOptimizationResult::NeedsAdmin,
            "job",
            WindowsOptimizationAction::LaunchCtt,
            None,
        );
        assert_eq!(outcome.result, WindowsOptimizationResult::NeedsAdmin);
        assert!(!cancellation.is_cancelled());
        assert_eq!(ERROR_CANCELLED, 1223);
    }
}
