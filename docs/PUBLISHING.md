# SOLARIS Publishing Guide

Status reviewed: 2026-10-15. This document prepares a public beta website and an
Android TV release candidate. It does not establish a completed deployment,
Amazon Appstore approval, or hackathon submission. The developer account and any
existing Appstore listing have not been verified in this review.

## Current product

SOLARIS is an interactive solar system with lightweight annotations on the
eight planets and the Moon. Earth includes local country outlines and selected
city and landmark entries. Visitors rotate and zoom a body, focus a label, and
open its bilingual illustrated panel. The shared gallery retains image credits
and sources, and closing the panel preserves the viewing position.

The default experience uses the existing Three.js scene. Earlier continuous
Cesium exploration and layered descent plans remain in the repository as
historical work. They are not the current product direction or evidence of
street-level imagery, terrain, or buildings. Do not advertise those capabilities
as delivered.

## What the evidence supports

| Surface | Existing evidence | Remaining limits |
| --- | --- | --- |
| Desktop website | Browser interaction, layout, content and asset checks documented in the acceptance reports | A local build does not establish that the public URL serves those bytes; rerun relevant checks for the chosen release |
| Android TV container | Installed API 34 ARM64 emulator APK, native remote keys, local WebView assets, gallery navigation and recovery tests | These are dated debug-build results, not validation of every new APK or Fire OS device |
| Phone controller | Local HTTPS/WSS tests; user reported iPhone 13 touch control and camera-driven Earth rotation | User also reported lag, jitter and jumps; latest fixes still need an actual phone camera and interaction retest |
| Physical Fire TV / Fire OS | No verified device results in the reviewed records | WebView/WebGL compatibility, input, performance and lifecycle behavior remain unverified |
| Public phone pairing | No production relay deployment verified | The controller page alone cannot provide phone-to-TV pairing |
| Amazon Appstore | Local Android source and build outputs exist | Account, listing, submission, review and live availability are unverified |

Public references: [TV build and verification guide](FIRE_TV_BUILD.md),
[mobile controller guide](MOBILE_CONTROLLER.md),
[relay guide](REMOTE_RELAY.md), and
[planet acceptance report](FIRST_BATCH_ATLAS_ACCEPTANCE_2026-10-06.md).
Detailed native and phone test records containing local environment information
are retained separately, outside this public documentation set. Later dated
records update earlier test status; they do not turn synthetic input or desktop
browser tests into phone-camera performance measurements.

