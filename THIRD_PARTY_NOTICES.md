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

## Immersive sample images

`public/exploration/immersive-pack.json` records the byte counts and SHA-256 hashes of all five deduplicated images used by the Beijing, Olympus Mons and Viking 1 immersive samples. It is separate from the original V3 content pack. Bundling these files does not establish browser offline cold-start support. Source checking and rights attribution do not replace the participant's human review; all six sample hotspots remain pending that review.

- `beijing-tiananmen-2008.jpg`: **Rabs003**, photograph taken **2008-10-12**, [Tiananmen Gate file record](https://commons.wikimedia.org/wiki/File:Tiananmen_Gate.jpg), used under **[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)**. Wikimedia's 960-pixel-wide version is used without local cropping, recoloring or compositing. This landmark image does not depict the 2024 World Heritage inscription decision. The image retains CC BY-SA 3.0; the image license does not assign that license to the application.
- `beijing-badaling-2006.jpg`: **Robysan**, photograph taken **2006-08-05** (the file's recorded capture date), [Greatwall badaling file record](https://commons.wikimedia.org/wiki/File:Greatwall_badaling.jpg), used under the offered **[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)** option. The original published JPEG is used without local cropping, recoloring or compositing. It illustrates the Badaling landmark and conservation topic, not the 1987 inscription event or a particular restoration project. The image retains CC BY-SA 3.0.
- `beijing-birds-nest-2020.jpg`: **Balon Greyjoy**, photograph taken **2020-01-09**, [20200109 Beijing National Stadium-11 file record](https://commons.wikimedia.org/wiki/File:20200109_Beijing_National_Stadium-11.jpg), **[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)**. The Wikimedia 960-pixel-wide version is used; the original published file records Lightroom processing by its author, and no local cropping, recoloring or compositing was applied. The pictured work is the **National Stadium**, designed by **Herzog & de Meuron, Arup and China Architectural Design & Research Group**, with **Ai Weiwei** as artistic advisor, as recorded by the [architect's project page](https://www.herzogdemeuron.com/projects/226-national-stadium/). The 2020 exterior photograph does not depict the 2008 opening or closing ceremony.
- `olympus-mons-pia00993.jpg`: **NASA/JPL/Malin Space Science Systems**, acquired **1997-10-20**, published **1998-04-23**, [PIA00993 source and caption](https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/). Used under the **[JPL educational/informational image-use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/)**, retaining credit and the restrictions on third-party material and endorsement. The published color composite uses measured red/blue bands and synthesized green; the local JPEG has no further crop or recoloring. It is an orbital image, not a ground photograph, exact hotspot survey or a record of a surface landing.
- `viking-1-pia00381.jpg`: **NASA/JPL**, acquired **1976-07-20**, [PIA00381 source and caption](https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/). Used under **[NASA's educational/informational media-use guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)**, retaining credit and the restrictions on third-party material and endorsement. The NASA-supplied JPEG size variant is used without local colorization or stitching. This black-and-white ground image was taken by an uncrewed lander; it is not a 360-degree panorama or a human landing photograph.

## Libraries

The integrated Earth explorer and independent V5 engineering entry use **CesiumJS 1.146.0**, Apache License 2.0 ([upstream](https://github.com/CesiumGS/cesium)), and **Lucide React 0.468.0**, ISC ([upstream](https://github.com/lucide-icons/lucide)). Cesium worker/assets and the complete pinned package license are copied unchanged; the [distributed Cesium license](https://alzat007.github.io/solaris/cesium/LICENSE.md) accompanies the static build. This software license does not grant rights to third-party geographic data. The explorer retains visible Cesium/local-imagery credits. Google Maps and Cesium ion datasets are not connected or bundled.

React, React DOM, Three.js, React Three Fiber, Drei, postprocessing, Vite, TypeScript, TSX and Prettier retain their respective upstream licenses, available in installed package directories. GSAP license: https://gsap.com/standard-license/ .

## Fonts

DM Sans and Manrope are loaded through Google Fonts and distributed under the SIL Open Font License. Browser system fonts are used if these requests fail.
