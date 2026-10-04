# Third-party notices

## MediaPipe Tasks Vision / Hand Landmarker

Software: https://github.com/google-ai-edge/mediapipe — Apache License 2.0.
Model: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
Documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
The model is distributed unchanged. Runtime files are copied from the pinned npm package during installation.

## Earth imagery

The two Earth map assets were obtained from the Three.js example texture collection (r160):
https://github.com/mrdoob/three.js/tree/r160/examples/textures/planets
The Three.js repository is MIT licensed. The imagery is used as supplied by that example collection; no additional attribution or ownership over the source imagery is claimed.

## Exploration content and directory (V3 batch)

The local exploration images retain their original attribution. The Olympus Mons image PIA00993 is credited to NASA/JPL/Malin Space Science Systems; Viking 1 image PIA00381 to NASA/JPL. Use is subject to the respective NASA/JPL image-use policies linked in `src/exploration/content.ts`, including restrictions on endorsement and third-party material. They are not re-licensed as SOLARIS source code.

`public/exploration/beijing-central-axis-2012.jpg`: photograph by **rheins**, 2012-05-08, Wikimedia Commons, **CC BY 3.0**. See the original file record and license links in `src/exploration/content.ts` and `docs/CONTENT_REVIEW_V3.md`. The 960-pixel derivative preserves aspect ratio; it illustrates the landmark, not the 2024 inscription event.

The Earth directory contains information from [REST Countries](https://github.com/restcountries/restcountries/tree/bfadee4f951682c29970e53677707bc558e80b74) and [mledoze/countries](https://github.com/mledoze/countries/blob/c2ac0049c14edcf2436c7aa1b2493222a020b462/LICENSE). The derived SOLARIS Earth Directory database is distributed under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Its complete machine-readable JSON, including provenance and license notices, is [available without registration at this fixed public-preview version](https://raw.githubusercontent.com/Alzat007/solaris/v3-public-preview-2026-10-04/data/earth-directory-source.json). The importer and changes are available in the same public repository.

The [REST Countries MPL-2.0 source notice](https://github.com/restcountries/restcountries/blob/bfadee4f951682c29970e53677707bc558e80b74/LICENSE) is retained separately. See `docs/EARTH_DIRECTORY_V3.md` for source versions and transformations. This database license does not assign a license to the SOLARIS application code or its separately credited images.

## Libraries

React, React DOM, Three.js, React Three Fiber, Drei, postprocessing, Vite, TypeScript, TSX and Prettier retain their respective upstream licenses, available in installed package directories. GSAP license: https://gsap.com/standard-license/ .

## Fonts

DM Sans and Manrope are loaded through Google Fonts and distributed under the SIL Open Font License. Browser system fonts are used if these requests fail.
