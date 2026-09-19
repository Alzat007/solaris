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
