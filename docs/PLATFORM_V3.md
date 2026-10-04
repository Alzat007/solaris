# SOLARIS V3 TV Platform Status

Updated: 2026-10-04, Asia/Shanghai.

## What Exists

- Web TV mode is explicitly selected with `?tv=1`; this is not a TV emulator.
- `src/platform/tvNavigation.ts` provides spatial D-pad focus navigation, Enter activation (including native `details/summary` toggles), and layered Back delegation. Only visible, enabled, non-negative-tabindex controls are candidates. An active modal restricts focus to its own controls.
- Text input Left/Right, text areas, IME composition and modifier-key combinations are left to the browser. A focused select uses Enter to enter / leave TV editing; editing Up/Down changes the next enabled, visible option and dispatches native input/change events. Closed selects use D-pad focus movement. Back ends select editing before returning a scene, and Left/Right can move away without trapping focus. Repeated Enter/Back cannot activate or return repeatedly; held direction keys may move focus or change an edited select.
- Descendants of closed `details` are excluded from focus even when their browser layout rectangles are nonzero; only the visible summary is reachable until it opens.
- `solaris-back` is a cancelable window event. The callback's `false` means the app is at the root and a native container can exit. `true` or `void` means the app handled Back and the event is canceled. The native container is the only consumer of Android Back; it does not also synthesize a keyboard Back event.
- `platforms/android-tv/` is a Java Android TV / Fire OS candidate container, not a Vega binary. It loads the actual Web production build through `WebViewAssetLoader` on a local HTTPS origin, not relaxed `file://` permissions.

## Why These Steps Matter

1. 先做遥控焦点与分层返回，让没有摄像头的电视也能完成真实主流程；桌面方向键测试只证明网页输入，不证明 Fire TV 兼容。
2. 将已有构建打进原生容器，检查真实 WebView 的 WebGL2、着色器、字体和资源路径。不能用单个网页截图代替 App 安装运行证据。
3. 使用本地 HTTPS 资源映射，避免为加载纹理而放开文件跨域。此容器没有网络、相机或麦克风权限，未打包内容不能自动宣称离线可用。
4. 在具体目标环境验证后才决定发布路线。模拟器帧率不代表真机帧率；这个源码不保证所有 Fire TV 设备兼容或稳定 30 FPS。

## Actual Environment Check

Read-only checks on this machine returned:

| Check | Actual result |
| --- | --- |
| Host | macOS 14.4.1, `arm64` |
| `/Applications/Android Studio.app` | Not found at this path |
| `~/Library/Android/sdk` | Not found at this path |
| `~/.android/avd` | Not found at this path |
| `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME` | Not set |
| `which adb emulator sdkmanager gradle` | No matching executable on PATH |
| `/usr/libexec/java_home -V` | Unable to locate a Java Runtime |
| `gradle --version` in container directory | Exit 127: command not found |

These checks do not prove tools are absent from every possible custom path. No SDK, system JDK, Gradle, emulator image, hardware or paid service was installed or purchased.

## Verification, Not Claims

- Fifteen TV unit tests passed on the existing bundled Node runtime: five pure TV-query / spatial-focus tests and ten minimal DOM-event fixture tests (cleanup, repeated keys, summary focus / single activation, hidden details, text / select editing, unavailable options, disabled controls and native Back acknowledgment). The fixture is not a real browser or device.
- TypeScript checking (`tsc --noEmit`) passed at this module checkpoint.
- Local Chromium 151.0.7922.34 Web TV-mode QA passed at 1920 x 1080: D-pad + Enter selected Mars, opened its directory and entered Olympus Mons; the actual image loaded; summary Enter repeat did not double-toggle; cancelable Back canceled approach and returned story -> location -> directory -> planet -> system, then allowed root exit; Earth country filtering changed through an edited select and focus could leave it. No camera requests or page / console errors occurred.
- Reviewed screenshots showed visible focus, rendered 3D and local image resources, and readable text without overlap or clipping. Reproduction script and report are local ignored artifacts: `artifacts/tv-v3-playwright.mjs`, `artifacts/tv-v3-report.json` and `artifacts/tv-v3-*-1920.png`.
- The central Mars canvas region had 124,416 visible pixels; 71,855 pixels changed between frames 800 ms apart. This verifies a nonblank, moving local-browser scene, not TV hardware performance.
- Native APK compilation: **not run**, missing usable JDK / SDK / Gradle.
- Android TV / Fire OS installation, emulator screenshot, WebGL2 compatibility, native Back, pause/resume, offline startup and device performance: **not verified**.
- Vega support: **not implemented**. Do not try to install this Android APK as a Vega package.
- Browser keyboard events and JavaScript Back acknowledgment do not verify a physical remote, Android key delivery, a Fire TV WebView or native Activity exit. These remain target-platform checks, not browser QA claims.

