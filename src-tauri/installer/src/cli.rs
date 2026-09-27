//! Command line, in the NSIS dialect the app's updater and scripts already
//! speak: `/S` silent, `/P` passive, `/UPDATE`, `/R` relaunch, `/NS` no
//! shortcuts, `/D=<folder>` (last, unquoted, may contain spaces), plus
//! `/PURGE` for the uninstaller to remove settings and data as well.

use std::path::PathBuf;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Cli {
    /// No window at all.
    pub silent: bool,
    /// Progress only: starts at once and closes when done.
    pub passive: bool,
    /// An update over an existing install: shortcuts are left as they are.
    pub update: bool,
    /// Start the app once installed.
    pub relaunch: bool,
    pub no_shortcuts: bool,
    /// Uninstall: also remove settings, caches and account data.
    pub purge: bool,
    pub dir: Option<PathBuf>,
}

pub fn parse(args: impl IntoIterator<Item = String>) -> Cli {
    let args: Vec<String> = args.into_iter().collect();
    let mut cli = Cli::default();
    for (index, arg) in args.iter().enumerate() {
        let upper = arg.to_ascii_uppercase();
        if let Some(dir) = upper.strip_prefix("/D=").map(|_| &arg[3..]) {
            // NSIS convention: everything after /D= is the path, spaces included.
            let mut path = dir.to_string();
            for rest in &args[index + 1..] {
                path.push(' ');
                path.push_str(rest);
            }
            let path = path.trim().trim_matches('"');
            if !path.is_empty() {
                cli.dir = Some(PathBuf::from(path));
            }
            break;
        }
        match upper.as_str() {
            "/S" | "--SILENT" => cli.silent = true,
            "/P" | "--PASSIVE" => cli.passive = true,
            "/UPDATE" => cli.update = true,
            "/R" => cli.relaunch = true,
            "/NS" => cli.no_shortcuts = true,
            "/PURGE" => cli.purge = true,
            _ => {}
        }
    }
    cli
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(text: &str) -> Vec<String> {
        text.split(' ').map(str::to_string).collect()
    }

    #[test]
    fn the_updater_command_line_is_understood() {
        let cli = parse(args("/S /UPDATE /R"));
        assert!(cli.silent && cli.update && cli.relaunch);
        assert!(!cli.passive && !cli.purge && cli.dir.is_none());
    }

    #[test]
    fn a_folder_after_d_keeps_its_spaces() {
        let cli = parse(args(r"/s /D=C:\My Apps\Make Your Life Easier"));
        assert!(cli.silent);
        assert_eq!(
            cli.dir,
            Some(PathBuf::from(r"C:\My Apps\Make Your Life Easier"))
        );
    }

    #[test]
    fn unknown_arguments_are_ignored() {
        assert_eq!(parse(args("--whatever /X")), Cli::default());
        assert!(parse(args("/PURGE")).purge);
    }
}
