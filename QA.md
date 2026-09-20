# Verification · 2026-09-19

- `npm install`: successful; MediaPipe WASM copied locally by postinstall.
- `npm run build`: TypeScript and Vite production compilation passed.
- `npm test`: 38 passing tests covering transitions, gesture holds, confidence interruptions, collapse release with two hands, Big Bang input lockout, anatomical landmark fixtures, natural finger flexion, direct/delayed pinch selection, target expiry, and pixel-based planet picking across viewport sizes.
- Chromium desktop 1512 × 982: intro, Earth focus and information, planet switching, Saturn, collapse/rebirth, sound toggle, help and camera failure fallback exercised. No JavaScript or Shader errors in the normal path.
- Chromium emulated mobile 390 × 844: page layout and planet tapping exercised; no horizontal page overflow or runtime errors.
- Camera startup with Chromium's synthetic video device: local model/WASM loaded, detection loop entered SHOW YOUR HAND, stop returned to mouse mode without errors. This verifies the integration and lifecycle, not real-hand accuracy.
- Early second Space during collapse: queued until compression finishes; universe returns to SOLAR_SYSTEM after rebirth.
- Space while a planet-navigation button is focused: collapse shortcut works.
- Explicit WebGL context loss: readable graphics-recovery screen appeared.
- One 120-frame desktop headless sample after reassembly measured about 60 requestAnimationFrame callbacks per second. This is a single-machine observation, not a device-wide performance guarantee.

Still requires hands-on validation: real camera gesture precision, two-hand compression across varied lighting/occlusion, and performance on physical iPhone Safari / Android Chrome devices. The camera is not automatically enabled for these checks.

Screenshots produced during verification are in the ignored `artifacts/` directory.

## Gesture response repair

- Reproduced before fixing: relaxed fingers classified as NONE for open palm, pointing and V sign; a marginal confidence frame restarted the gesture hold; direct pinch ignored a currently hovered planet; a slow point-to-pinch transition expired its cached target.
- Finger extension now also uses whole-finger reach relative to bone-chain length. Short marginal confidence dips can preserve the same candidate hold, while uncertain frames cannot trigger an action. Pinch selection re-arms after a new stable hold and never selects twice without release.
- Added live Chinese gesture/target feedback and a visible screen-space hand cursor. Picking follows the visible planetary disc with a pixel margin. Planet registration cleans up on unmount; disposed WebGL canvases no longer leave a false error after a development refresh.
- Browser fixture replay verified POINT → Earth target → PINCH → Earth focus, relaxed V_SIGN → INFO, relaxed OPEN_PALM → SOLAR_SYSTEM, and FIST → COLLAPSE → relaxed OPEN_PALM → rebirth → SOLAR_SYSTEM. These run actual recognizer, controller, picking and rendering code using synthetic landmarks, without opening a camera.
- 390 × 844 layout: feedback card within x=23–367, y=75–163; information card begins y=230; document scrollWidth=390. No overlap or horizontal page overflow in this state.

- Final normal-page reload: mouse Earth selection works. Fixture replay logged no JavaScript errors; final production build and all 38 tests passed.

## GitHub Pages migration

- The previous host returned a Cloudflare block page even with public access enabled; migrated the requested public website to GitHub Pages.
- `VITE_BASE_PATH=/solaris/ npm run build`: passed. All 38 tests still pass.
- `scripts/verify-static-export.mjs`: verified 4 entry assets, 7 runtime assets, valid WASM binaries, and subpath-aware runtime URLs. MediaPipe WASM, the hand model and Earth textures use Vite's deployment base.
- GitHub Actions installs from the lockfile, copies the pinned MediaPipe runtime, tests, builds and verifies the export before publishing.

## Gesture redesign and Sun interior · 2026-09-20

This section describes the current version; earlier gesture mappings above are historical.

- Replaced the old single-fist/open-palm/V mappings with THREE for information, V for return, dual pinch for scale, joined hands for collapse, and rapid bilateral open-hand separation for Sun entry. Point-to-pinch selection and horizontal switching remain supported.
- Two-hand motion uses a recent distance window, bilateral movement, confidence checks and fresh baselines after occlusion. Pinched zoom cannot become a collapse; releasing one hand after a zoom cannot accidentally select a planet. Hand-count changes reset recognizer velocity and finger hysteresis.
- Added a Sun interior state, 3D volume star particles at three depth ranges, animated plasma filaments, a warm nebula and entry trails. Entering hides the external Sun/planets, returning restores them. Particle counts scale from 12,000 to 32,000 by quality.
- All 62 tests passed, including anatomical THREE and folded-finger pinch, new action mappings, two-hand motion/reacquisition safeguards, animation interruption and preserved zoom/selection. TypeScript and GitHub Pages production build passed; static export verified 4 entry assets and 7 runtime assets under `/solaris/`.
- Browser replay at 1280 × 720 exercised the actual recognizer, gesture routing, planet picking and rendered animations using synthetic 21-point landmarks: POINT → Earth → PINCH → PLANET_FOCUS → THREE → INFO → V → SOLAR_SYSTEM. Dual pinch enlarged to 1.75 and reduced to 0.81; releasing kept 0.81. Joined hands triggered COLLAPSE; rapid bilateral expansion entered SUN_INTERIOR; V returned. No console or shader errors were observed.
- Browser screenshots confirmed a visible central contraction and a surrounding gold/orange particle field with flowing filaments. Camera input was not opened for these checks; these are synthetic integration checks, not measurements of real-camera accuracy.
- At 390 × 844, the seven-step Chinese teaching panel fits inside the viewport and scrolls: panel x=19.5, width=351, clientHeight=692, scrollHeight=1196; document width remains 390.
