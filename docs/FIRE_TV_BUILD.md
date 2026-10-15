# Fire TV / Android TV local-asset build

This container packages the current shared SOLARIS web application. It does not
replace the solar system, change `/classic/`, or deploy a hosted website. The
APK starts at `https://appassets.androidplatform.net/index.html?tv=1&lang=en`;
WebViewAssetLoader serves the packaged files over this local HTTPS origin.

## Toolchain and approval boundary

- JDK 17, Android Gradle Plugin 8.7.3, Gradle 8.9.
- Android SDK platform 35 and Build Tools 34.0.0; minimum Android API 23.
- Node.js >=22.12.0 and the repository's locked npm dependencies.
- SDK licenses must be read and accepted by the account owner. Do not pipe `yes`
  into `sdkmanager --licenses` or treat a downloaded SDK as license acceptance.
- SDK/JDK/tool downloads, paid services, production relay deployment, release
  signing, and store submission are separate steps. A debug APK is not a store
  release.

The [AGP 8.7 compatibility table](https://developer.android.com/build/releases/agp-8-7-0-release-notes)
specifies Gradle 8.9, JDK 17, Build Tools 34.0.0, and maximum supported API 35.
The repository includes the genuine Gradle 8.9-generated wrapper, with the
official distribution SHA-256 pinned in `gradle-wrapper.properties`. It was
generated using an isolated empty Gradle project without downloading or
accepting an Android SDK license. To regenerate it with installed Gradle 8.9:

```sh
gradle wrapper --gradle-version 8.9 --distribution-type bin \
  --gradle-distribution-sha256-sum d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab
```

## Build local web assets first

From the repository root, with no Cesium ion token configured:

```sh
npm ci
VITE_BASE_PATH=/ npm run build
node scripts/verify-tv-assets.mjs --dist dist
```

The APK needs a root-path build, not the GitHub Pages `/solaris/` build. The
verifier checks production mode, root base path, each generated file's actual
SHA-256 and length, byte identity with `public/`, critical local textures,
Moon image audit records, and MediaPipe model/WASM files. It rejects client ion
credentials instead of copying them into an offline APK. A stale build with
the wrong base, a missing asset, or changed bytes stops `syncWebAssets`.

From `platforms/android-tv`, after SDK configuration and license acceptance:

```sh
./gradlew :app:assembleDebug
```

If `node` is not on Gradle's PATH, supply `-PSOLARIS_NODE=/absolute/path/to/node`.
The output is `app/build/outputs/apk/debug/app-debug.apk`. Install only on an
explicitly selected device or TV emulator:

```sh
adb -s DEVICE_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
adb -s DEVICE_SERIAL shell am start -n cn.solaris.tv/.MainActivity
```

`syncWebAssets` copies `dist` into a generated Android asset directory, excludes
`classic/`, and then modifies **only that copy**. It adds a restrictive CSP and
an external `solaris-tv-config.js` bootstrap. `build-info.json` describes the
original web build; `tv-build-info.json` records the original and packaged
index/bootstrap hashes so they are not incorrectly claimed to be identical.
The latter explicitly does not claim a verified native installation.

## Optional phone relay configuration

Default values are empty: the local solar system works without a relay. A
phone-camera controller requires an independently configured HTTPS controller
page and HTTPS/WSS relay. An unset phone URL is not a working QR-code endpoint.
No API credential or account password is an APK build property.

```sh
./gradlew :app:assembleDebug \
  -PTV_RELAY_ORIGIN=https://relay.example.invalid \
  -PTV_CONTROLLER_URL=https://controller.example.invalid/controller/
```

These are explicit example addresses, not deployed services. The same property
names can be supplied as environment variables. `TV_RELAY_ORIGIN` must be a
credential-free HTTPS origin with no path, query, or fragment. The controller
URL is an HTTPS page with no credential, query, or fragment. JavaScript receives
the immutable bootstrap shape:

```js
window.__SOLARIS_REMOTE_CONFIG = { relayUrl, phoneUrl };
```

The only external connections allowed by the APK's CSP are
`https://THE_CONFIGURED_AUTHORITY/v1/sessions` and
`wss://THE_CONFIGURED_AUTHORITY/v1/ws`. Native interception allows POST and CORS
preflight OPTIONS for the session path; `/health` and other external pages are
not enabled. The relay must allow the exact TV origin
`https://appassets.androidplatform.net` and the configured phone-page origin.
Short-lived pairing/authentication happens inside the protocol; do not put
tokens in WebSocket query strings. Self-signed or invalid TLS is rejected.

### Loopback-only debug certificate fixture

For the documented local emulator test only, `TV_TEST_CA_FILE` can point to a
public CA PEM **outside the repository**, and only with
`TV_RELAY_ORIGIN=https://localhost:5444`. The generated debug resource trusts
that CA for `localhost` only, never arbitrary hosts or subdomains. The AGP
generated-resource task validates its certificate, clears stale resources when
the property is omitted, and never runs for release variants. Private keys are
not accepted or packaged. No WebView SSL error is bypassed and no OS trust is
installed. This is not a production relay or a reachable physical-phone QR.

Detailed native APK + desktop controller results are retained in local test
records, outside the public documentation set. See [Publishing Guide](PUBLISHING.md)
for the public verification summary, and `scripts/prepare-tv-local-test.mjs` /
`scripts/start-tv-local-test.mjs` for reproducible loopback fixtures. A one-day
test certificate requires a fresh APK build when regenerated. Keep test APKs
separate from ordinary debug builds.

WebView disables file/content access, universal file-origin access, and mixed
content. Permission requests are denied; the TV APK has INTERNET permission
but not CAMERA or RECORD_AUDIO. Only the phone page asks for camera access.
WASM execution and local blob workers are explicitly permitted without opening
arbitrary HTTPS sources or general `unsafe-eval`. A CSP and request allowlist
are defense in depth, not a claim that WebView interception alone is a complete
network firewall. See the official
[local-content guide](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
and [WebViewClient interception limitations](https://developer.android.com/reference/android/webkit/WebViewClient).

## Native input and lifecycle

- DPAD_CENTER, ENTER, and NUMPAD_ENTER become one shared DOM Enter keydown/up
  pair; held repeats and WebView's duplicate native click are suppressed.
- These DOM events are synthetic, so native confirmation also dispatches
  `solaris-native-input` for the shared input-owner layer to preempt continuous
  phone input. It must not rely on `KeyboardEvent.isTrusted` for this route.
- Back uses the existing single `solaris-back` contract. If the web layer does
  not consume it, the Activity exits; a 1.5-second timeout also permits exit if
  the renderer is unresponsive.
- Pause/resume emits `solaris-platform-pause`/`solaris-platform-resume`. The web
  session owner must stop remote motion, clear pairing/session state, and return
  to offline UI on these events. Native timers are paused separately. Actual
  background execution and relay revocation still require device testing.
- Renderer loss shows a native Restart button and supports Back to exit.
  Restart is user initiated; there is no reload loop.

The icon/banner are demo brand assets. Final store artwork, release signing,
device certification, accessibility and long-session performance remain
separate acceptance work.

## Genuine TV emulator choices on Apple Silicon

Google's official repositories list ARM64 **TV** images suitable for Apple M2:

- `system-images;android-34;android-tv;arm64-v8a`, revision 3, archive
  `arm64-v8a-34_r03.zip`, 815,200,224 bytes.
- `system-images;android-34;google-tv;arm64-v8a`, revision 3, archive
  `arm64-v8a-34_r03.zip`, 869,585,766 bytes.

Metadata checked on 2026-10-08:
[Android TV repository](https://dl.google.com/android/repository/sys-img/android-tv/sys-img2-3.xml),
[Google TV repository](https://dl.google.com/android/repository/sys-img/google-tv/sys-img2-3.xml).
Google also documents [Apple Silicon Google TV emulator support](https://android-developers.googleblog.com/2025/08/64-bit-app-compatibility-for-google-tv-android-tv.html).
Installing a phone AVD does not constitute TV verification. Installing an
Android TV/Google TV AVD does not constitute Fire OS device verification.

The minimum API excludes Fire OS 5 / API 22. Newer Fire OS versions still need
an actual WebView/WebGL2 capability check. Vega OS devices are not Android APK
targets. Check the intended hardware against Amazon's
[Fire OS overview](https://developer.amazon.com/docs/fire-tv/fire-os-overview.html).

## Verification boundaries

Run focused contract/asset tests from the repository root:

```sh
npx tsx --test tests/android-tv-assets.test.ts tests/android-tv-container.test.ts
```

Those tests validate packaging guards, configuration restrictions, and native
source contracts. They are not an APK installation, native input dispatch,
camera permission, remote pairing, or WebGL performance test. Record these
separately after an authorized SDK/toolchain build and TV-device/emulator run:
actual APK path/hash, target serial/API, renderer and WebView version, offline
launch, English UI, Earth/Mars/Saturn/Moon panels, Enter/Back, background/resume,
renderer recovery, pairing expiry/disconnection, and real phone camera gestures.

Do not claim the APK or TV/camera flow works merely because desktop browser
tests, this source audit, or a packaged HTML hash passed.
