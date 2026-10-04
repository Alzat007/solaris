import type {
  Asset,
  ContentPack,
  ContentReview,
  ContentSource,
  Destination,
  ExplorationContent,
  Story,
} from "./contentTypes";
import contentPackManifest from "../../public/exploration/content-pack.json";

const reviewed = (): ContentReview => ({
  status: "source-checked",
  by: "Codex source review",
  checkedAt: "2026-10-04",
  humanReview: "pending",
});

const pending = (): ContentReview => ({
  status: "pending",
  by: null,
  checkedAt: null,
  humanReview: "pending",
});

export const sources: ContentSource[] = [
  {
    id: "nasa-mercury-facts",
    title: "Mercury Facts",
    url: "https://science.nasa.gov/mercury/facts/",
    institution: "NASA",
    review: reviewed(),
  },
  {
    id: "nasa-maxwell-montes",
    title: "Venus - Maxwell Montes and Cleopatra Crater (PIA00149)",
    url: "https://science.nasa.gov/photojournal/venus-maxwell-montes-and-cleopatra-crater/",
    institution: "NASA/JPL",
    review: reviewed(),
  },
  {
    id: "jpl-olympus-mons",
    title: "Olympus Mons in Color (PIA00993)",
    url: "https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/",
    institution: "NASA/JPL/Malin Space Science Systems",
    review: reviewed(),
  },
  {
    id: "usgs-olympus-position",
    title: "Gazetteer of Planetary Nomenclature: Olympus Mons (4453)",
    url: "https://planetarynames.wr.usgs.gov/Feature/4453",
    institution: "IAU / USGS Gazetteer of Planetary Nomenclature",
    review: reviewed(),
  },
  {
    id: "nasa-viking-1",
    title: "Viking 1",
    url: "https://science.nasa.gov/mission/viking-1/",
    institution: "NASA",
    review: reviewed(),
  },
  {
    id: "nasa-viking-image",
    title: "First Photograph Taken On Mars Surface (PIA00381)",
    url: "https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/",
    institution: "NASA/JPL",
    review: reviewed(),
  },
  {
    id: "nasa-jupiter-facts",
    title: "Jupiter Facts",
    url: "https://science.nasa.gov/jupiter/jupiter-facts/",
    institution: "NASA",
    review: reviewed(),
  },
  {
    id: "nasa-saturn-facts",
    title: "Saturn Facts",
    url: "https://science.nasa.gov/saturn/facts/",
    institution: "NASA",
    review: reviewed(),
  },
  {
    id: "nasa-uranus-facts",
    title: "Uranus Facts",
    url: "https://science.nasa.gov/uranus/facts/",
    institution: "NASA",
    review: reviewed(),
  },
  {
    id: "nasa-neptune-facts",
    title: "Neptune Facts",
    url: "https://science.nasa.gov/neptune/neptune-facts/",
    institution: "NASA",
    review: reviewed(),
  },
  {
    id: "unesco-beijing-axis",
    title: "Beijing Central Axis: World Heritage property 1714",
    url: "https://whc.unesco.org/en/list/1714/",
    institution: "UNESCO World Heritage Centre",
    review: reviewed(),
  },
  {
    id: "commons-beijing-axis",
    title: "Central Axis of Beijing, photograph by rheins (2012)",
    url: "https://commons.wikimedia.org/wiki/File:%E5%8C%97%E4%BA%AC%E4%B8%AD%E8%BD%B4%E7%BA%BF_-_Central_Axis_of_Beijing_-_2012.05_-_panoramio.jpg",
    institution: "rheins / Wikimedia Commons file record",
    review: reviewed(),
  },
];

