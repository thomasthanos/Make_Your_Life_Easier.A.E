//! The administrator half of the cleaner: one UAC prompt runs a PowerShell
//! script over the folders that a normal user cannot even read.
//!
//! The script is built from the same fixed table as everything else, so no text
//! from the page ever reaches it.

use std::collections::HashMap;
use std::path::Path;

use serde::Deserialize;

use super::targets::{Category, Target};
use crate::apps::process::{ERROR_CANCELLED, run_elevated};
use crate::download::err;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    Measure,
    Clean,
}

#[derive(Debug, Default, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct Totals {
    #[serde(default)]
    pub bytes: u64,
    #[serde(default)]
    pub files: u64,
    #[serde(default)]
    pub skipped: u64,
}

/// Runs `action` over the admin-only folders of `categories` and returns the
/// totals per category id.
pub async fn run(
    categories: &[&'static Category],
    action: Action,
) -> Result<HashMap<String, Totals>, String> {
    let jobs: Vec<(&str, Vec<&'static Target>)> = categories
        .iter()
        .map(|c| {
            (
                c.id,
                c.targets().iter().filter(|t| t.admin).collect::<Vec<_>>(),
            )
        })
        .filter(|(_, targets)| !targets.is_empty())
        .collect();
    if jobs.is_empty() {
        return Ok(HashMap::new());
    }

    let out_file = std::env::temp_dir().join(format!("myle-cleaner-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&out_file);
    let script = build_script(&jobs, action, &out_file);

    let args: Vec<String> = [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
    ]
    .into_iter()
    .map(String::from)
    .chain([crate::apps::process::encode_command(&script)])
    .collect();
    let code = run_elevated("powershell.exe", &args, true).await?;
    if code == ERROR_CANCELLED {
        return Err("Administrator approval was declined.".into());
    }

    let text = std::fs::read_to_string(&out_file)
        .map_err(|_| "the administrator step returned nothing".to_string())?;
    let _ = std::fs::remove_file(&out_file);
    // Windows PowerShell writes a UTF-8 BOM, which serde_json will not skip.
    serde_json::from_str(text.trim_start_matches('\u{feff}').trim()).map_err(err)
}

/// PowerShell that measures or deletes, then writes one JSON object.
fn build_script(jobs: &[(&str, Vec<&'static Target>)], action: Action, out_file: &Path) -> String {
    let mut script = String::from("$result = @{}\n");
    for (id, targets) in jobs {
        script.push_str("$bytes = 0; $files = 0; $skipped = 0\n");
        for target in targets {
            let dir = target.path();
            script.push_str(&format!(
                "$items = @(Get-ChildItem -LiteralPath {} -Recurse -Force -File -ErrorAction SilentlyContinue)\n",
                ps_quote(&dir.to_string_lossy())
            ));
            match action {
                Action::Measure => script.push_str(
                    "foreach ($i in $items) { $bytes += $i.Length; $files += 1 }\n",
                ),
                Action::Clean => script.push_str(
                    "foreach ($i in $items) { $len = $i.Length; \
                     try { Remove-Item -LiteralPath $i.FullName -Force -ErrorAction Stop; $bytes += $len; $files += 1 } \
                     catch { $skipped += 1 } }\n",
                ),
            }
        }
        script.push_str(&format!(
            "$result[{}] = @{{ bytes = $bytes; files = $files; skipped = $skipped }}\n",
            ps_quote(id)
        ));
    }
    // WriteAllText with a BOM-less encoding: Set-Content -Encoding UTF8 adds one.
    script.push_str(&format!(
        "$json = $result | ConvertTo-Json -Compress -Depth 4\n\
         [System.IO.File]::WriteAllText({}, $json, (New-Object System.Text.UTF8Encoding($false)))\n",
        ps_quote(&out_file.to_string_lossy())
    ));
    script
}

fn ps_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cleaner::targets;

    #[test]
    fn the_script_only_ever_names_folders_from_the_table() {
        let categories: Vec<&'static Category> = targets::CATEGORIES.iter().collect();
        let jobs: Vec<(&str, Vec<&'static Target>)> = categories
            .iter()
            .map(|c| {
                (
                    c.id,
                    c.targets().iter().filter(|t| t.admin).collect::<Vec<_>>(),
                )
            })
            .filter(|(_, t)| !t.is_empty())
            .collect();
        let script = build_script(&jobs, Action::Clean, Path::new(r"C:\Temp\out.json"));

        // Every quoted path in the script belongs to the fixed table.
        let known: Vec<String> = targets::CATEGORIES
            .iter()
            .flat_map(|c| c.targets())
            .map(|t| t.path().to_string_lossy().to_ascii_lowercase())
            .collect();
        for line in script.lines().filter(|l| l.contains("Get-ChildItem")) {
            let quoted = line.split('\'').nth(1).unwrap().to_ascii_lowercase();
            assert!(
                known.contains(&quoted),
                "unexpected path in the script: {quoted}"
            );
        }
        assert!(script.contains("Remove-Item"));
        assert!(script.contains("ConvertTo-Json"));
        // Categories with no admin folders are left out entirely.
        assert!(!script.contains("recycle-bin"));
    }

    #[test]
    fn measuring_never_deletes() {
        let category = targets::find("prefetch").unwrap();
        let jobs = vec![(category.id, category.targets().iter().collect::<Vec<_>>())];
        let script = build_script(&jobs, Action::Measure, Path::new(r"C:\Temp\out.json"));
        assert!(!script.contains("Remove-Item"));
    }

    #[test]
    fn quotes_are_escaped() {
        assert_eq!(ps_quote(r"C:\it's\here"), r"'C:\it''s\here'");
    }
}
