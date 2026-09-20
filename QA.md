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

This section records the pre-V2 version. Its gesture mappings and interruption behavior have been superseded by Gesture System V2 below.

- Replaced the old single-fist/open-palm/V mappings with THREE for information, V for return, dual pinch for scale, joined hands for collapse, and rapid bilateral open-hand separation for Sun entry. Point-to-pinch selection and horizontal switching remain supported.
- Two-hand motion uses a recent distance window, bilateral movement, confidence checks and fresh baselines after occlusion. Pinched zoom cannot become a collapse; releasing one hand after a zoom cannot accidentally select a planet. Hand-count changes reset recognizer velocity and finger hysteresis.
- Added a Sun interior state, 3D volume star particles at three depth ranges, animated plasma filaments, a warm nebula and entry trails. Entering hides the external Sun/planets, returning restores them. Particle counts scale from 12,000 to 32,000 by quality.
- All 62 tests passed, including anatomical THREE and folded-finger pinch, new action mappings, two-hand motion/reacquisition safeguards, animation interruption and preserved zoom/selection. TypeScript and GitHub Pages production build passed; static export verified 4 entry assets and 7 runtime assets under `/solaris/`.
- Browser replay at 1280 × 720 exercised the actual recognizer, gesture routing, planet picking and rendered animations using synthetic 21-point landmarks: POINT → Earth → PINCH → PLANET_FOCUS → THREE → INFO → V → SOLAR_SYSTEM. Dual pinch enlarged to 1.75 and reduced to 0.81; releasing kept 0.81. Joined hands triggered COLLAPSE; rapid bilateral expansion entered SUN_INTERIOR; V returned. No console or shader errors were observed.
- Browser screenshots confirmed a visible central contraction and a surrounding gold/orange particle field with flowing filaments. Camera input was not opened for these checks; these are synthetic integration checks, not measurements of real-camera accuracy.
- At 390 × 844, the seven-step Chinese teaching panel fits inside the viewport and scrolls: panel x=19.5, width=351, clientHeight=692, scrollHeight=1196; document width remains 390.

## Gesture System V2 · 2026-09-20

This establishes the current interaction contract; the V2.1 section below records subsequent recognition and visual refinements. Earlier gesture mappings above are historical.

- `npm test`: all 86 tests pass. Coverage includes explicit pinch edges and hysteresis, one confirmation per pinch, cancelled holds, low-confidence and re-entry protection, identity/order/crossing handling, animation locks, UI confirmation in secondary scenes, blank-space drag ownership, midpoint-only two-hand zoom, focus-only directional swipes, Fist Back, deliberate collapse/rebirth, unified Sun picking, automatic information and mouse/touch fallback sequences.
- Desktop in-app-browser replay at 1280 × 720 exercised real recognizer/controller/rendering code with anatomical synthetic 21-point landmarks. POINT on Earth followed by PINCH entered PLANET_FOCUS, displayed information automatically and remained there while the same pinch stayed held. No repeated selection occurred.
- POINT on Sun followed by PINCH entered locked SUN_FOCUS, then SUN_INTERIOR. Fist returned to SOLAR_SYSTEM. The retained gold particle volume and plasma filaments were visible. A world-space hand marker could appear enlarged against the interior camera; it is now hidden during entry/interior, leaving the small screen-space cursor. A second interior screenshot verified the marker no longer obscures the scene.
- Dual pinch reached both configured zoom bounds, 1.75 and 0.35; releasing preserved the current size. Blank pinch-drag changed targetRotation from 0.00 to 2.22 radians without selecting a planet. Unit tests separately verify post-release inertia and damping.
- Slow bilateral open-palm contraction produced COLLAPSE with collapse=1 and sunInterior=0. Spreading palms from the core triggered rebirth and restored SOLAR_SYSTEM with collapse=0 and sunInterior=0.
- After mouse selection of Earth, a leftward open-palm replay selected Mars; a rightward replay selected Earth. The same routing tests reject overview swipes, slow/vertical travel, pointing motion and cooldown repeats.
- A held pinch disappearing and reappearing remained in SOLAR_SYSTEM after READY with needsRelease=true. Releasing restored eligibility. Pointing at the help HUD target and pinching opened the Chinese operation guide.
- Tutorial prompted Pinch after a body hover, Fist after first Sun entry, and disappeared following a successful Fist return. The normal page hid debug UI; `?debugGesture=true` exposed phase, distance, finger states, readiness, lock, cooldown, target and FPS. The synthetic replay showed 60 FPS on this desktop; this is not a device-wide performance guarantee.
- At a 390 × 844 viewport, the Chinese help panel measured x=19.5, y=40, width=351, height=694; clientHeight=692 and scrollHeight=863. Document scrollWidth=390. Long help content scrolls within the viewport. Temporary viewport settings were reset after verification.
- No console warnings/errors were captured in the final desktop replay. Camera permissions were not requested in this verification pass; synthetic integration and input-sequence tests do not establish real-hand accuracy or physical phone performance.
- Final TypeScript check and `VITE_BASE_PATH=/solaris/ npm run build` passed. Static export verification passed for 4 entry assets and 7 runtime assets using the `/solaris/` base path.

## Gesture System V2.1 · built-in webcam refinements · 2026-09-20