export const assets: Asset[] = [
  {
    id: "asset-olympus-mons",
    path: "exploration/olympus-mons-pia00993.jpg",
    sourceUrl:
      "https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/",
    originalUrl:
      "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA00993.jpg",
    rightsUrl: "https://www.jpl.nasa.gov/jpl-image-use-policy/",
    license:
      "JPL educational/informational image-use policy; credit required; no endorsement",
    credit: "NASA/JPL/Malin Space Science Systems",
    date: "1997-10-20",
    location: {
      zh: "火星奥林帕斯山及周边，轨道相机向下拍摄。",
      en: "Olympus Mons and surroundings on Mars, viewed from orbit.",
    },
    role: "orbital-image",
    caption: {
      zh: "火星全球勘测者号 MOC 于 1997 年 10 月 20 日获取的奥林帕斯山影像，1998 年发布。不是地面照片或实时画面。",
      en: "Olympus Mons imaged by Mars Global Surveyor's MOC on October 20, 1997, and published in 1998. An orbital view, not a ground photograph or live feed.",
    },
    processing: {
      zh: "原发布彩色合成：红、蓝波段实测，绿色由两者合成；本地文件未裁剪、未重新着色。",
      en: "Published color composite: measured red/blue bands and a synthesized green band. No local crop or recoloring.",
    },
    aiGenerated: false,
    projection: "orbital-map",
    review: reviewed(),
  },
  {
    id: "asset-viking-1",
    path: "exploration/viking-1-pia00381.jpg",
    sourceUrl:
      "https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/",
    originalUrl:
      "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia00/pia00381/PIA00381.jpg?crop=faces%2Cfocalpoint&fit=clip&h=512&w=1439",
    rightsUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    license:
      "NASA educational/informational media-use guidelines; credit required; no endorsement",
    credit: "NASA/JPL",
    date: "1976-07-20",
    location: {
      zh: "火星克律塞平原，维京 1 号着陆器旁的地面。",
      en: "Ground beside Viking Lander 1 in Chryse Planitia, Mars.",
    },
    role: "event-record",
    caption: {
      zh: "维京 1 号于 1976 年 7 月 20 日着陆后获取的黑白地面照片（PIA00381）；右侧可见着陆器足垫。",
      en: "Black-and-white surface image PIA00381, taken after Viking 1 landed on July 20, 1976; a lander footpad is visible on the right.",
    },
    processing: {
      zh: "使用 NASA 页面提供的 JPEG 尺寸版本；未本地着色或拼接，不作 360° 全景。",
      en: "JPEG size variant supplied by NASA; no local colorization or stitching. Not a 360-degree panorama.",
    },
    aiGenerated: false,
    projection: "ordinary-photo",
    review: reviewed(),
  },
  {
    id: "asset-beijing-axis",
    path: "exploration/beijing-central-axis-2012.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:%E5%8C%97%E4%BA%AC%E4%B8%AD%E8%BD%B4%E7%BA%BF_-_Central_Axis_of_Beijing_-_2012.05_-_panoramio.jpg",
    originalUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a6/%E5%8C%97%E4%BA%AC%E4%B8%AD%E8%BD%B4%E7%BA%BF_-_Central_Axis_of_Beijing_-_2012.05_-_panoramio.jpg",
    rightsUrl: "https://creativecommons.org/licenses/by/3.0/",
    license: "CC BY 3.0",
    credit: "rheins / Wikimedia Commons / CC BY 3.0",
    date: "2012-05-08",
    location: {
      zh: "北京中轴线永定门一带；文件页面记录的摄影位置为约 39.87773°N、116.392756°E。",
      en: "Yongdingmen area of Beijing's Central Axis; the file record places the camera near 39.87773 N, 116.392756 E.",
    },
    role: "landmark-photo",
    caption: {
      zh: "rheins 于 2012 年 5 月 8 日拍摄的中轴线地标配图。不是 2024 年列入世界遗产名录的活动现场，也不是今天的实时景观。",
      en: "Central Axis landmark photograph by rheins, May 8, 2012. Illustrative site photo, not a record of the 2024 inscription decision or a current live view.",
    },
    processing: {
      zh: "Wikimedia 提供的 960 像素宽缩略版本；未本地裁剪、调色或合成。按普通照片展示。",
      en: "960-pixel-wide Wikimedia thumbnail; no local crop, recoloring, or compositing. Display as an ordinary photograph.",
    },
    aiGenerated: false,
    projection: "ordinary-photo",
    review: reviewed(),
  },
];

