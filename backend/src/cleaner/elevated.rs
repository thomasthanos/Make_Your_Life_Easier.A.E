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

    // Unguessable, so nothing can be waiting at this path for the elevated
    // process to write through.
    let out_file = std::env::temp_dir().join(format!(
        "myle-cleaner-{}-{}.json",
        std::process::id(),
        uuid::Uuid::new_v4().simple()
    ));
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

/// Walks one folder without ever following a junction or symbolic link, and
/// measures or deletes the files it finds. Windows PowerShell 5.1 (the one
/// that ships with Windows) follows links under `Get-ChildItem -Recurse`, and
/// users can create junctions inside `C:\Windows\Temp`: an administrator
/// sweep that followed one would delete whatever it points at. So the walk is
/// done by hand, links are skipped, and each folder's chain up to the root is
/// re-checked right before it is read.
const WALKER: &str = r#"$reparse = [IO.FileAttributes]::ReparsePoint
function Test-Linked([IO.DirectoryInfo]$dir, [string]$root) {
  $cursor = $dir
  while ($null -ne $cursor) {
    $cursor.Refresh()
    if ($cursor.Attributes -band $reparse) { return $true }
    if ($cursor.FullName.TrimEnd('\') -ieq $root.TrimEnd('\')) { return $false }
    $cursor = $cursor.Parent
  }
  return $true
}
function Invoke-Target([string]$root, [bool]$clean) {
  $totals = @{ bytes = 0; files = 0; skipped = 0 }
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { return $totals }
  $stack = New-Object System.Collections.Generic.Stack[string]
  $stack.Push($root)
  while ($stack.Count -gt 0) {
    $dir = New-Object IO.DirectoryInfo($stack.Pop())
    if (Test-Linked $dir $root) { continue }
    foreach ($item in @(Get-ChildItem -LiteralPath $dir.FullName -Force -ErrorAction SilentlyContinue)) {
      if ($item.Attributes -band $reparse) { continue }
      if ($item.PSIsContainer) { $stack.Push($item.FullName); continue }
      $len = $item.Length
      if ($clean) {
        try { Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop; $totals.bytes += $len; $totals.files += 1 }
        catch { $totals.skipped += 1 }
      } else { $totals.bytes += $len; $totals.files += 1 }
    }
  }
  return $totals
}
"#;

/// PowerShell that measures or deletes, then writes one JSON object.
fn build_script(jobs: &[(&str, Vec<&'static Target>)], action: Action, out_file: &Path) -> String {
    let clean = match action {
        Action::Measure => "$false",
        Action::Clean => "$true",
    };
    let mut script = String::from(WALKER);
    script.push_str("$result = @{}\n");
    for (id, targets) in jobs {
        script.push_str("$bytes = 0; $files = 0; $skipped = 0\n");
        for target in targets {
            script.push_str(&format!(
                "$t = Invoke-Target {} {clean}; $bytes += $t.bytes; $files += $t.files; $skipped += $t.skipped\n",
                ps_quote(&target.path().to_string_lossy())
            ));
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
        let calls: Vec<&str> = script
            .lines()
            .filter(|l| l.starts_with("$t = Invoke-Target"))
            .collect();
        assert!(!calls.is_empty());
        for line in calls {
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
        // The walker defines the delete branch; measuring never takes it.
        assert!(script.contains("Invoke-Target 'C:\\Windows\\Prefetch' $false"));
        assert!(!script.contains("$true;"));
    }

    #[test]
    fn links_are_never_followed() {
        let category = targets::find("temp").unwrap();
        let admin: Vec<&'static Target> = category.targets().iter().filter(|t| t.admin).collect();
        let script = build_script(
            &[(category.id, admin)],
            Action::Clean,
            Path::new(r"C:\Temp\o.json"),
        );
        // Windows PowerShell 5.1 follows junctions under -Recurse.
        assert!(!script.contains("-Recurse"));
        assert!(script.contains("ReparsePoint"));
        assert!(script.contains("Test-Linked $dir $root"));
    }

    #[test]
    fn quotes_are_escaped() {
        assert_eq!(ps_quote(r"C:\it's\here"), r"'C:\it''s\here'");
    }
}
