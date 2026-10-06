import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

// Data import only. Playwright/Sharp are optional QA tools, not app dependencies.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");
const specs = JSON.parse(
  await readFile("data/first-batch-landmark-spec.json", "utf8"),
);
const overrides = JSON.parse(
  await readFile("data/first-batch-landmark-image-overrides.json", "utf8"),
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const proxy = process.env.SOLARIS_IMPORT_PROXY;
const folder = "public/exploration/first-batch/landmarks";
await mkdir(folder, { recursive: true });
await mkdir("artifacts/landmark-import-cache", { recursive: true });
const records = [];
let previousRecords = [];
try {
  previousRecords = JSON.parse(
    await readFile(`${folder}/source-records.json`, "utf8"),
  );
} catch {}
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalize = (name) => name.replaceAll("_", " ").normalize("NFC");
function request(url) {
  const args = [
    "-A",
    "SOLARIS-Educational-Atlas/1.0 (source-audit)",
    "-L",
    "--fail",
    "--retry",
    "3",
    "--retry-all-errors",
    "--connect-timeout",
    "10",
    "--max-time",
    "40",
    "-s",
    url,
  ];
  if (proxy) args.unshift("--proxy", proxy);
  return execFileSync("curl", args, { maxBuffer: 40 * 1024 * 1024 });
}
async function api(host, args) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ format: "json", ...args }).toString();
  const path = `artifacts/landmark-import-cache/${hash(url.href)}.json`;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const result = JSON.parse(request(url.href));
  if (result.error) throw new Error(JSON.stringify(result.error));
  await writeFile(path, JSON.stringify(result));
  return result;
}
async function clean(html) {
  return page.evaluate(
    (value) =>
      new DOMParser()
        .parseFromString(value || "", "text/html")
        .body.textContent.replace(/\s+/g, " ")
        .trim(),
    html,
  );
}
function values(entity, key) {
  return (entity.claims?.[key] ?? [])
    .filter(
      (claim) =>
        claim.rank !== "deprecated" && claim.mainsnak.snaktype === "value",
    )
    .map((claim) => claim.mainsnak.datavalue.value);
}
try {
  const wikiPages = new Map();
  for (let offset = 0; offset < specs.length; offset += 20) {
    const query = await api("en.wikipedia.org", {
      action: "query",
      titles: specs
        .slice(offset, offset + 20)
        .map((spec) => spec.article)
        .join("|"),
      prop: "pageprops|pageimages|images",
      piprop: "name",
      imlimit: "50",
      redirects: "1",
    });
    const normalized = new Map(
      (query.query.normalized ?? []).map((item) => [item.from, item.to]),
    );
    const redirects = new Map(
      (query.query.redirects ?? []).map((item) => [item.from, item.to]),
    );
    for (const spec of specs.slice(offset, offset + 20)) {
      const title =
        redirects.get(normalized.get(spec.article) ?? spec.article) ??
        normalized.get(spec.article) ??
        spec.article;
      const record = Object.values(query.query.pages).find(
        (entry) => entry.title === title,
      );
      if (
        !record?.pageprops?.wikibase_item ||
        "disambiguation" in record.pageprops
      )
        throw new Error(`Missing or ambiguous entity: ${spec.article}`);
      wikiPages.set(spec.id, record);
    }
  }
  const entities = {};
  const ids = [
    ...new Set(
      [...wikiPages.values()].map((entry) => entry.pageprops.wikibase_item),
    ),
  ];
  for (let offset = 0; offset < ids.length; offset += 40) {
    Object.assign(
      entities,
      (
        await api("www.wikidata.org", {
          action: "wbgetentities",
          ids: ids.slice(offset, offset + 40).join("|"),
          props: "claims|labels|descriptions",
          languages: "en|zh",
        })
      ).entities,
    );
  }
  const candidates = new Map();
  for (const spec of specs) {
    const wiki = wikiPages.get(spec.id);
    const entity = entities[wiki.pageprops.wikibase_item];
    candidates.set(spec.id, [
      ...new Set(
        (
          overrides[spec.id] ?? [
            wiki.pageimage,
            ...values(entity, "P18"),
            ...(wiki.images ?? []).map((image) => image.title.slice(5)),
          ]
        )
          .filter((name) => name && /\.jpe?g$/i.test(name))
          .map(normalize),
      ),
    ]);
  }
  const fileInfo = new Map();
  const filenames = [...new Set([...candidates.values()].flat())];
  for (let offset = 0; offset < filenames.length; offset += 20) {
    const info = await api("commons.wikimedia.org", {
      action: "query",
      titles: filenames
        .slice(offset, offset + 20)
        .map((name) => `File:${name}`)
        .join("|"),
      prop: "imageinfo",
      iiprop: "url|extmetadata|size|sha1",
      iiurlwidth: "1280",
      iiurlheight: "1280",
      redirects: "1",
    });
    for (const record of Object.values(info.query.pages)) {
      const file = record.imageinfo?.[0];
      if (file) fileInfo.set(normalize(record.title.slice(5)), file);
    }
    for (const redirect of info.query.redirects ?? []) {
      const file = fileInfo.get(normalize(redirect.to.slice(5)));
      if (file) fileInfo.set(normalize(redirect.from.slice(5)), file);
    }
    console.log(
      `Metadata: ${Math.min(offset + 20, filenames.length)}/${filenames.length}`,
    );
  }
  for (const spec of specs) {
    const wiki = wikiPages.get(spec.id);
    const entityId = wiki.pageprops.wikibase_item;
    const entity = entities[entityId];
    const coordinate = values(entity, "P625").find((value) =>
      value.globe.endsWith("Q2"),
    );
    if (!coordinate) throw new Error(`Missing Earth position: ${spec.id}`);
    const images = [];
    const subjectFiles = candidates.get(spec.id);
    const known = subjectFiles
      .map((name) => fileInfo.get(name))
      .filter(Boolean);
    if (
      !overrides[spec.id] &&
      new Set(known.map((file) => file.sha1)).size < 3
    ) {
      const search = await api("commons.wikimedia.org", {
        action: "query",
        generator: "search",
        gsrsearch: `intitle:"${spec.article.replaceAll(",", "")}" filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "8",
        prop: "imageinfo",
        iiprop: "url|extmetadata|size|sha1",
        iiurlwidth: "1280",
        iiurlheight: "1280",
      });
      for (const record of Object.values(search.query?.pages ?? {})) {
        if (!/\.jpe?g$/i.test(record.title)) continue;
        const filename = normalize(record.title.slice(5));
        const file = record.imageinfo?.[0];
        if (!file) continue;
        fileInfo.set(filename, file);
        if (!subjectFiles.includes(filename)) subjectFiles.push(filename);
      }
    }
    for (const filename of subjectFiles) {
      if (images.length >= 2) break;
      const file = fileInfo.get(filename);
      if (!file || images.some((image) => image.sourceSha1 === file.sha1))
        continue;
      const meta = file.extmetadata ?? {};
      const license = await clean(meta.LicenseShortName?.value);
      if (!/^(CC BY|CC0|Public domain)/i.test(license) || /NC|ND/.test(license))
        continue;
      const date = await clean(
        meta.DateTimeOriginal?.value ||
          "Shooting date not supplied; see source record",
      );
      const artist = await clean(meta.Attribution?.value || meta.Artist?.value);
      if (!artist || /pxfuel|wallpaper|stock/i.test(artist)) continue;
      const description = await clean(meta.ImageDescription?.value);
      const licenseAddress = new URL(
        meta.LicenseUrl?.value ||
          "https://commons.wikimedia.org/wiki/Commons:Licensing",
      );
      if (licenseAddress.hostname === "creativecommons.org")
        licenseAddress.protocol = "https:";
      const downloadUrl = file.thumburl || file.url;
      try {
        const path = `exploration/first-batch/landmarks/${spec.id}-${images.length + 1}.jpg`;
        const old = previousRecords
          .flatMap((record) => record.images)
          .find((image) => image.downloadUrl === downloadUrl);
        let bytes;
        if (old) {
          try {
            bytes = await readFile(`public/${old.path}`);
          } catch {}
        }
        if (!bytes || (old && old.sha256 !== hash(bytes)))
          bytes = request(downloadUrl);
        const decoded = await sharp(bytes).metadata();
        if (
          decoded.format !== "jpeg" ||
          decoded.width < 300 ||
          decoded.height < 200 ||
          images.some((image) => image.sha256 === hash(bytes))
        )
          continue;
        await writeFile(`public/${path}`, bytes);
        images.push({
          path,
          filename,
          sourceUrl: file.descriptionurl,
          downloadUrl,
          author: artist,
          date,
          license,
          licenseUrl: licenseAddress.href,
          description,
          width: decoded.width,
          height: decoded.height,
          bytes: bytes.length,
          sha256: hash(bytes),
          sourceSha1: file.sha1,
          rawMetadata: meta,
          review: "pending-subject-and-rights-review",
        });
      } catch (error) {
        console.error(
          `${spec.id} image skipped: ${String(error).slice(0, 140)}`,
        );
      }
    }
    const sourceUrls = [
      `https://www.wikidata.org/wiki/${entityId}`,
      `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki.title.replaceAll(" ", "_"))}`,
    ];
    records.push({
      ...spec,
      entityId,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      sourceUrls,
      images,
      humanReview: "pending",
    });
    await writeFile(
      `${folder}/source-records.json`,
      `${JSON.stringify(records, null, 2)}\n`,
    );
    const compact = records.map((record) => ({
      ...record,
      images: record.images.map(({ rawMetadata, ...image }) => image),
    }));
    await writeFile(
      "data/first-batch-landmarks.json",
      `${JSON.stringify(compact, null, 2)}\n`,
    );
    console.log(
      `${spec.id}: ${images.length} distinct candidates / ${coordinate.latitude},${coordinate.longitude}`,
    );
  }
} finally {
  await browser.close();
}