- `npm test`: 106 tests passed, 0 failed. Added coverage includes relaxed and side-turned fingers, depth jitter, compact opposed pinch versus fist, handedness-label instability, partial invalid-hand results, weak-pose versus valid-geometry routing, noisy bilateral contraction, paused confirmation, relative closure for wider framing, unilateral/jump rejection and rebirth from separated palms.
- Desktop browser replay uses the production recognizer, controller and renderer with synthetic landmarks. Natural two-palm contraction with jitter and a 150 ms weak-pose interval reached COLLAPSE, completed at collapse=1 and sunInterior=0, then bilateral expansion restored SOLAR_SYSTEM with collapse=0. The confirmation no longer requires the palms to touch. This does not verify physical-camera accuracy.
- Screenshots verified a bright persistent gold/white energy core, a visible ring and surrounding streams after collapse. The singularity instruction sits below the core, and the hand feedback correctly prompts outward separation for rebirth. The new bottom collapse button also triggered the actual animation; transitions remained locked while running.
- Final desktop replay verified POINT on Earth followed by PINCH entered PLANET_FOCUS with automatic information. FIST returned to SOLAR_SYSTEM. A held pinch did not select repeatedly.
- The preview test used a clearly labelled synthetic canvas stream, without requesting camera permission or recording. The existing video and current landmark frame rendered as a mirrored preview and bone overlay. Entering information automatically collapsed the preview; manual expansion worked during reading and placed it at the upper left on desktop.
- At 390 × 844, the expanded reading preview measured x=254.6, y=116, width=112, bottom=221.5. The information panel began at y=232; document scrollWidth remained 390. The temporary viewport override was reset.
- No console warnings or errors were captured in the final desktop replay. Built-in webcam accuracy under the user's lighting, occlusion and distance remains a hands-on validation item; synthetic tests cannot establish that result.
- Final TypeScript and GitHub Pages production build passed. Static export verification passed for 4 entry assets and 7 runtime assets using `/solaris/`. The replay harness and its synthetic-camera/slow-motion controls are development-only and are not included in the production entry.
- README and implementation documentation now describe V2.1, including all 98 current configuration parameters (64 controller/motion and 34 recognizer/identity parameters).

## Single-hand five-fingertip zoom · 2026-09-20

This supersedes the earlier two-hand pinch zoom entry; selection/drag, Fist Back and two-open-palm collapse/rebirth keep their existing mappings.

- `npm test`: 123 tests passed, 0 failed. Added recognition coverage distinguishes five fingertips gathering beyond the palm from an ordinary fist or two-finger pinch, checks aperture invariance under translation/scale/rotation, and follows a continuous natural open/close sequence through intermediate poses. Controller and clutch tests cover the 180 ms start, opening/closing scale, continuous 450 ms fully-open exit, confidence interruptions, lost hands, explicit release, and ownership against click/swipe/return.
- Desktop browser replay through the actual recognizer/controller/rendering pipeline: five fingertips gathering initiated zoom at 0.35×; opening reached 1.75× and a stationary full-open palm ended the zoom in SOLAR_SYSTEM. Closing again reached 0.35× with ONE_HAND_ZOOM feedback, a changing aperture ring and a visible scale label. Removing the hand returned to SOLAR_SYSTEM and preserved 0.35×.
- The same five-fingertip close sequence in Earth focus entered UNIVERSE_SCALE while retaining Earth's information. Removing the hand restored PLANET_FOCUS, selected=earth and the current scale. No console warnings or errors were captured during this replay.
- The Chinese operation guide now explains five-fingertip gathering, opening/closing and how to finish; the old two-hand pinch zoom instructions are removed. At 390 × 844 the guide measured x=19.5, y=40, width=351, height=694, with clientHeight=692 and scrollHeight=903. Document scrollWidth remained 390; temporary viewport override was reset.
- All browser hand input was synthetic anatomical landmark replay. Physical built-in-webcam precision under the user's lighting and hand pose has not been measured in this pass.
- Final TypeScript/production build and `/solaris/` static export verification passed (4 entry assets, 7 runtime assets). The documentation's 113 parameter entries (71 controller/motion + 42 recognizer/identity) were checked against the source keys and values.

## First five-fingertip zoom after planet selection · 2026-09-20

- Reproduced two input blockers: a five-fingertip grip during the camera transition set a release latch that an open hand during the same transition could not clear; and opening from a captured grip before 180 ms cancelled the candidate even while the five-finger geometry remained valid. Automatic information display was not the blocker.
- Disabled scene input now observes reliable release without advancing zoom confirmation. Tracked five-fingertip gestures can begin a fresh confirmation after the animation ends. A captured five-fingertip candidate may continue through reliable intermediate/open poses, so a natural close/open cycle no longer needs a static closed hold. Reacquisition release protection and held two-finger selection protection remain covered.
- Added six real recognizer/controller/interaction-state integration regressions in `tests/focus-zoom.test.ts`. All 129 tests pass, including release during transition, fresh confirmation after transition, fast opening, two-finger repeat rejection, fist interruption and reacquisition protection.
- Desktop browser replay started Earth selection, presented a five-fingertip grip and release during the camera animation, then closed for 50 ms and progressively opened over 250 ms after unlock. This first cycle reached 1.75×, returned to PLANET_FOCUS and retained Earth's automatic information. A screenshot confirmed the Earth visibly enlarged. A subsequent close cycle reached 0.35×; a second screenshot confirmed a visibly smaller Earth and the new “星球缩放 · 0.35×” feedback.
- No console warnings/errors were captured. Browser input was synthetic landmark replay, not a physical-camera accuracy measurement. TypeScript, production build and `/solaris/` static export verification passed (4 entry assets and 7 runtime assets).