export const stories: Story[] = [
  {
    id: "story-olympus-orbital-view",
    title: {
      zh: "从轨道认识奥林帕斯山",
      en: "Reading Olympus Mons from orbit",
    },
    date: "1997-10-20",
    summary: {
      zh: "轨道相机帮助研究者观察火山轮廓、山顶和云层，而不是记录人类登山。",
      en: "An orbital camera reveals a volcanic outline, summit, and clouds, not a human expedition.",
    },
    body: {
      zh: "MOC 在这次轨道经过中拍摄了奥林帕斯山。1998 年图注记载，火山东西向范围接近 550 公里，山顶复合破火山口约为 66×83 公里；这些是水平尺寸，不是山高。图中的云与地形提供远程观测线索，没有人在此登山或着陆。",
      en: "MOC recorded this region during an orbital pass. The 1998 caption gives an east-west volcanic extent near 550 km and a summit caldera about 66 by 83 km. These are horizontal dimensions, not elevation. Terrain and clouds are evidence from remote observation, not a record of people climbing or landing here.",
    },
    topics: ["planetary-geology", "remote-observation"],
    links: [
      {
        destinationId: "mars-olympus-mons",
        relation: "remote-observation",
        description: {
          zh: "火星轨道相机观测该地貌；不是地面活动现场。",
          en: "An orbital camera observed this landform; no surface expedition is depicted.",
        },
      },
    ],
    sourceIds: ["jpl-olympus-mons"],
    assetIds: ["asset-olympus-mons"],
    review: reviewed(),
  },
  {
    id: "story-viking-1-landing",
    title: {
      zh: "1976：维京 1 号的地面探测",
      en: "1976: Viking 1 begins surface exploration",
    },
    date: "1976-07-20",
    summary: {
      zh: "无人着陆器抵达克律塞平原，用相机与科学仪器研究火星。",
      en: "An uncrewed lander reached Chryse Planitia to study Mars with cameras and instruments.",
    },
    body: {
      zh: "1976 年 7 月 20 日，维京 1 号安全着陆并拍摄周围地面。任务随后采集土壤、记录环境数据。1971 年火星 3 号着陆后很快失联，因此这里用任务名与日期区分里程碑，不称人类首次登陆。维京实验没有确证发现火星生命。",
      en: "Viking 1 landed safely on July 20, 1976 and imaged the surrounding ground. It later sampled soil and recorded environmental data. Mars 3 had landed in 1971 but lost contact shortly afterward, so this exhibit uses an explicit mission and date rather than an ambiguous first-landing claim. Viking did not establish that life exists on Mars.",
    },
    topics: ["space-exploration", "scientific-evidence"],
    links: [
      {
        destinationId: "mars-viking-1",
        relation: "event-at-site",
        description: {
          zh: "无人着陆与地面成像发生在该着陆点；地球任务控制中心不在火星。",
          en: "The uncrewed landing and surface imaging occurred here; mission control was on Earth.",
        },
      },
    ],
    sourceIds: ["nasa-viking-1", "nasa-viking-image"],
    assetIds: ["asset-viking-1"],
    review: reviewed(),
  },
  {
    id: "story-beijing-axis-heritage",
    title: {
      zh: "2024：中轴线的文化遗产保护",
      en: "2024: Recognizing the Central Axis heritage",
    },
    date: "2024",
    summary: {
      zh: "北京中轴线于 2024 年列入世界遗产名录，展示城市规划与文化延续。",
      en: "Inscribed in 2024, Beijing's Central Axis illustrates urban planning and cultural continuity.",
    },
    body: {
      zh: "中轴线贯穿北京老城南北，关联建筑、道路与城市空间。UNESCO 记载它于 2024 年列入世界遗产名录。这里选择文化保护主题，不把列名理解为某座地标当天新建。配图摄于 2012 年，只帮助观察地点，不代表列名决议现场，也不是完整城市历史。",
      en: "The Central Axis connects buildings, roads, and spaces through historic Beijing from north to south. UNESCO records its 2024 World Heritage inscription. This exhibit focuses on conservation, not a claim that a landmark was newly built that year. The 2012 photograph illustrates the site, not the inscription decision or the city's entire history.",
    },
    topics: ["cultural-heritage", "urban-planning"],
    links: [
      {
        destinationId: "earth-beijing-central-axis",
        relation: "topic-related",
        description: {
          zh: "列名与该遗产地相关；不将照片中的地点标成委员会决议现场。",
          en: "The inscription concerns this heritage property; the photographed site is not labeled as the decision venue.",
        },
      },
    ],
    sourceIds: ["unesco-beijing-axis", "commons-beijing-axis"],
    assetIds: ["asset-beijing-axis"],
    review: reviewed(),
  },
];

