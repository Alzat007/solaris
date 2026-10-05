import type { PlanetId } from "../data/planets";
import { assets, getDestination, stories } from "./content";
import type { LocalizedText } from "./contentTypes";
import { isContentDate } from "./validateContent";

export interface ImmersiveHotspotImage {
  path: string;
  caption: LocalizedText;
  credit: string;
  date: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  processing: LocalizedText;
}

export interface ImmersiveHotspot {
  id: string;
  name: LocalizedText;
  latitude: number;
  longitude: number;
  coordinateAccuracy: "source-position" | "approximate";
  coordinateNote: LocalizedText;
  summary: LocalizedText;
  paragraphs: LocalizedText[];
  date: string;
  relation: LocalizedText;
  sourceUrls: string[];
  image?: ImmersiveHotspotImage;
  humanReview: "pending";
}

export interface ImmersiveSite {
  id: string;
  bodyId: PlanetId;
  cityId?: string;
  name: LocalizedText;
  center: { latitude: number; longitude: number };
  spanKm: number;
  kind: "city-atlas" | "orbital-atlas";
  baseAssetId?: string;
  hotspots: ImmersiveHotspot[];
}

const text = (zh: string, en: string): LocalizedText => ({ zh, en });
const commonsLicense = "https://creativecommons.org/licenses/by-sa/3.0/";
const olympusSource =
  "https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/";
const olympusPosition = "https://planetarynames.wr.usgs.gov/Feature/4453";
const beijingPosition = (item: string) =>
  text(
    `示意热点采用 Wikidata ${item} 的地标位置，四舍五入后用于区域定位；不是测绘、道路导航或照片机位坐标。`,
    `Schematic marker based on Wikidata ${item}, rounded for regional orientation; not survey, routing, or camera-position coordinates.`,
  );

function existingImage(assetId: string): ImmersiveHotspotImage {
  const asset = assets.find((entry) => entry.id === assetId);
  if (!asset) throw new Error(`Missing reviewed asset: ${assetId}`);
  return {
    path: asset.path,
    caption: asset.caption,
    credit: asset.credit,
    date: asset.date,
    sourceUrl: asset.sourceUrl,
    license: asset.license,
    licenseUrl: asset.rightsUrl,
    processing: asset.processing,
  };
}

const vikingDestination = getDestination("mars-viking-1");
const vikingStory = stories.find(
  (entry) => entry.id === "story-viking-1-landing",
);
if (!vikingDestination?.position || !vikingStory)
  throw new Error("Viking sample requires the existing source-checked records");