## Container Build Prerequisites

The source pins Android Gradle Plugin 8.7.3, Gradle 8.9, JDK 17, Android compile / target SDK 35 and AndroidX WebKit 1.14.0. This conservative toolchain does not change existing Web dependencies. WebKit 1.14.0 is intentionally pinned, not described as the newest version.

Obtain user approval before downloading tools. Verify these conditions first:

1. Usable JDK 17 (`java -version`, `java_home` or explicit `JAVA_HOME`).
2. Android SDK platform 35, build tools 34.0.0, platform-tools, emulator, and a compatible ARM64 TV system image. Do not substitute a phone AVD and call it a TV test. Record the exact available image and graphics backend instead of assuming one exists.
3. Gradle 8.9 available for initial wrapper generation. The wrapper has not been generated or downloaded yet.

After approved tool setup, from the repository root:

```sh
VITE_BASE_PATH=/ npm run build
gradle -p platforms/android-tv wrapper --gradle-version 8.9
```

Then from `platforms/android-tv`:

```sh
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cn.solaris.tv/.MainActivity
```

`syncWebAssets` packages the existing `dist/` output and fails if `dist/index.html` is missing. It does not silently build the Web app, so rebuild after changes and check the packaged version. Keep `VITE_BASE_PATH=/` for the container build. Do not package the dev server or a remote GitHub Pages URL as the offline app.

This is a demo container, not an Amazon Appstore-ready release: release signing, artwork / TV banner, certification and actual supported Fire TV model selection remain uncompleted.

## Required Target Test

- Record emulator / device name, OS, system image ABI, WebView version, renderer and graphics backend.
- Check `canvas.getContext('webgl2')` and test a real existing Solaris shader / particle segment, not just a plain sphere. Three.js r180 cannot fall back to WebGL1.
- Complete Sun/system -> Earth -> Beijing -> story -> Back using D-pad without requesting camera permissions. Verify held-confirm and rapid Back do not duplicate transitions.
- Press Back at the app root and confirm native exit. Test return during a transition.
- Disable networking before cold start and verify every claimed offline asset exists; blocked external source links are intentionally unavailable in this container.
- Background/resume, renderer loss, repeated scene entry, resources and text clipping need real target tests. Native `onPause` pauses WebView timers; this has not been verified on a device and does not by itself certify every future audio subsystem's lifecycle handling.

## Primary References

- Contest [rules](https://amazonappdev2026.devpost.com/rules): Web technologies are allowed, but Fire OS / Vega OS functionality is required.
- Contest [FAQ](https://amazonappdev2026.devpost.com/details/faqs): Android TV Emulator or Fire TV / Vega simulator is accepted; hardware is not mandatory for judging.
- [Android local WebView content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content): use `WebViewAssetLoader`, do not enable universal file URL access.
- [Android TV app creation](https://developer.android.com/training/tv/get-started/create): TV launcher and hardware features.
- [Android Gradle Plugin 8.7 compatibility](https://developer.android.com/build/releases/agp-8-7-0-release-notes): Gradle 8.9, JDK 17, maximum API 35.
- [AndroidX WebKit releases](https://developer.android.com/jetpack/androidx/releases/webkit): pinned dependency version.
- [Android emulator acceleration](https://developer.android.com/studio/run/emulator-acceleration): Apple Silicon requires compatible ARM64 images and suitable graphics settings.
- [Vega WebGL support](https://developer.amazon.com/docs/vega/0.24/webview-webgl-best-practices): WebGL2 support is documented, not a test of this app.
- [Vega virtual device limitations](https://developer.amazon.com/docs/vega/0.24/run-apps-overview): Mac M-series WebView support does not turn simulator measurements into real-device performance.
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): WebGL2 requirement; no WebGL1 support since r163.
