//! Regenerates `spec/ais-api/v1/openapi.yaml` from the live `utoipa` annotations in
//! `handlers.rs` (see `src/openapi.rs`). Run with `cargo run --bin gen-openapi` from
//! `integrity-oracle/backend/`. Wire into CI as a diff-check (regenerate, `git diff
//! --exit-code` the spec dir) so a handler change without a matching spec regeneration
//! fails the build instead of silently drifting.

use std::path::Path;

use backend::openapi::combined_openapi;

fn main() {
    let yaml = combined_openapi().to_yaml().expect("OpenApi -> YAML serialization should never fail");

    // Path is relative to `integrity-oracle/backend/` (this binary's crate root), three
    // levels up to the monorepo root, then into the versioned spec directory.
    let out_dir = Path::new("../../spec/ais-api/v1");
    std::fs::create_dir_all(out_dir).expect("failed to create spec/ais-api/v1");
    let out_path = out_dir.join("openapi.yaml");
    std::fs::write(&out_path, yaml).expect("failed to write openapi.yaml");

    println!("wrote {}", out_path.display());
}