export const destinations: Destination[] = [
  {
    id: "mercury-caloris",
    bodyId: "mercury",
    kind: "natural-region",
    name: { zh: "卡洛里盆地", en: "Caloris Basin" },
    summary: {
      zh: "水星的大型撞击盆地；图文与图片许可待录入。",
      en: "A large impact basin on Mercury; stories and licensed imagery are pending.",
    },
    locationDescription: {
      zh: "水星表面；精确标记尚待坐标核验。",
      en: "Mercury's surface; marker coordinates remain unverified.",
    },
    approach: "surface",
    storyIds: [],
    assetIds: [],
    sourceIds: ["nasa-mercury-facts"],
    status: "draft",
    review: pending(),
  },
  {
    id: "venus-maxwell-montes",
    bodyId: "venus",
    kind: "natural-region",
    name: { zh: "麦克斯韦山脉", en: "Maxwell Montes" },
    summary: {
      zh: "金星的山地雷达观测主题；不是可见光地面摄影。",
      en: "A Venus mountain region studied with radar, not visible-light ground photography.",
    },
    locationDescription: {
      zh: "金星北半球；图文包待编审。",
      en: "Northern hemisphere of Venus; the exhibit is pending review.",
    },
    approach: "surface",
    storyIds: [],
    assetIds: [],
    sourceIds: ["nasa-maxwell-montes"],
    status: "draft",
    review: pending(),
  },
  {
    id: "earth-beijing-central-axis",
    bodyId: "earth",
    cityId: "city-beijing",
    kind: "city",
    name: { zh: "北京 · 中轴线", en: "Beijing · Central Axis" },
    summary: {
      zh: "从南北轴线认识城市空间与文化遗产保护。",
      en: "Explore urban space and conservation along a north-south axis.",
    },
    position: {
      latitude: 39.907222,
      longitude: 116.391389,
      coordinateSystem: "WGS84",
      exact: false,
      description: {
        zh: "UNESCO 遗产条目的代表位置；不是整条轴线边界、相机位置或事件会场。",
        en: "Representative location from UNESCO, not a property boundary, camera location, or event venue.",
      },
      sourceIds: ["unesco-beijing-axis"],
    },
    locationDescription: {
      zh: "北京老城南北向中轴线，采用城市/遗产区域级定位。",
      en: "The north-south axis through historic Beijing; a city/heritage-area location.",
    },
    approach: "atmosphere",
    storyIds: ["story-beijing-axis-heritage"],
    assetIds: ["asset-beijing-axis"],
    sourceIds: ["unesco-beijing-axis"],
    status: "ready",
    review: reviewed(),
  },
  {
    id: "mars-olympus-mons",
    bodyId: "mars",
    kind: "natural-region",
    name: { zh: "奥林帕斯山", en: "Olympus Mons" },
    summary: {
      zh: "通过轨道影像认识火星大型火山与山顶地形。",
      en: "Study a major Martian volcano and its summit through orbital imagery.",
    },
    position: {
      latitude: 18.65,
      longitude: -133.8,
      coordinateSystem: "planetocentric-east",
      exact: false,
      description: {
        zh: "USGS 条目所列的一组区域中心为 18.65°N、226.20°E，换算为 -133.80°；目录还列有不同控制网结果。这里只用作区域示意，不是着陆点或边界。",
        en: "One regional center listed by USGS is 18.65 N, 226.20 E, converted to -133.80 longitude. Other control-network entries differ. This is a regional marker, not a landing point or boundary.",
      },
      sourceIds: ["usgs-olympus-position"],
    },
    locationDescription: {
      zh: "火星塔尔西斯火山区；以 USGS 所列区域中心作示意定位。",
      en: "The Tharsis volcanic region on Mars, located using an illustrative USGS regional center.",
    },
    approach: "surface",
    storyIds: ["story-olympus-orbital-view"],
    assetIds: ["asset-olympus-mons"],
    sourceIds: ["jpl-olympus-mons", "usgs-olympus-position"],
    status: "ready",
    review: reviewed(),
  },
  {
    id: "mars-viking-1",
    bodyId: "mars",
    kind: "landing-site",
    name: { zh: "维京 1 号着陆点", en: "Viking 1 landing site" },
    summary: {
      zh: "1976 年无人着陆与长期科学探测的任务地点。",
      en: "The site of an uncrewed 1976 landing and continuing scientific work.",
    },
    position: {
      latitude: 22.483,
      longitude: -47.94,
      coordinateSystem: "source-unspecified-east",
      exact: false,
      description: {
        zh: "NASA 任务页面给出 22.483°N、47.94°W，已换为东经正值约定；原页面未声明纬度基准，只作示意标记，不用作导航坐标。",
        en: "NASA reports 22.483 N, 47.94 W, converted to positive-east longitude. Latitude datum is unspecified; use only as an illustrative marker, not navigation coordinates.",
      },
      sourceIds: ["nasa-viking-1"],
    },
    locationDescription: {
      zh: "火星克律塞平原西部；NASA 页面坐标仅用于位置示意。",
      en: "Western Chryse Planitia, Mars; NASA's listed coordinates are used illustratively.",
    },
    approach: "surface",
    storyIds: ["story-viking-1-landing"],
    assetIds: ["asset-viking-1"],
    sourceIds: ["nasa-viking-1"],
    status: "ready",
    review: reviewed(),
  },
  {
    id: "jupiter-great-red-spot",
    bodyId: "jupiter",
    kind: "observation",
    name: { zh: "大红斑", en: "Great Red Spot" },
    summary: {
      zh: "木星大气中的风暴观察主题，不是地表着陆点。",
      en: "Observe a storm in Jupiter's atmosphere, not a surface landing site.",
    },
    locationDescription: {
      zh: "木星云层；风暴变化，不设固定地面坐标。",
      en: "Jupiter's clouds; a changing storm, not a fixed ground coordinate.",
    },
    approach: "observation",
    storyIds: [],
    assetIds: [],
    sourceIds: ["nasa-jupiter-facts"],
    status: "draft",
    review: pending(),
  },
  {
    id: "saturn-rings",
    bodyId: "saturn",
    kind: "observation",
    name: { zh: "土星环", en: "Saturn's rings" },
    summary: {
      zh: "由冰与岩石颗粒构成的环系统，不是可步行的平台。",
      en: "A system of icy and rocky particles, not a platform to walk on.",
    },
    locationDescription: {
      zh: "土星周围轨道区域；不采用地表经纬度。",
      en: "Orbital regions around Saturn; surface latitude/longitude does not apply.",
    },
    approach: "observation",
    storyIds: [],
    assetIds: [],
    sourceIds: ["nasa-saturn-facts"],
    status: "draft",
    review: pending(),
  },
  {
    id: "uranus-rings",
    bodyId: "uranus",
    kind: "observation",
    name: { zh: "天王星环", en: "Uranus's rings" },
    summary: {
      zh: "天王星的暗淡行星环；探测图文与素材仍待准备。",
      en: "Uranus's faint ring system; the illustrated exhibit is still pending.",
    },
    locationDescription: {
      zh: "天王星周围轨道区域，不是地表目的地。",
      en: "Orbital regions around Uranus, not a surface destination.",
    },
    approach: "observation",
    storyIds: [],
    assetIds: [],
    sourceIds: ["nasa-uranus-facts"],
    status: "draft",
    review: pending(),
  },
  {
    id: "neptune-great-dark-spot-1989",
    bodyId: "neptune",
    kind: "observation",
    name: { zh: "1989 年大暗斑观测", en: "The Great Dark Spot in 1989" },
    summary: {
      zh: "旅行者 2 号时期的风暴观测主题；该风暴后来消失，不是当前实时地标。",
      en: "A Voyager-era storm observation; that storm later disappeared and is not a current live landmark.",
    },
    locationDescription: {
      zh: "1989 年海王星南半球大气；不虚构当前固定坐标。",
      en: "Neptune's southern atmosphere in 1989; no current fixed coordinate is invented.",
    },
    approach: "observation",
    storyIds: [],
    assetIds: [],
    sourceIds: ["nasa-neptune-facts"],
    status: "draft",
    review: pending(),
  },
];

export const contentPack = contentPackManifest as ContentPack;
export const contentPacks: ContentPack[] = [contentPack];

export const explorationContent: ExplorationContent = {
  version: "2026-10-04-v3-batch-1",
  destinations,
  stories,
  assets,
  sources,
  contentPacks,
};

export function getDestinations(bodyId: Destination["bodyId"]): Destination[] {
  return destinations.filter((destination) => destination.bodyId === bodyId);
}

export function getDestination(id: string): Destination | undefined {
  return destinations.find((destination) => destination.id === id);
}
