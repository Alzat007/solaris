# Original Gesture Website

The original SOLARIS gesture solar system is published separately at:

https://alzat007.github.io/solaris/classic/

This edition is built from the fixed source commit `2353680b32060c4aa6a0a814d18e10290d644b07`, not by changing a `?v=` query parameter. It has the original pointing/thumb confirmation, pinch rotation, V-hand zoom and solar-system effects, without the later text-command or geographic-exploration interfaces.

The existing website at `/solaris/` remains the separate current public preview. Uncommitted local map repairs are not part of this classic release.

## Reproducible Build

The Pages workflow checks out the repository history, builds the main website, then invokes `scripts/build-classic.mjs`. The classic script archives the fixed commit into an isolated temporary folder, installs its original lockfile, runs its own tests and TypeScript/Vite build, checks the `/solaris/classic/` entry/runtime resources, and merges only that output into `dist/classic/`. It does not read the current worktree's application files or credential configuration.

`release-info.json` records the original source SHA/tree, base path, public source link and each distributed file's SHA-256/byte count, excluding the manifest itself. Verify actual bytes against this record; a query string or a source SHA alone is not proof of the served artifact.

```sh
VITE_BASE_PATH=/solaris/ node scripts/build-classic.mjs
```

Local verification may use `--reuse-node-modules` only when installed direct dependencies match the original lockfile versions; CI always uses `npm ci` in the temporary source snapshot. No `VITE_*` variables are inherited except the explicit classic base path. No map API credentials or paid services are needed.

Camera access remains user-initiated and requires HTTPS or localhost. Publishing the website does not establish physical-hand recognition quality, Fire TV hardware compatibility, Appstore approval or a contest submission.
