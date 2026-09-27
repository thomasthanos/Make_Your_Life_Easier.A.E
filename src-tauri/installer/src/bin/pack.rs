//! Build-time tool: `myle-pack <staged app folder> <version> <payload file>`.
//! The setup embeds the file it writes (see scripts/build-setup.ps1).

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [dir, version, out] = args.as_slice() else {
        eprintln!("usage: myle-pack <staged app folder> <version> <payload file>");
        std::process::exit(2);
    };
    let file = std::fs::File::create(out).unwrap_or_else(|e| {
        eprintln!("cannot create {out}: {e}");
        std::process::exit(1);
    });
    let writer = std::io::BufWriter::new(file);
    match myle_setup::payload::pack(std::path::Path::new(dir), version, writer) {
        Ok(header) => {
            let size = std::fs::metadata(out).map(|m| m.len()).unwrap_or(0);
            println!(
                "Packed {} files ({} bytes) into {out} ({size} bytes)",
                header.files.len(),
                header.total_size()
            );
        }
        Err(e) => {
            eprintln!("packing failed: {e}");
            std::process::exit(1);
        }
    }
}