The [official hackathon FAQ](https://amazonappdev2026.devpost.com/details/faqs),
checked on 2026-10-15, explicitly accepts Android TV Emulator or the Fire TV/Vega
simulator for the Fire TV track, without requiring physical hardware for
submission or judging. Describe this project's demonstration as an Android TV
emulator demonstration. That permission does not establish Fire OS hardware
compatibility or Amazon Appstore approval. Consult the
[official rules](https://amazonappdev2026.devpost.com/rules) for the rest of the
submission requirements.

## Website preparation

Use Node.js 22.12 or newer and the committed dependency lockfile. Run from the
repository root. These commands build the no-relay public beta under the existing
GitHub Pages path; the empty variables prevent local test service settings or an
ion token from entering this build.

```sh
npm ci
npm ci --prefix services/relay
npm --prefix services/relay run check
npm --prefix services/relay test
npm test
node --import tsx scripts/verify-exploration-content.ts --public-preview
node --import tsx scripts/import-earth-directory.mjs --check
node scripts/verify-content-pack.mjs
VITE_BASE_PATH=/solaris/ \
VITE_REMOTE_RELAY_ORIGIN= \
VITE_REMOTE_CONTROLLER_URL= \
VITE_CESIUM_ION_READ_TOKEN= npm run build
VITE_BASE_PATH=/solaris/ node scripts/verify-static-export.mjs
VITE_BASE_PATH=/solaris/ node scripts/verify-public-remote-config.mjs
VITE_BASE_PATH=/solaris/ node scripts/build-classic.mjs
VITE_BASE_PATH=/solaris/ npm run preview
```

The classic step produces the separate original gesture edition from its fixed
source revision. Preserve it when preparing the complete Pages artifact. Use
the preview URL printed by Vite and open its `/solaris/` path.

The existing `.github/workflows/pages.yml` runs checks, builds both editions and
deploys the artifact when `main` is pushed or the workflow is dispatched.
Completion evidence should include the successful deployment run and a check
that the public `build-info.json` and served scripts match the intended build.
A changed query string or a successful local build is not deployment evidence.

## Android TV candidate

Prerequisites are JDK 17, the configured Android SDK, platform 35, Build Tools
34.0.0, and the repository's Gradle wrapper. See
[Fire TV build instructions](FIRE_TV_BUILD.md) for setup and native input checks.
The SDK must already be installed with the required licenses accepted by its
owner. The APK needs a new root-path web build, not the `/solaris/` Pages build.

For a candidate without phone pairing, from the repository root:

```sh
VITE_BASE_PATH=/ \
VITE_REMOTE_RELAY_ORIGIN= \
VITE_REMOTE_CONTROLLER_URL= \
VITE_CESIUM_ION_READ_TOKEN= npm run build
node scripts/verify-tv-assets.mjs --dist dist
cd platforms/android-tv
TV_RELAY_ORIGIN= \
TV_CONTROLLER_URL= \
TV_TEST_CA_FILE= \
TV_TEST_LAN_HOST= ./gradlew :app:assembleRelease
```

Remove any corresponding local Gradle property overrides before this build;
explicit `-P` or Gradle properties take precedence over these environment
variables. Never carry a local test CA, temporary network address or expired
pairing fixture into a release candidate.

The current Gradle configuration has no release signing configuration, so this
command produces `app/build/outputs/apk/release/app-release-unsigned.apk`.
It is an intermediate file, not an installable signed release. Inspect the
actual packaged `assets/tv-build-info.json`, manifest and signature before
selecting a binary for distribution. An old output at that path must not be
mistaken for the new candidate: the output inspected on 2026-10-15 contained
localhost test relay/controller addresses and was unsigned.

The package currently declares `cn.solaris.tv`, version name `0.3.0`, version
code `1`, minimum SDK 23 and target SDK 35. Check any existing store listing
before choosing the next version code, package identity and signing key. Keep
the release key outside the repository, maintain an owner-controlled backup,
and never put passwords or private keys in commands recorded in documentation.
Use the existing release key when required by the distribution/update path;
if there is no existing key, establish its ownership before creating one.

Amazon documents its distribution signature handling in
[Understanding Amazon Appstore Submission](https://developer.amazon.com/docs/app-submission/understanding-submission.html#amazon-app-signatures).
Its [upload guide](https://developer.amazon.com/docs/app-submission/upload-app-file.html)
describes signed APK preparation. Amazon re-signing is not a reason to upload a
debug package or assume that an unsigned intermediate is accepted. Check the
actual signed candidate's signature and ZIP alignment with the Android SDK tools.

Record the candidate's SHA-256, configuration, installation result and observed
tests. Test native D-pad/confirm/Back, rotation and zoom, gallery navigation,
exit, background recovery and renderer recovery against that candidate. Keep
device/emulator identity attached to the results. Do not reuse an old debug
APK's report as proof that a signed release was tested.

## Phone control scope

There is no verified public relay. Public website or Appstore text must not
promise that a visitor can pair a phone with a TV today. A no-relay candidate
must also be checked for a misleading active pairing entry before submission.
Opening the controller HTML page does not establish an operational service.

A future enabled build needs a real HTTPS controller page, an HTTPS/WSS relay
with normal certificate validation, and an allowlist covering the controller
origin and `https://appassets.androidplatform.net`. GitHub Pages can serve the
controller page but cannot host the stateful Node WebSocket relay. Update the
TV APK, relay and controller together because older strict protocol validators
can reject newer fields.

Configuration variable names are `VITE_REMOTE_RELAY_ORIGIN` and
`VITE_REMOTE_CONTROLLER_URL` for the web build, and `TV_RELAY_ORIGIN` and
`TV_CONTROLLER_URL` for the Android package. They contain service addresses,
not account passwords. Follow [REMOTE_RELAY.md](REMOTE_RELAY.md) and
[MOBILE_CONTROLLER.md](MOBILE_CONTROLLER.md) when a production service exists.

The known phone lag remains a release limitation for this optional feature.
After the latest code is loaded on an actual phone, retest pointing, deliberate
confirmation, rotation, reversal, release/stop, zoom, Back, lost tracking,
backgrounding, disconnection and re-pairing. Record actual camera and end-to-end
observations separately from emulator rendering and synthetic WSS timings.

## Store preparation checklist

This is a work list, not a statement that submission requirements are complete.
Use the current [Amazon presubmission checklist](https://developer.amazon.com/docs/app-submission/presubmission-checklist.html)
and [Appstore details guide](https://developer.amazon.com/docs/app-submission/appstore-details.html)
when preparing the actual listing.

- Verify developer-account access and whether `cn.solaris.tv` already has a listing or live test; preserve its identity and update history.
- Select the signed candidate, intended Fire OS device availability and version; retain the build and test evidence above. The repository does not supply a Vega package.
- Prepare store icons and screenshots from the candidate, with clear platform labels. Existing emulator captures are not photographs or verification of physical Fire TV hardware.
- Supply the owner's real support contact and an accurate published privacy policy/disclosure for the final app and any enabled services. This guide is not a privacy policy and provides no substitute contact details.
- Complete the actual content rating, audience, availability, pricing and any other required console fields with owner-confirmed facts.
- Retain third-party image, font and data attribution; review the existing source/rights records and any documentation Amazon requests. Public beta status does not create missing rights.
- Retain current `humanReview: "pending"` labels until the required human review occurs. `--public-preview` validation is not editorial approval; do not change review flags to make a release check pass.
- Review the final listing and tester instructions against the shipped features, especially phone pairing. Record submission and review status from the console, then verify live availability separately.

## Draft English listing

The following copy is a draft for review against the final remote-controlled
candidate. It excludes public phone pairing and makes no physical-device test
or Appstore approval claim. Do not copy the preparation notes into customer
fields or remove the beta disclosure without completing the relevant review.

**Display title:** SOLARIS

**Short description:** Explore planets, the Moon, and illustrated places in an
interactive solar system.

**Description draft:**

Explore the eight planets and the Moon in SOLARIS. Rotate and zoom each body,
select its annotations, and open illustrated stories without leaving the
three-dimensional scene. Earth includes country outlines and selected cities
and landmarks. Switch between English and Chinese, browse image galleries,
and return to your previous view with the remote.

SOLARIS is a public beta. Images include source and credit information;
educational content is awaiting final human editorial review. Planet sizes,
distances and time are presented at artistic scales. The experience is not a
navigation tool or a street-level mapping service.

**Tester notes draft:** The candidate is designed for D-pad, confirm and Back
navigation and does not require an app account. Review the attached evidence
for the exact tested Android TV emulator and build. No public phone relay is
provided. Fire OS hardware compatibility and performance have not been verified
in the current project records. Replace these notes only with newly recorded
results for the actual submitted candidate.
