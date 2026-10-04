import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputPath = path.join(root, "data/earth-directory-source.json");
const sourceId = "restcountries-v31-frozen";
const revision = "bfadee4f951682c29970e53677707bc558e80b74";
const expectedSha256 =
  "8209daa9fd26e842e84992739dfbfb272566b60357a6ee760955bb4e9f2cc18e";
const sourceUrl = `https://github.com/restcountries/restcountries/blob/${revision}/src/main/resources/countriesV3.1.json`;

// This small editorial list is not a city ranking or complete translation pack.
const chineseAliases = {
  Beijing: ["北京", "北京市", "Peking"],
  Paris: ["巴黎"],
  Tokyo: ["东京", "東京"],
  London: ["伦敦", "倫敦"],
  Rome: ["罗马", "羅馬"],
  "Washington, D.C.": ["华盛顿", "华盛顿特区", "Washington DC"],
  Moscow: ["莫斯科"],
  Berlin: ["柏林"],
  Madrid: ["马德里"],
  Ottawa: ["渥太华"],
  Canberra: ["堪培拉"],
  Seoul: ["首尔", "首爾"],
  Pyongyang: ["平壤"],
  Bangkok: ["曼谷"],
  Hanoi: ["河内", "河內"],
  Jakarta: ["雅加达"],
  Manila: ["马尼拉"],
  Singapore: ["新加坡"],
  "Kuala Lumpur": ["吉隆坡"],
  Kathmandu: ["加德满都"],
  Thimphu: ["廷布"],
  "New Delhi": ["新德里"],
  Islamabad: ["伊斯兰堡"],
  Kabul: ["喀布尔"],
  Tehran: ["德黑兰"],
  Baghdad: ["巴格达"],
  Cairo: ["开罗"],
  Ankara: ["安卡拉"],
  Athens: ["雅典"],
  Lisbon: ["里斯本"],
  Amsterdam: ["阿姆斯特丹"],
  Vienna: ["维也纳"],
  Bern: ["伯尔尼"],
  Brussels: ["布鲁塞尔"],
  Stockholm: ["斯德哥尔摩"],
  Oslo: ["奥斯陆"],
  Copenhagen: ["哥本哈根"],
  Helsinki: ["赫尔辛基"],
  Dublin: ["都柏林"],
  Warsaw: ["华沙"],
  Prague: ["布拉格"],
  Budapest: ["布达佩斯"],
  Kyiv: ["基辅", "Kiev"],
  Wellington: ["惠灵顿"],
  "Mexico City": ["墨西哥城"],
  Brasilia: ["巴西利亚"],
  "Buenos Aires": ["布宜诺斯艾利斯"],
  Santiago: ["圣地亚哥"],
  Lima: ["利马"],
  Pretoria: ["比勒陀利亚"],
  Bloemfontein: ["布隆方丹"],
  "Cape Town": ["开普敦"],
  Nairobi: ["内罗毕"],
  "Addis Ababa": ["亚的斯亚贝巴"],
  Dakar: ["达喀尔"],
  Riyadh: ["利雅得"],
  "Abu Dhabi": ["阿布扎比"],
  Doha: ["多哈"],
  Jerusalem: ["耶路撒冷"],
  Ramallah: ["拉姆安拉"],
  Taipei: ["台北", "臺北"],
};
const featuredNames = new Set(["Beijing", "Paris", "Tokyo", "London", "Rome"]);
const normalize = (name) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const unique = (names) => [
  ...new Map(
    names.filter(Boolean).map((name) => [normalize(name), name]),
  ).values(),
];
const slug = (name) =>
  normalize(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function importEarthDirectory(raw, sourceSha256) {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new Error("Expected a non-empty REST Countries v3.1 array");
  const codeSet = new Set();
  const occurrence = new Map();
  for (const country of raw) {
    if (!/^[A-Z]{2}$/.test(country.cca2) || codeSet.has(country.cca2))
      throw new Error(`Invalid or duplicate country code: ${country.cca2}`);
    codeSet.add(country.cca2);
    if (!country.name?.common?.trim() || !Array.isArray(country.capital))
      throw new Error(`Missing country name/capital array: ${country.cca2}`);
    const caps = country.capital.map(normalize);
    if (caps.some((name) => !name) || new Set(caps).size !== caps.length)
      throw new Error(`Empty or duplicate capital: ${country.cca2}`);
    for (const name of country.capital)
      occurrence.set(name, (occurrence.get(name) || 0) + 1);
  }
  const citiesById = new Map();
  const countries = raw
    .map((country) => {
      const id = country.cca2.toLowerCase();
      const zh =
        country.translations?.zho?.common ||
        country.name.nativeName?.zho?.common ||
        country.name.common;
      const notes =
        country.capital.length > 1
          ? "来源列出多个首都名称，但未提供各自职能、生效日期或独立坐标；尚待逐项核验。"
          : !country.capital.length
            ? "本快照未列出首都；不由程序推断或补造。"
            : "保留来源快照的首都表述；未核验当前职能或生效日期，不代表实时法律结论。";
      const capitalRelations = country.capital.map((name) => {
        // Same-named Kingston entries are different places; Jerusalem keeps both source relationships.
        const suffix =
          occurrence.get(name) > 1 && name !== "Jerusalem" ? `-${id}` : "";
        const washington = ["Washington DC", "Washington, D.C."].includes(name);
        const cityId = washington
          ? "city-washington-dc"
          : `city-${slug(name)}${suffix}`;
        const p = country.capitalInfo?.latlng;
        if (
          p?.length &&
          (p.length !== 2 ||
            !p.every(Number.isFinite) ||
            Math.abs(p[0]) > 90 ||
            Math.abs(p[1]) > 180)
        )
          throw new Error(`Invalid capital coordinates: ${country.cca2}`);
        let city = citiesById.get(cityId);
        if (!city) {
          const aliases = unique(chineseAliases[name] || []);
          city = {
            id: cityId,
            name: {
              zh:
                aliases.find((alias) => /\p{Script=Han}/u.test(alias)) || name,
              en: washington ? "Washington, D.C." : name,
            },
            aliases,
            countryIds: [],
            tags: featuredNames.has(name)
              ? ["capital", "featured"]
              : ["capital"],
            coordinates:
              country.capital.length === 1 && p?.length === 2
                ? { latitude: p[0], longitude: p[1] }
                : null,
            translationStatus: aliases.some((alias) =>
              /\p{Script=Han}/u.test(alias),
            )
              ? "editorial-alias"
              : "pending",
            contentStatus: "pending",
            notes,
            sourceRefs: [sourceId],
          };
          citiesById.set(cityId, city);
        }
        city.aliases = unique([
          ...city.aliases,
          ...(chineseAliases[name] || []),
          ...(name !== city.name.en ? [name] : []),
        ]);
        const chineseName = city.aliases.find((alias) =>
          /\p{Script=Han}/u.test(alias),
        );
        if (chineseName) {
          city.name.zh = chineseName;
          city.translationStatus = "editorial-alias";
        }
        if (
          !city.coordinates &&
          country.capital.length === 1 &&
          p?.length === 2
        )
          city.coordinates = { latitude: p[0], longitude: p[1] };
        city.countryIds.push(id);
        if (city.countryIds.length > 1)
          city.notes =
            "同一地点保留多条来源归属/首都表述，须分别查看关系说明；目录不判定主权或法律地位。";
        return {
          cityId,
          roles: ["source-listed"],
          effectiveFrom: null,
          effectiveTo: null,
          notes,
          sourceRefs: [sourceId],
        };
      });
      return {
        id,
        name: { zh, en: country.name.common },
        aliases: unique([
          country.name.official,
          country.translations?.zho?.official,
          ...(country.altSpellings || []),
          country.cca2,
        ]),
        sourceStatus: country.status || "unknown",
        independent: country.independent ?? null,
        unMember: country.unMember ?? null,
        capitalRelations,
        notes: `${notes} 条目范围含国家与地区，status/independent/unMember 按来源保留。`,
        sourceRefs: [sourceId],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  if (codeSet.has("US"))
    citiesById.set("city-new-york", {
      id: "city-new-york",
      name: { zh: "纽约", en: "New York City" },
      aliases: ["纽约市", "紐約", "New York", "NYC"],
      countryIds: ["us"],
      tags: ["featured"],
      coordinates: { latitude: 40.712777777778, longitude: -74.006111111111 },
      translationStatus: "editorial-alias",
      contentStatus: "pending",
      notes:
        "人工首批选录，用于城市文化与公共遗产主题；不是现任首都，也不是名城排名。坐标是城市定位点，不是具体历史事件地点。",
      sourceRefs: ["wikidata-new-york"],
    });
  return {
    version: "earth-directory-v3-2026-10-04",
    databaseLicense: {
      id: "ODbL-1.0",
      url: "https://opendatacommons.org/licenses/odbl/1-0/",
      attribution:
        "SOLARIS Earth Directory contains information from REST Countries and mledoze/countries. This derived database is available under the Open Database License (ODbL) 1.0; application code and separately credited images are not covered by this database license.",
      sourceUrl:
        "https://github.com/mledoze/countries/blob/c2ac0049c14edcf2436c7aa1b2493222a020b462/LICENSE",
      downloadUrl:
        "https://raw.githubusercontent.com/Alzat007/solaris/v3-public-preview-2026-10-04/data/earth-directory-source.json",
    },
    baseline: {
      scope:
        "REST Countries v3.1 固定开源快照的全部国家与地区条目；不是主权国家数量或实时首都法律清单。",
      scopeEn:
        "All country and territory entries in the frozen REST Countries v3.1 source, not a sovereign-state count or live legal capital register.",
      sourceId,
      expectedCountryEntries: raw.length,
      expectedCapitalRelations: raw.reduce(
        (n, country) => n + country.capital.length,
        0,
      ),
      sourceSha256,
      featuredSelection:
        "首批人工选录北京、纽约、巴黎、东京、伦敦、罗马，用于文化/探测/公共遗产主题模板；不宣称排名或最终名城范围。",
    },
    sources: [
      {
        id: sourceId,
        title: "REST Countries v3.1 frozen source data",
        url: sourceUrl,
        revision,
        retrievedAt: "2026-10-04",
        license:
          "MPL-2.0 (repository); upstream country-data lineage: mledoze/countries ODbL-1.0",
        licenseUrl: `https://github.com/restcountries/restcountries/blob/${revision}/LICENSE`,
      },
      {
        id: "wikidata-new-york",
        title: "Wikidata Q60 labels and P625 city location",
        url: "https://www.wikidata.org/wiki/Q60",
        revision: "page consulted 2026-10-04",
        retrievedAt: "2026-10-04",
        license: "CC0 structured data",
        licenseUrl: "https://www.wikidata.org/wiki/Wikidata:Copyright",
      },
    ],
    countries,
    cities: [...citiesById.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--check" || !args.length) {
    const { earthDirectory, earthDirectoryStats, validateEarthDirectory } =
      await import("../src/exploration/earthDirectory.ts");
    const errors = validateEarthDirectory(earthDirectory);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify(
        {
          version: earthDirectory.version,
          ...earthDirectoryStats(earthDirectory),
          errors: [],
        },
        null,
        2,
      ),
    );
    return;
  }
  if (args[0] !== "--from" || !args[1])
    throw new Error(
      "Usage: node scripts/import-earth-directory.mjs --check | --from /path/to/countriesV3.1.json",
    );
  const source = await readFile(args[1]);
  const sha256 = createHash("sha256").update(source).digest("hex");
  if (sha256 !== expectedSha256)
    throw new Error(
      "Source checksum differs from pinned revision; review and update provenance before importing another snapshot",
    );
  const directory = importEarthDirectory(JSON.parse(source.toString()), sha256);
  const { validateEarthDirectory } = await import(
    "../src/exploration/earthDirectory.ts"
  );
  const errors = validateEarthDirectory(directory);
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(outputPath, `${JSON.stringify(directory, null, 2)}\n`);
  console.log(
    `Imported ${directory.countries.length} source entries, ${directory.baseline.expectedCapitalRelations} capital relationships, ${directory.cities.length} cities. Run --check before use.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
