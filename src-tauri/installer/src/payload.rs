//! The app as the setup carries it: one solid XZ stream holding a small JSON
//! header (version and file list) followed by every file's bytes in order.
//! Solid compression is what NSIS used too; it keeps the download small.
//!
//! ```text
//! xz( "MYLEPAY1" | u32 LE header length | header JSON | file bytes... )
//! ```

use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

const MAGIC: &[u8; 8] = b"MYLEPAY1";
/// A header bigger than this is not ours.
const MAX_HEADER: u32 = 1024 * 1024;
/// XZ preset for packing: the smallest download; unpacking stays fast.
const PRESET: u32 = 9;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Header {
    pub version: String,
    pub files: Vec<Entry>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Entry {
    /// Relative to the install folder, `/`-separated.
    pub path: String,
    pub size: u64,
}

impl Header {
    pub fn total_size(&self) -> u64 {
        self.files.iter().map(|file| file.size).sum()
    }
}

/// A path from the header, made safe to join onto the install folder: no
/// drive, no root, no `..`, nothing empty.
pub fn relative_path(path: &str) -> io::Result<PathBuf> {
    let candidate = Path::new(path);
    let clean = !path.is_empty()
        && !path.contains(':')
        && candidate
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    if clean {
        Ok(candidate.iter().collect())
    } else {
        Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("unsafe path in the setup payload: {path:?}"),
        ))
    }
}

/// Opens a payload: its header, and a reader positioned at the first file.
pub fn open(bytes: &[u8]) -> io::Result<(Header, impl Read + '_)> {
    let mut reader = lzma_rust2::XzReader::new(bytes, false);
    let mut magic = [0u8; 8];
    reader.read_exact(&mut magic)?;
    if &magic != MAGIC {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "the setup payload is damaged",
        ));
    }
    let mut length = [0u8; 4];
    reader.read_exact(&mut length)?;
    let length = u32::from_le_bytes(length);
    if length > MAX_HEADER {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "the setup payload is damaged",
        ));
    }
    let mut json = vec![0u8; length as usize];
    reader.read_exact(&mut json)?;
    let header: Header = serde_json::from_slice(&json).map_err(io::Error::other)?;
    for file in &header.files {
        relative_path(&file.path)?;
    }
    Ok((header, reader))
}

/// Packs every file under `dir` (build time only).
pub fn pack(dir: &Path, version: &str, out: impl Write) -> io::Result<Header> {
    let mut paths = Vec::new();
    collect(dir, dir, &mut paths)?;
    paths.sort();
    let files = paths
        .iter()
        .map(|relative| {
            Ok(Entry {
                path: relative.replace('\\', "/"),
                size: std::fs::metadata(dir.join(relative))?.len(),
            })
        })
        .collect::<io::Result<Vec<_>>>()?;
    let header = Header {
        version: version.to_string(),
        files,
    };
    let json = serde_json::to_vec(&header).map_err(io::Error::other)?;

    let options = lzma_rust2::XzOptions::with_preset(PRESET);
    let mut writer = lzma_rust2::XzWriter::new(out, options)?;
    writer.write_all(MAGIC)?;
    writer.write_all(
        &u32::try_from(json.len())
            .map_err(io::Error::other)?
            .to_le_bytes(),
    )?;
    writer.write_all(&json)?;
    for entry in &header.files {
        let mut file = std::fs::File::open(dir.join(&entry.path))?;
        let copied = io::copy(&mut file, &mut writer)?;
        if copied != entry.size {
            return Err(io::Error::other(format!(
                "{} changed while packing",
                entry.path
            )));
        }
    }
    writer.finish()?;
    Ok(header)
}

fn collect(root: &Path, dir: &Path, out: &mut Vec<String>) -> io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            collect(root, &path, out)?;
        } else {
            let relative = path.strip_prefix(root).map_err(io::Error::other)?;
            out.push(relative.to_string_lossy().into_owned());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_packed_folder_opens_with_the_same_files_and_bytes() {
        let root = std::env::temp_dir().join(format!("myle-payload-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("ludusavi")).unwrap();
        std::fs::write(root.join("App.exe"), vec![7u8; 70_000]).unwrap();
        std::fs::write(root.join("ludusavi").join("manifest.yaml"), b"games: {}").unwrap();

        let mut packed = Vec::new();
        let header = pack(&root, "7.1.0", &mut packed).unwrap();
        assert_eq!(header.files.len(), 2);
        assert!(packed.len() < 70_000, "solid XZ compresses");

        let (opened, mut reader) = open(&packed).unwrap();
        assert_eq!(opened, header);
        assert_eq!(opened.version, "7.1.0");
        assert_eq!(opened.total_size(), 70_000 + 9);
        let mut rest = Vec::new();
        reader.read_to_end(&mut rest).unwrap();
        let app = opened
            .files
            .iter()
            .position(|f| f.path == "App.exe")
            .unwrap();
        let (first, second) = rest.split_at(opened.files[0].size as usize);
        let app_bytes = if app == 0 { first } else { second };
        assert_eq!(app_bytes, vec![7u8; 70_000].as_slice());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn paths_that_leave_the_install_folder_are_refused() {
        assert!(relative_path("ludusavi/ludusavi.exe").is_ok());
        for bad in [
            "",
            "../evil.exe",
            "a/../../b",
            "C:/Windows/x",
            "/abs",
            "C:evil",
        ] {
            assert!(relative_path(bad).is_err(), "{bad:?} must be refused");
        }
    }

    #[test]
    fn anything_else_is_not_a_payload() {
        assert!(open(b"").is_err());
        assert!(open(b"not an xz stream at all").is_err());
    }
}