export const immersiveSites: ImmersiveSite[] = [
  {
    id: "beijing",
    bodyId: "earth",
    cityId: "city-beijing",
    name: text("北京", "Beijing"),
    center: { latitude: 39.9072, longitude: 116.3914 },
    spanKm: 160,
    kind: "city-atlas",
    hotspots: [
      {
        id: "beijing-tiananmen",
        name: text("天安门", "Tiananmen"),
        latitude: 39.9074,
        longitude: 116.3912,
        coordinateAccuracy: "approximate",
        coordinateNote: beijingPosition("Q83973"),
        summary: text(
          "从城楼认识北京中轴线的城市布局与文化遗产保护。",
          "A gateway into Beijing's Central Axis and the conservation of urban heritage.",
        ),
        paragraphs: [
          text(
            "天安门位于北京中轴线，由端门、天安门及外金水桥等建筑延续老城的南北空间秩序。北京中轴线于 2024 年 7 月 27 日列入《世界遗产名录》，这是整组遗产的保护里程碑，不是城楼建成日期。",
            "Tiananmen sits on Beijing's Central Axis, where Duanmen, Tiananmen and the Outer Jinshui Bridges continue the old city's north-south spatial order. The Central Axis ensemble entered the World Heritage List on July 27, 2024; that is a heritage milestone, not the gate's construction date.",
          ),
          text(
            "认识遗产不只是观看建筑，也包括理解它与周边道路、广场及公共空间的关系。配图是 2008 年的地标照片，与 2024 年的遗产主题相关，但不记录申遗决议现场。",
            "Understanding heritage includes the connections between buildings, roads, squares and public spaces. The 2008 landmark photograph illustrates the site; it is not a photograph of the 2024 inscription decision.",
          ),
        ],
        date: "2024-07-27",
        relation: text(
          "文化遗产主题相关：天安门是中轴线的构成要素，申遗决议不发生在这张地标照片中。",
          "Heritage-related site: Tiananmen is a component of the Central Axis. This landmark photograph does not depict the inscription meeting.",
        ),
        sourceUrls: [
          "https://wwj.beijing.gov.cn/bjww/362771/362778/543394323/index.html",
          "https://whc.unesco.org/en/decisions/8607/",
          "https://www.wikidata.org/wiki/Q83973",
        ],
        image: {
          path: "exploration/beijing-tiananmen-2008.jpg",
          caption: text(
            "Rabs003 于 2008 年 10 月 12 日拍摄的天安门城楼；地标配图，不是申遗活动现场或实时影像。",
            "Tiananmen photographed by Rabs003 on October 12, 2008; a landmark illustration, not the inscription event or a live view.",
          ),
          credit: "Rabs003 / Wikimedia Commons / CC BY-SA 3.0",
          date: "2008-10-12",
          sourceUrl:
            "https://commons.wikimedia.org/wiki/File:Tiananmen_Gate.jpg",
          license: "CC BY-SA 3.0",
          licenseUrl: commonsLicense,
          processing: text(
            "Wikimedia 提供的 960 像素宽版本；未本地裁剪、调色或合成，图片保留原许可。",
            "960-pixel-wide Wikimedia version; no local crop, recoloring or compositing. Image retains its original license.",
          ),
        },
        humanReview: "pending",
      },
      {
        id: "beijing-great-wall",
        name: text("八达岭长城", "Great Wall at Badaling"),
        latitude: 40.3543,
        longitude: 116.0065,
        coordinateAccuracy: "approximate",
        coordinateNote: beijingPosition("Q798826"),
        summary: text(
          "沿山势修建的墙体与烽火台，是需要共同保护的文化遗产。",
          "Walls and towers following the mountain terrain form a cultural heritage to conserve together.",
        ),
        paragraphs: [
          text(
            "长城于 1987 年列入《世界遗产名录》。它不是一段单独的墙，而是包含墙体、关隘、烽火台等要素的复杂体系；八达岭是北京境内可认识这份遗产的区域之一。",
            "The Great Wall entered the World Heritage List in 1987. It is a system of walls, passes and towers rather than a single wall; Badaling is one of the areas within Beijing where that heritage can be studied.",
          ),
          text(
            "UNESCO 的保护管理要求强调对遗产整体及其真实性、完整性的长期保护。参观与教育应尊重原有材料和山地环境；这里展示的是保护主题，不将 2006 年照片当作 1987 年列入名录的现场记录。",
            "UNESCO's management requirements emphasize long-term conservation of the whole property, its authenticity and integrity. Visits and education should respect original materials and mountain settings. This 2006 photograph illustrates a conservation theme, not the 1987 inscription event.",
          ),
        ],
        date: "1987",
        relation: text(
          "文化遗产与保护主题相关：八达岭长城地标照片，而非某次修复活动的现场照片。",
          "Heritage and conservation-related landmark photograph, not documentation of a particular restoration project.",
        ),
        sourceUrls: [
          "https://whc.unesco.org/en/list/438/",
          "https://www.wikidata.org/wiki/Q798826",
        ],
        image: {
          path: "exploration/beijing-badaling-2006.jpg",
          caption: text(
            "Robysan 于 2006 年 8 月 5 日拍摄的八达岭长城；沿山的墙体与敌台可见，不是今天的实时画面。",
            "Great Wall at Badaling photographed by Robysan on August 5, 2006. Walls and towers follow the mountains; this is not a current live view.",
          ),
          credit: "Robysan / Wikimedia Commons / CC BY-SA 3.0",
          date: "2006-08-05",
          sourceUrl:
            "https://commons.wikimedia.org/wiki/File:Greatwall_badaling.jpg",
          license: "CC BY-SA 3.0",
          licenseUrl: commonsLicense,
          processing: text(
            "使用原发布 JPEG；未本地裁剪、调色或合成，图片保留原许可。",
            "Original published JPEG; no local crop, recoloring or compositing. Image retains its original license.",
          ),
        },
        humanReview: "pending",
      },
      {
        id: "beijing-birds-nest",
        name: text("鸟巢 · 国家体育场", "Bird's Nest · National Stadium"),
        latitude: 39.9915,
        longitude: 116.3905,
        coordinateAccuracy: "approximate",
        coordinateNote: beijingPosition("Q133525"),
        summary: text(
          "2008 年北京奥运会开闭幕式场馆，连接体育、建筑与国际交流。",
          "Venue for Beijing 2008's opening and closing ceremonies, connecting sport, architecture and international exchange.",
        ),
        paragraphs: [
          text(
            "国家体育场举办了 2008 年北京奥运会开幕式和闭幕式，日期分别是 8 月 8 日与 8 月 24 日。赛事与文化展示让世界各地的人们在同一场馆中相遇。",
            "The National Stadium hosted the Beijing 2008 Olympic opening and closing ceremonies on August 8 and August 24. Sport and cultural presentations brought people from around the world together at this venue.",
          ),
          text(
            "鸟巢外观的交织钢结构与看台共同形成可识别的建筑轮廓。建筑设计与工程合作包括 Herzog & de Meuron、Arup 和中国建筑设计研究院，艺术顾问为艾未未。配图拍于 2020 年，只说明场馆外观，不记录 2008 年开闭幕式。",
            "Its interwoven structural exterior and seating bowl form the recognizable Bird's Nest silhouette. The design consortium included Herzog & de Meuron, Arup and China Architectural Design & Research Group, with Ai Weiwei as artistic advisor. The photograph is from 2020 and shows the building, not either 2008 ceremony.",
          ),
        ],
        date: "2008",
        relation: text(
          "事件发生于该场馆；2020 年外观照片是地标配图，不是 2008 年赛事现场。",
          "The ceremonies occurred at this venue; the 2020 exterior photograph illustrates the landmark, not the 2008 events.",
        ),
        sourceUrls: [
          "https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=160094&parentDocumentId=23655&skipCopyright=true&skipWatermark=true",
          "https://www.youtube.com/watch?v=UJd2d4-CEqw",
          "https://www.herzogdemeuron.com/projects/226-national-stadium/",
          "https://www.wikidata.org/wiki/Q133525",
        ],
        image: {
          path: "exploration/beijing-birds-nest-2020.jpg",
          caption: text(
            "Balon Greyjoy 于 2020 年 1 月 9 日拍摄的国家体育场外观；不是 2008 年奥运会开闭幕式照片。",
            "National Stadium exterior by Balon Greyjoy, January 9, 2020; not a photograph of the 2008 Olympic ceremonies.",
          ),
          credit:
            "Photo: Balon Greyjoy / Wikimedia Commons / CC0 1.0. National Stadium: Herzog & de Meuron, Arup, China Architectural Design & Research Group; artistic advisor Ai Weiwei.",
          date: "2020-01-09",
          sourceUrl:
            "https://commons.wikimedia.org/wiki/File:20200109_Beijing_National_Stadium-11.jpg",
          license: "CC0 1.0",
          licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
          processing: text(
            "Wikimedia 提供的 960 像素宽版本；原作者发布文件记录含 Lightroom 处理信息，未本地裁剪、调色或合成。",
            "960-pixel-wide Wikimedia version. The published file records Lightroom processing by its author; no local crop, recoloring or compositing.",
          ),
        },
        humanReview: "pending",
      },
    ],
  },
  {
    id: "mars-olympus-mons",
    bodyId: "mars",
    name: text("奥林帕斯山", "Olympus Mons"),
    center: { latitude: 18.65, longitude: -133.8 },
    spanKm: 900,
    kind: "orbital-atlas",
    baseAssetId: "asset-olympus-mons",
    hotspots: [
      {
        id: "olympus-summit-caldera",
        name: text("峰顶破火山口", "Summit caldera"),
        latitude: 18.65,
        longitude: -133.8,
        coordinateAccuracy: "approximate",
        coordinateNote: text(
          "标注使用 USGS 奥林帕斯山区域中心（18.65°N、226.20°E）作为科学解读锚点，不是经测绘确认的破火山口中心。",
          "The annotation uses the USGS regional center, 18.65 N / 226.20 E, as an interpretive anchor, not a surveyed caldera center.",
        ),
        summary: text(
          "轨道相机看见的复合塌陷结构，记录了火山演化线索。",
          "An orbital view of overlapping collapse depressions provides clues to volcanic evolution.",
        ),
        paragraphs: [
          text(
            "NASA/JPL 于 1998 年发布的 PIA00993 图注，将峰顶复合破火山口描述为多个近圆形塌陷区组成，水平范围约 66×83 公里。这个数字是横向尺寸，不是火山高度。",
            "The 1998 NASA/JPL caption for PIA00993 describes overlapping, roughly circular collapse depressions at the summit, spanning about 66 by 83 kilometers. These are horizontal dimensions, not the volcano's elevation.",
          ),
          text(
            "这张影像来自 1997 年 10 月 20 日火星全球勘测者号的轨道观测。我们通过遥感理解地貌，不将虚拟推进动画或示意热点写成无人探测器在峰顶着陆，更不是人类登陆。",
            "Mars Global Surveyor acquired the image from orbit on October 20, 1997. This is remote sensing: neither the virtual descent nor the schematic marker represents a robot landing at the summit, much less a human landing.",
          ),
        ],
        date: "1997-10-20",
        relation: text(
          "轨道遥感的地貌解读；热点是教学标注，不是探索器着陆点。",
          "Remote-observation interpretation; the marker is educational, not a spacecraft landing site.",
        ),
        sourceUrls: [olympusSource, olympusPosition],
        image: existingImage("asset-olympus-mons"),
        humanReview: "pending",
      },
      {
        id: "olympus-volcanic-flank",
        name: text("盾状火山的宽阔坡面", "Broad shield-volcano flank"),
        latitude: 18.65,
        longitude: -137,
        coordinateAccuracy: "approximate",
        coordinateNote: text(
          "西侧坡面教学标注约在 18.65°N、137°W，位于 USGS 记载的区域范围内；位置是示意选择，不是命名地貌或精确熔岩采样点。",
          "The western-flank annotation near 18.65 N / 137 W is within the USGS regional extent. It is an approximate interpretive position, not a named feature or surveyed lava-sampling point.",
        ),
        summary: text(
          "一次次熔岩流堆积出宽阔盾状轮廓；轨道观测帮助理解火山形成。",
          "Repeated lava flows built a broad shield profile, studied through orbital observation.",
        ),
        paragraphs: [
          text(
            "NASA 将奥林帕斯山描述为由反复熔岩流堆积形成的盾状火山。宽阔的侧翼提醒我们：认识火山，既要看峰顶，也要看覆盖大片区域的坡面。",
            "NASA describes Olympus Mons as a shield volcano built by repeated lava flows. Its broad flanks show why studying a volcano means examining both its summit and its extensive surrounding slopes.",
          ),
          text(
            "这里沿用 PIA00993 的完整轨道影像展示区域背景，没有为该热点编造地面特写。其红、蓝波段实测而绿色合成，因此颜色不能被当作肉眼站在火星地面看到的实时景观。",
            "The complete PIA00993 orbital image provides regional context, not an invented close-up of this marker. Red and blue bands were measured and green synthesized, so its colors are not a live, human-eye view from the surface.",
          ),
        ],
        date: "1997-10-20",
        relation: text(
          "火山科学主题与轨道影像相关；不宣称该教学标注有实地活动记录。",
          "Volcanic-science topic linked to orbital imagery; no field expedition is claimed at this interpretive marker.",
        ),
        sourceUrls: [
          "https://science.nasa.gov/photojournal/large-lava-fan-on-the-northwestern-flank-of-olympus-mons/",
          olympusSource,
          olympusPosition,
        ],
        image: existingImage("asset-olympus-mons"),
        humanReview: "pending",
      },
    ],
  },
  {
    id: "mars-viking-1",
    bodyId: "mars",
    name: text("维京 1 号着陆点", "Viking 1 landing site"),
    center: {
      latitude: vikingDestination.position.latitude,
      longitude: vikingDestination.position.longitude,
    },
    spanKm: 100,
    kind: "orbital-atlas",
    hotspots: [
      {
        id: "viking-1-surface-science",
        name: text(
          "无人着陆与地面成像",
          "Uncrewed landing and surface imaging",
        ),
        latitude: vikingDestination.position.latitude,
        longitude: vikingDestination.position.longitude,
        coordinateAccuracy: "source-position",
        coordinateNote: vikingDestination.position.description,
        summary: vikingStory.summary,
        paragraphs: [vikingStory.body],
        date: vikingStory.date,
        relation: vikingStory.links[0].description,
        sourceUrls: [
          "https://science.nasa.gov/mission/viking-1/",
          "https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/",
        ],
        image: existingImage("asset-viking-1"),
        humanReview: "pending",
      },
    ],
  },
];

