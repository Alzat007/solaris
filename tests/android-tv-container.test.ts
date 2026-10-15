import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const file = (path: string) =>
  readFileSync(
    new URL(`../platforms/android-tv/${path}`, import.meta.url),
    "utf8",
  );
const activity = file("app/src/main/java/cn/solaris/tv/MainActivity.java");
const manifest = file("app/src/main/AndroidManifest.xml");
const debugManifest = file("app/src/debug/AndroidManifest.xml");
const gradle = file("app/build.gradle");
const app = readFileSync(
  new URL("../src/app/App.tsx", import.meta.url),
  "utf8",
);

test("shared TV Back returns the original root exit result after priority handlers", () => {
  assert.match(
    app,
    /if \(handleInputBack\(\)\) return true;\s*return interaction\.return\(\);/,
  );
});

test("TV shell remains local HTTPS with explicit TLS relay paths and no file/camera permission relaxation", () => {
  assert.match(activity, /WebViewAssetLoader/);
  for (const setting of [
    "setAllowFileAccess",
    "setAllowContentAccess",
    "setAllowFileAccessFromFileURLs",
    "setAllowUniversalAccessFromFileURLs",
  ])
    assert.ok(activity.includes(`${setting}(false)`));
  assert.match(activity, /MIXED_CONTENT_NEVER_ALLOW/);
  assert.match(activity, /request\.deny\(\)/);
  assert.match(activity, /sslHandler\.cancel\(\)/);
  assert.doesNotMatch(activity, /sslHandler\.proceed\(|\.grant\(/);
  assert.match(activity, /BuildConfig\.TV_RELAY_ORIGIN\.isEmpty\(\)/);
  assert.match(activity, /"\/v1\/sessions"\.equals\(uri\.getEncodedPath\(\)\)/);
  assert.match(activity, /"\/v1\/ws"\.equals\(uri\.getEncodedPath\(\)\)/);
  assert.match(activity, /getUserInfo\(\).*getQuery\(\).*getFragment\(\)/s);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.doesNotMatch(manifest, /android\.permission\.(CAMERA|RECORD_AUDIO)/);
  assert.match(manifest, /usesCleartextTraffic="false"/);
});

test("native confirmation is consumed once and informs the shared input owner before dispatching Enter", () => {
  assert.match(activity, /public boolean dispatchKeyEvent/);
  assert.match(activity, /KEYCODE_DPAD_CENTER/);
  assert.match(
    activity,
    /ACTION_DOWN && !confirmHeld && event\.getRepeatCount\(\) == 0/,
  );
  assert.match(activity, /ACTION_UP && confirmHeld/);
  assert.ok(
    activity.indexOf("solaris-native-input") <
      activity.indexOf("new KeyboardEvent"),
  );
  assert.doesNotMatch(activity, /performClick\(|\.click\(/);
  assert.match(
    activity,
    /new CustomEvent\('solaris-back', \{cancelable:true\}\)/,
  );
  assert.match(activity, /handler\.postDelayed\(backTimeout, 1500\)/);
});

test("TV lifecycle signals stop/resume and renderer loss exposes explicit native recovery", () => {
  assert.match(activity, /platformEvent\("solaris-platform-pause"\)/);
  assert.match(activity, /platformEvent\("solaris-platform-resume"\)/);
  assert.match(
    activity,
    /restart\.setOnClickListener\(button -> recreate\(\)\)/,
  );
  assert.match(activity, /restart\.requestFocus\(\)/);
  assert.match(activity, /removeView\(view\);\s*view\.destroy\(\)/);
  assert.match(activity, /if \(webView == null\) \{\s*finish\(\)/);
  assert.doesNotMatch(activity, /\.reload\(/);
});

test("Gradle verifies a root production build before copying and configures only the generated APK copy", () => {
  assert.match(gradle, /verify-tv-assets\.mjs/);
  assert.match(gradle, /'--dist', webDist\.absolutePath/);
  assert.match(gradle, /doLast \{/);
  assert.match(gradle, /'--configure-index'/);
  assert.match(gradle, /exclude 'classic\/\*\*'/);
  assert.match(gradle, /TV_CONTROLLER_URL/);
  assert.match(gradle, /groovy\.json\.JsonOutput\.toJson\(relayOrigin\)/);
  assert.match(manifest, /android:banner="@drawable\/solaris_banner"/);
  assert.ok(
    file("app/src/main/res/drawable/solaris_icon.xml").includes("#EAA969"),
  );
});

test("local test CA is debug-only, exact-host scoped, and absent from production TLS policy", () => {
  assert.match(gradle, /onVariants\(selector\(\)\.withBuildType\('debug'\)\)/);
  assert.match(gradle, /variant\.sources\.res\.addGeneratedSourceDirectory\(generateDebugNetworkSecurity, \{ task -> task\.outputDirectory \}\)/);
  assert.doesNotMatch(gradle, /sourceSets\.(?:main|release)\.res\.srcDir\((?:debugSecurityResources|generateDebugNetworkSecurity)\)/);
  assert.doesNotMatch(gradle, /sourceSets\.debug\.res\.srcDir\((?:debugSecurityResources|generateDebugNetworkSecurity)\)/);
  assert.match(gradle, /testLanHost \? normalizeTestLanHost\(testLanHost\) : 'localhost'/);
  assert.match(gradle, /relayOrigin != "https:\/\/\$\{testRelayHost\}:5444"/);
  assert.match(gradle, /<domain includeSubdomains="false">\$\{testRelayHost\}<\/domain>/);
  assert.match(gradle, /<base-config cleartextTrafficPermitted="false">/);
  assert.match(gradle, /<certificates src="system" \/>/);
  assert.doesNotMatch(gradle, /<debug-overrides|<certificates src="user"|includeSubdomains="true"/);
  assert.match(debugManifest, /networkSecurityConfig="@xml\/solaris_debug_network_security"/);
  assert.match(debugManifest, /usesCleartextTraffic="false"/);
  assert.doesNotMatch(manifest, /networkSecurityConfig|solaris_test_ca/);
  assert.match(gradle, /tasks\.register\('generateDebugNetworkSecurity', GenerateSolarisDebugSecurity\)/);
  assert.match(gradle, /@org\.gradle\.api\.tasks\.OutputDirectory\s*abstract org\.gradle\.api\.file\.DirectoryProperty getOutputDirectory\(\)/);
  assert.match(gradle, /outputDirectory\.set\(debugSecurityResources\)/);
  assert.doesNotMatch(gradle, /(?:generate|merge|process|map|extract)(?:Debug|Release)(?:Resources|SourceSetPaths|DeepLinks)/);
  assert.match(activity, /sslHandler\.cancel\(\)/);
  assert.doesNotMatch(activity, /sslHandler\.proceed\(/);
});

test("LAN test CA requires an explicit canonical private IPv4 host and exact relay origin", () => {
  assert.match(gradle, /findProperty\('TV_TEST_LAN_HOST'\)/);
  assert.match(gradle, /System\.getenv\('TV_TEST_LAN_HOST'\)/);
  assert.match(gradle, /inputs\.property\('tvTestLanHost', testLanHost\)/);
  assert.ok(gradle.includes("host.matches('(0|[1-9][0-9]{0,2})(\\\\.(0|[1-9][0-9]{0,2})){3}')"));
  assert.match(gradle, /octets\.any \{ it > 255 \}/);
  assert.match(gradle, /octets\[0\] == 10/);
  assert.match(gradle, /octets\[0\] == 172 && octets\[1\] >= 16 && octets\[1\] <= 31/);
  assert.match(gradle, /octets\[0\] == 192 && octets\[1\] == 168/);
  assert.match(gradle, /relayOrigin != "https:\/\/\$\{testRelayHost\}:5444"/);
  assert.doesNotMatch(gradle, /includeSubdomains="true"|<debug-overrides|sslHandler\.proceed/);
});

test("debug CA validation rejects repository files, private keys, non-CA or invalid certificates", () => {
  assert.match(gradle, /TV_TEST_CA_FILE/);
  assert.match(gradle, /caFile\.toPath\(\)\.startsWith\(repositoryPath\)/);
  assert.match(gradle, /caFile\.length\(\) > 65536/);
  assert.match(gradle, /caFile\.withReader\('US-ASCII'\)/);
  assert.match(gradle, /trimmedLine != '-----BEGIN CERTIFICATE-----'/);
  assert.match(gradle, /trimmedLine\.startsWith\('-----BEGIN'\)/);
  assert.doesNotMatch(gradle, /inputs\.file\(file\(testCaPath\)\)|caFile\.getText\(/);
  assert.match(gradle, /pem\.matches\(/);
  assert.match(gradle, /pem\.contains\('PRIVATE KEY'\)/);
  assert.match(gradle, /certificate\.checkValidity\(\)/);
  assert.match(gradle, /certificate\.getBasicConstraints\(\) < 0/);
  assert.match(gradle, /Arrays\.equals\(certificateBytes, certificate\.getEncoded\(\)\)/);
  assert.match(gradle, /outputs\.upToDateWhen \{ !testCaPath \}/);
  assert.match(gradle, /encodeToString\(certificate\.getEncoded\(\)\)/);
  assert.match(gradle, /delete\(resourceRoot\)/);
  assert.doesNotMatch(gradle, /(?:\.jks|\.p12|PRIVATE_KEY_FILE|KeyStore\.getInstance)/);
});