export function getImmersiveSite(id: string): ImmersiveSite | undefined {
  return immersiveSites.find((site) => site.id === id);
}

export function validateImmersiveCatalog(
  sites: ImmersiveSite[] = immersiveSites,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const localized = (value: LocalizedText, label: string) => {
    if (!value?.zh?.trim() || !value?.en?.trim())
      errors.push(`${label}: both languages are required`);
  };
  const id = (value: string) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || ids.has(value))
      errors.push(`${value}: invalid or duplicate stable ID`);
    ids.add(value);
  };
  const position = (latitude: number, longitude: number, label: string) => {
    if (
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180
    )
      errors.push(`${label}: invalid coordinates`);
  };
  const url = (value: string, label: string) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        errors.push(`${label}: unsafe source URL`);
    } catch {
      errors.push(`${label}: invalid source URL`);
    }
  };
  for (const site of sites) {
    id(site.id);
    localized(site.name, `${site.id}.name`);
    position(site.center.latitude, site.center.longitude, site.id);
    if (!(site.spanKm > 0) || !Number.isFinite(site.spanKm))
      errors.push(`${site.id}: invalid atlas span`);
    if (site.kind === "city-atlas" && (site.bodyId !== "earth" || !site.cityId))
      errors.push(`${site.id}: a city atlas requires Earth and a city ID`);
    if (
      site.baseAssetId &&
      !assets.some((asset) => asset.id === site.baseAssetId)
    )
      errors.push(`${site.id}: unknown base asset`);
    if (site.hotspots.length === 0) errors.push(`${site.id}: no hotspots`);
    for (const hotspot of site.hotspots) {
      id(hotspot.id);
      position(hotspot.latitude, hotspot.longitude, hotspot.id);
      for (const field of [
        "name",
        "summary",
        "relation",
        "coordinateNote",
      ] as const)
        localized(hotspot[field], `${hotspot.id}.${field}`);
      if (!hotspot.paragraphs.length)
        errors.push(`${hotspot.id}: missing story`);
      hotspot.paragraphs.forEach((paragraph, index) =>
        localized(paragraph, `${hotspot.id}.paragraphs.${index}`),
      );
      if (!isContentDate(hotspot.date))
        errors.push(`${hotspot.id}: invalid date`);
      if (!hotspot.sourceUrls.length)
        errors.push(`${hotspot.id}: missing fact sources`);
      hotspot.sourceUrls.forEach((source) => url(source, hotspot.id));
      if (hotspot.humanReview !== "pending")
        errors.push(`${hotspot.id}: sample review must remain pending`);
      if (
        !["source-position", "approximate"].includes(hotspot.coordinateAccuracy)
      )
        errors.push(`${hotspot.id}: missing coordinate accuracy`);
      const image = hotspot.image;
      if (!image) continue;
      if (!/^exploration\/[a-z0-9-]+\.jpg$/.test(image.path))
        errors.push(`${hotspot.id}: unsafe asset path`);
      if (!image.credit.trim() || !image.license.trim())
        errors.push(`${hotspot.id}: missing image rights or credit`);
      if (!isContentDate(image.date))
        errors.push(`${hotspot.id}: invalid image date`);
      localized(image.caption, `${hotspot.id}.image.caption`);
      localized(image.processing, `${hotspot.id}.image.processing`);
      url(image.sourceUrl, `${hotspot.id}.image.sourceUrl`);
      url(image.licenseUrl, `${hotspot.id}.image.licenseUrl`);
    }
  }
  return errors;
}
