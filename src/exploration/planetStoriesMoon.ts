import type { LocalizedText } from "./contentTypes";
import type { ImmersiveHotspotImage } from "./immersiveCatalog";
import type { PlanetStory } from "./planetStoryTypes";

const text = (zh: string, en: string): LocalizedText => ({ zh, en });
const resource = (slug: string) => `https://science.nasa.gov/resource/${slug}/`;
const photojournal = (slug: string) =>
  `https://science.nasa.gov/photojournal/${slug}/`;
const feature = (id: number) =>
  `https://planetarynames.wr.usgs.gov/Feature/${id}`;
const nasaPolicy = "https://www.nasa.gov/nasa-brand-center/images-and-media/";
const lrocPolicy = "https://lroc.im-ldi.com/about/terms";
const jplPolicy = "https://www.jpl.nasa.gov/jpl-image-use-policy/";
const lrocCredit = "NASA/GSFC/Arizona State University";
const noLocalEdits = text(
  "保留官方提供的图像字节；未在本地裁剪、调色、生成或增强地形。图像像素数不等同于地面分辨率。",
  "Official image bytes retained without local cropping, recoloring, generation or terrain enhancement. Image dimensions are not ground resolution.",
);
const officialSmallVariant = text(
  "使用 NASA 官方等比例长边 1280 像素版本；未在本地裁剪、调色或添加细节。此显示版本的像素数不代表原始观测精度。",
  "NASA's official proportional 1280-pixel longest-edge variant; no local crop, recoloring or invented detail. Display dimensions do not represent original observing resolution.",
);

function picture(
  filename: string,
  sourceUrl: string,
  credit: string,
  date: string,
  caption: LocalizedText,
  processing = noLocalEdits,
  rights: "nasa" | "lroc" | "jpl" = "lroc",
): ImmersiveHotspotImage {
  return {
    path: `exploration/planets/moon/${filename}`,
    sourceUrl,
    credit,
    date,
    caption,
    processing,
    license:
      rights === "lroc"
        ? "Copyrighted LROC curated image; credited educational use permitted; commercial reuse requires prior permission; not a public-domain claim"
        : rights === "jpl"
          ? "NASA/JPL educational/informational reuse with credit; no endorsement; third-party rights not cleared"
          : "NASA educational/informational image reuse; credit required; no endorsement; employee/insignia promotional rights not cleared",
    licenseUrl:
      rights === "lroc"
        ? lrocPolicy
        : rights === "jpl"
          ? jplPolicy
          : nasaPolicy,
  };
}

type MoonSpec = Pick<
  PlanetStory,
  | "id"
  | "name"
  | "latitude"
  | "longitude"
  | "coordinateNote"
  | "introduction"
  | "gallery"
  | "events"
  | "sourceUrls"
>;

function region(spec: MoonSpec): PlanetStory {
  return {
    ...spec,
    bodyId: "moon",
    anchorKind: "surface",
    coordinateAccuracy: "approximate",
    summary: spec.introduction,
    paragraphs: spec.events.map((event) => event.description),
    date: spec.events[0].date,
    sectionTitle: text("科学与探月历程", "Lunar Science and Exploration"),
    relation: text(
      "这是月球科普入口，不是着陆导航或近景地形重建。地表照片、后期轨道观测及拼接影像分别注明时间与关系；后期影像不是历史事件发生瞬间。资料已核对来源，仍待人工复核。",
      "An educational lunar anchor, not landing navigation or reconstructed close-up terrain. Surface photographs, later orbital observations and mosaics identify their dates and relationships; later images do not depict the instant of a historical milestone. Sources checked; human review remains pending.",
    ),
    image: spec.gallery[0],
    humanReview: "pending",
  };
}

const apolloPhoto = resource("apollo-11-buzz-aldrin");
const apolloLro = photojournal("apollo-11-second-look");
const apolloHistory = "https://www.nasa.gov/mission/apollo-11/";
const apolloCoordinates =
  "https://history.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html";
const rangerSource = resource(
  "sabine-crater-in-mare-tranquillitatis-on-the-moon",
);
const ridgeSource = photojournal(
  "constellation-region-of-interest-at-mare-tranquillitatis",
);
const tychoSource = resource("tycho-craters-central-peak-on-the-moon");
const copernicusOrbiter = photojournal("limb-of-copernicus-impact-crater");
const copernicusPeak = resource(
  "copernicus-central-peak-another-layered-target",
);
const poleLro = photojournal("the-lunar-south-pole");
const poleClementine = photojournal(
  "south-pole-region-of-the-moon-as-seen-by-clementine",
);
const lcrossSource = "https://science.nasa.gov/mission/lcross/";
const changeFirstLook = resource("first-look-change-4");
const changeRover = "https://lroc.im-ldi.com/images/1091";
const moonMissions = "https://science.nasa.gov/moon/missions/";

export const moonPlanetStories: PlanetStory[] = [
  region({
    id: "region-moon-apollo-11",
    name: text("阿波罗11号着陆区", "Apollo 11 Landing Site"),
    latitude: 0.67409,
    longitude: 23.47298,
    coordinateNote: text(
      "采用 NASA Apollo Lunar Surface Journal 的 0.67409°N、23.47298°E。是静海基地的区域锚点，与宁静海整体中心分开；非导航精度，未验证与显示纹理逐像素配准。",
      "NASA Apollo Lunar Surface Journal coordinates: 0.67409°N, 23.47298°E. An anchor for Tranquility Base, distinct from the center of Mare Tranquillitatis; not navigation-grade, with pixel-level texture registration unverified.",
    ),
    introduction: text(
      "静海基地位于宁静海西南部。1969年7月20日，阿波罗11号的鹰号登月舱在这里完成首次载人月球着陆；宇航员采集样品并部署科学实验。",
      "Tranquility Base lies in southwestern Mare Tranquillitatis. On July 20, 1969, Apollo 11's Eagle made the first crewed lunar landing here. The astronauts collected samples and deployed scientific experiments.",
    ),
    gallery: [
      picture(
        "apollo11-aldrin-as11-40-5902.jpg",
        apolloPhoto,
        "NASA / Neil Armstrong · AS11-40-5902",
        "1969-07",
        text(
          "阿姆斯特朗拍摄的奥尔德林与鹰号登月舱支腿，AS11-40-5902；是1969年7月阿波罗11号月面活动照片。来源页面用着陆日标注整项任务，这里不将其误当成照片精确 UTC 时间。",
          "Armstrong's photograph of Aldrin beside an Eagle landing leg, AS11-40-5902, during Apollo 11's July 1969 surface activity. The source labels the mission's landing day; this is not asserted as an exact UTC exposure time.",
        ),
        officialSmallVariant,
        "nasa",
      ),
      picture(
        "apollo11-lro-pia12909.jpg",
        apolloLro,
        `${lrocCredit} · PIA12909`,
        "2009-09-29",
        text(
          "PIA12909：LRO 再次观测静海基地的轨道影像，NASA于2009-09-29发布；不是1969年着陆瞬间，来源未列单幅影像的采集日。标记与刻度保留完整。",
          "PIA12909: LRO's second view of Tranquility Base, released September 29, 2009. Not the 1969 landing moment; the source gives no individual acquisition day. Original annotations and scale retained.",
        ),
      ),
    ],
    events: [
      {
        id: "moon-apollo11-crewed-landing",
        title: text("首次载人月球着陆", "The First Crewed Lunar Landing"),
        date: "1969-07-20",
        description: text(
          "尼尔·阿姆斯特朗和巴兹·奥尔德林乘鹰号在宁静海着陆，迈克尔·柯林斯留在月球轨道。这个“首次”指人类载人月球着陆，不是首次无人探测。左侧照片记录随后开展的月面活动。",
          "Neil Armstrong and Buzz Aldrin landed in Eagle while Michael Collins remained in lunar orbit. This first refers to a crewed lunar landing, not robotic exploration. The photograph records the subsequent surface activity.",
        ),
        sourceUrls: [apolloHistory, apolloPhoto],
        imageIndices: [0],
      },
      {
        id: "moon-apollo11-lro-follow-up",
        title: text(
          "轨道探测重访静海基地",
          "An Orbiter Revisits Tranquility Base",
        ),
        date: "2009-09-29",
        description: text(
          "LRO在不同太阳高度下再次观察同一遗址。阴影变短后，月面亮度差异更加明显，帮助比较登月舱下降级及周边扰动痕迹；这是后期资料发布，不是新的登月。",
          "LRO observed the same site under a higher Sun. Shorter shadows reveal surface-brightness differences useful for examining the descent stage and disturbed ground. This is a later observation's release, not another landing.",
        ),
        sourceUrls: [apolloLro],
        imageIndices: [1],
      },
    ],
    sourceUrls: [apolloCoordinates, apolloHistory, apolloPhoto, apolloLro],
  }),
  region({
    id: "region-moon-mare-tranquillitatis",
    name: text("宁静海", "Mare Tranquillitatis"),
    latitude: 8.35,
    longitude: 30.83,
    coordinateNote: text(
      "USGS Feature 3691 的当前区域中心为8.35°N、30.83°E；不是阿波罗11号坐标。区域内图像可以展示西南部或局部皱脊，不能将整片月海缩成单个着陆点。纹理配准未逐像素验证。",
      "Current regional center from USGS Feature 3691: 8.35°N, 30.83°E, not Apollo 11's coordinates. Images show southwestern terrain or local wrinkle ridges within the mare, not one landing point representing the whole region. Pixel-level registration unverified.",
    ),
    introduction: text(
      "宁静海的“海”不是水域，而是古老玄武岩熔岩形成的暗色平原。探测影像中的撞击坑、皱脊和明暗差异，让我们理解月球火山与撞击活动。",
      "This lunar sea contains no ocean: its dark plains formed from ancient basaltic lava. Craters, wrinkle ridges and brightness contrasts in spacecraft imagery reveal volcanic and impact history.",
    ),
    gallery: [
      picture(
        "tranquillitatis-ranger8-b045.jpg",
        rangerSource,
        "NASA · Ranger 8 B045",
        "1965-02-20",
        text(
          "Ranger 8 B045：1965-02-20距月面约511千米时拍摄，画面约95千米宽；左上为萨宾陨石坑，属于宁静海西南部。阿波罗11号着陆点约在画面右侧30千米外，不在此图中。",
          "Ranger 8 B045, acquired February 20, 1965 from about 511 km altitude; roughly 95 km across. Sabine crater is upper left in southwestern Mare Tranquillitatis. Apollo 11's site lies about 30 km to the right, outside this frame.",
        ),
        noLocalEdits,
        "nasa",
      ),
      picture(
        "tranquillitatis-ridge-pia13079.jpg",
        ridgeSource,
        `${lrocCredit} · PIA13079`,
        "2010-04-27",
        text(
          "PIA13079：宁静海玄武岩平原中的皱脊近景，覆盖约1.25千米宽；NASA于2010-04-27发布，非单幅采集日期。它是月海内部的局部轨道照片，不是整片宁静海或阿波罗遗址。",
          "PIA13079: a wrinkle ridge in Mare Tranquillitatis basalt plains, about 1.25 km across. Released April 27, 2010; not an individual acquisition date. A local orbital view within the mare, not the whole mare or Apollo site.",
        ),
      ),
    ],
    events: [
      {
        id: "moon-tranquillitatis-ranger-survey",
        title: text("无人影像探测月海", "Robotic Imaging of a Lunar Mare"),
        date: "1965-02-20",
        description: text(
          "Ranger 8在撞击月面前传回照片，记录平原、撞击坑和线状构造。画面揭示宁静海并非平滑无物的平板，而是具有丰富地质结构的岩石区域。",
          "Before its planned impact, Ranger 8 returned views of plains, craters and linear features. They show that Mare Tranquillitatis is a rocky geological landscape, not a featureless flat sheet.",
        ),
        sourceUrls: [rangerSource],
        imageIndices: [0],
      },
      {
        id: "moon-tranquillitatis-wrinkle-ridge",
        title: text("从皱脊观察月面变化", "Reading Wrinkle Ridges"),
        date: "2010-04-27",
        description: text(
          "LRO影像展示古老玄武岩平原受压变形产生的皱脊；陡坡上较亮的区域暴露了更少经受太空风化的材料。日期表示这张教育影像的发布日，不是皱脊形成时间。",
          "LRO shows a wrinkle ridge formed as basalt plains buckled. Brighter steep slopes expose less space-weathered material. The date is this educational image's release, not the time the ridge formed.",
        ),
        sourceUrls: [ridgeSource],
        imageIndices: [1],
      },
    ],
    sourceUrls: [feature(3691), rangerSource, ridgeSource],
  }),
  region({
    id: "region-moon-tycho",
    name: text("第谷陨石坑", "Tycho Crater"),
    latitude: -43.3,
    longitude: -11.22,
    coordinateNote: text(
      "采用USGS Feature 6163当前中心43.30°S、11.22°W；NASA旧资料另列43.37°S、348.68°E，不混用两个控制网的数值。仅区域级锚点，纹理配准未逐像素验证。",
      "Current USGS Feature 6163 center: 43.30°S, 11.22°W. Older NASA material lists 43.37°S, 348.68°E; values from different control networks are not mixed. Regional anchor; pixel-level registration unverified.",
    ),
    introduction: text(
      "第谷位于月球南部高地，具有明显的辐射纹、阶梯状坑壁和中央峰。撞击后岩石反弹及熔融物冷却留下的结构，是理解复杂撞击坑的重要样本。",
      "Tycho in the southern highlands displays bright rays, terraced walls and a central peak. Rebounding rock and cooled impact melt make it an instructive example of complex-crater formation.",
    ),
    gallery: [
      picture(
        "tycho-central-peak-lro.jpg",
        tychoSource,
        lrocCredit,
        "2011-06-10",
        text(
          "LRO于2011-06-10拍摄的第谷中央峰斜视照片，峰群横跨约15千米；低角度阳光突出山体和阴影。这是轨道照片，不是人在坑内拍摄或本地生成地形。",
          "LRO oblique view of Tycho's central peaks acquired June 10, 2011; the peak complex spans about 15 km. Low sunlight emphasizes relief and shadows. An orbital photograph, not a ground photograph or locally generated terrain.",
        ),
      ),
      picture(
        "tycho-wac-mosaic-lro.jpg",
        tychoSource,
        lrocCredit,
        "2019-01-30",
        text(
          "NASA说明页中的LRO广角相机第谷俯视拼接图，北向上、约130千米宽。日期为2019-01-30说明页发布时间；来源未给这幅拼接图统一的采集日。",
          "LRO wide-angle mosaic of Tycho from NASA's explanation page, north up and about 130 km across. January 30, 2019 is the page's publication date; no single acquisition day is supplied for this mosaic.",
        ),
        text(
          "官方多幅轨道影像拼接；未本地裁剪、改色或增强。拼接图与斜视照片不是同一视角或同一次快门。",
          "Official orbital-image mosaic, without local cropping, recoloring or enhancement. It is not the same view or exposure as the oblique photograph.",
        ),
      ),
    ],
    events: [
      {
        id: "moon-tycho-lro-morphology",
        title: text(
          "从中央峰认识撞击过程",
          "Learning Impact Mechanics from a Central Peak",
        ),
        date: "2011-06-10",
        description: text(
          "中央峰是大型撞击后岩石快速回弹形成的结构。LRO的斜视照片与俯视拼接图从不同尺度展示中央峰、坑底及坑壁；地貌形成远早于拍摄日期，不把观测日期写成撞击日期。",
          "The central peak formed when rock rebounded after a large impact. LRO's oblique view and overhead mosaic show peaks, floor and walls at different scales. Formation predates the photographs; an observing date is not an impact date.",
        ),
        sourceUrls: [tychoSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [feature(6163), tychoSource],
  }),
  region({
    id: "region-moon-copernicus",
    name: text("哥白尼陨石坑", "Copernicus Crater"),
    latitude: 9.62,
    longitude: -20.08,
    coordinateNote: text(
      "USGS Feature 1296当前中心为9.62°N、20.08°W。是陨石坑区域中心，不是中央峰顶的单点；旧照片说明中的近似10°N、20°W只用于说明，不混作新精确值。纹理配准未逐像素验证。",
      "Current USGS Feature 1296 center: 9.62°N, 20.08°W. A crater-region center, not a surveyed summit. Older captions' approximate 10°N, 20°W are not mixed into a new precise pair. Pixel-level registration unverified.",
    ),
    introduction: text(
      "哥白尼是月球正面著名的复杂撞击坑。中央峰、坑壁阶地和向外散布的喷出物，使它成为从影像学习撞击地质的清晰范例。",
      "Copernicus is a prominent complex crater on the lunar nearside. Its central peaks, wall terraces and surrounding ejecta provide a clear example for learning impact geology from spacecraft images.",
    ),
    gallery: [
      picture(
        "copernicus-orbiter-pia00094.jpg",
        copernicusOrbiter,
        "NASA/JPL/USGS · PIA00094",
        "1998-06-03",
        text(
          "PIA00094：Lunar Orbiter的哥白尼陨石坑斜视影像，显示坑底、中央隆起、坑缘与喷出物。1998-06-03为NASA入库日期，不是1960年代任务的曝光日期。",
          "PIA00094: Lunar Orbiter's oblique view of Copernicus, showing floor, peaks, rim and ejecta. June 3, 1998 is NASA's image-addition date, not the exposure date of the 1960s mission.",
        ),
        noLocalEdits,
        "jpl",
      ),
      picture(
        "copernicus-central-peak-lro.png",
        copernicusPeak,
        lrocCredit,
        "2018-10-08",
        text(
          "LRO的哥白尼中央峰照片，画面约3千米宽，显示层状结构与亮度差异；NASA于2018-10-08发布，来源未列精确采集日。不是整个陨石坑的全景。",
          "LRO view of Copernicus's central peaks, about 3 km across, showing layering and brightness variations. Published October 8, 2018; no exact acquisition day supplied. Not a panorama of the whole crater.",
        ),
      ),
    ],
    events: [
      {
        id: "moon-copernicus-orbital-geology",
        title: text(
          "跨任务观察同一撞击坑",
          "Comparing a Crater Across Missions",
        ),
        date: "2018-10-08",
        description: text(
          "Lunar Orbiter影像展示坑缘和喷出物，后来的LRO影像将观察集中到中央峰中的层状岩石。两张照片对应同一陨石坑的不同尺度与年代；日期为LRO资料发布，不暗示2018年才形成陨石坑。",
          "Lunar Orbiter shows the rim and ejecta; later LRO imaging focuses on layered central-peak rock. These are different scales and epochs of the same crater. The date marks the LRO release, not crater formation in 2018.",
        ),
        sourceUrls: [copernicusOrbiter, copernicusPeak],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [feature(1296), copernicusOrbiter, copernicusPeak],
  }),
  region({
    id: "region-moon-south-pole",
    name: text("月球南极", "Lunar South Pole"),
    latitude: -90,
    longitude: 0,
    coordinateNote: text(
      "使用几何南极90°S作为整个极区的教育锚点；经度0°只是极点坐标约定，南极上所有经度交汇。不是Cabeus撞击点、沙克尔顿坑中心或任何载人着陆点。",
      "The geographic pole at 90°S anchors the broad polar region; 0° longitude is only a convention because all meridians meet there. Not the Cabeus impact point, Shackleton center or a crewed landing site.",
    ),
    introduction: text(
      "月球南极具有低角度日照、复杂地形和永久阴影区。无人轨道测绘与撞击探测帮助研究极区环境及水冰，不能把阴影坑描述成遍布液态湖泊。",
      "The lunar south pole combines low-angle sunlight, rugged terrain and permanently shadowed areas. Robotic mapping and impact experiments investigate its environment and ice; shadowed craters are not liquid-water lakes.",
    ),
    gallery: [
      picture(
        "south-pole-lro-pia13523.jpg",
        poleLro,
        `${lrocCredit} · PIA13523`,
        "2010-09-27",
        text(
          "PIA13523：LRO广角相机南极区拼接影像，覆盖约600千米宽。2010-09-27为NASA入库日期，非单次快门日期；不是地面照片或水冰的直接可见光特写。",
          "PIA13523: LRO wide-angle mosaic of the south polar region, about 600 km across. September 27, 2010 is NASA's image-addition date, not one exposure. Not a ground photograph or a visible-light close-up of ice.",
        ),
      ),
      picture(
        "south-pole-clementine-pia00001.jpg",
        poleClementine,
        "NASA/JPL/USGS · PIA00001",
        "1996-06-03",
        text(
          "PIA00001：约1500幅Clementine影像组成的南极正射拼接图。NASA于1996-06-03入库，原始任务在1994年进行；不是1996年的新着陆。右下的薛定谔盆地提供区域参照。",
          "PIA00001: orthographic south-pole mosaic assembled from about 1,500 Clementine images. Added June 3, 1996 from the 1994 mission, not a new landing in 1996. Schrödinger basin at lower right provides regional context.",
        ),
        officialSmallVariant,
        "jpl",
      ),
    ],
    events: [
      {
        id: "moon-south-pole-robotic-science",
        title: text(
          "无人测绘与极区水冰研究",
          "Robotic Mapping and Polar-Ice Research",
        ),
        date: "2009-10-09",
        description: text(
          "LCROSS及其Centaur级按计划撞击南极附近Cabeus陨石坑，分析溅起的物质并获得水冰证据。图库提供Clementine和LRO的极区环境影像，不是LCROSS撞击瞬间，也不代表人类已在南极着陆。",
          "LCROSS and its Centaur stage deliberately impacted Cabeus near the south pole and analyzed ejecta for evidence of water ice. The gallery supplies Clementine and LRO regional context, not the impact instant or evidence of a human landing at the pole.",
        ),
        sourceUrls: [lcrossSource, poleLro, poleClementine],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [poleLro, poleClementine, lcrossSource],
  }),
  region({
    id: "region-moon-change-4",
    name: text(
      "嫦娥四号着陆区·天河基地",
      "Chang'e 4 Landing Site · Statio Tianhe",
    ),
    latitude: -45.45,
    longitude: 177.6,
    coordinateNote: text(
      "采用USGS Feature 15781/LOLA 2011的天河基地近似坐标45.45°S、177.60°E，对应冯·卡门陨石坑内嫦娥四号着陆点。不是整片南极—艾特肯盆地或几何南极；未做导航级或纹理逐像素配准。",
      "USGS Feature 15781 / LOLA 2011 approximate Statio Tianhe coordinates: 45.45°S, 177.60°E, for Chang'e 4 inside Von Kármán crater. Not the entire South Pole–Aitken basin or geographic pole; neither navigation-grade nor pixel-registered.",
    ),
    introduction: text(
      "2019年1月3日，嫦娥四号在月球背面的冯·卡门陨石坑内完成首次无人探测器月球背面软着陆，并部署玉兔二号。天河基地是可明确定位的真实着陆区，不是含糊的“嫦娥区域”。",
      "On January 3, 2019, Chang'e 4 made the first robotic soft landing on the lunar farside inside Von Kármán crater and deployed Yutu-2. Statio Tianhe identifies an actual landing area, not a vague Chang'e region.",
    ),
    gallery: [
      picture(
        "change4-first-look-lro.png",
        changeFirstLook,
        lrocCredit,
        "2019-01-30",
        text(
          "LRO于2019-01-30斜视嫦娥四号着陆区；箭头间的亮点只有约两个原始像素，玉兔二号在这张图中不可分辨。背景是冯·卡门陨石坑西侧坑壁，不是月面相机近景。",
          "LRO's January 30, 2019 oblique view of the Chang'e 4 site. The lander between arrows spans only about two native pixels; Yutu-2 is not resolved here. The background is Von Kármán's western wall, not a surface-camera close-up.",
        ),
        text(
          "保留官方标箭头图；源图局部已放大两倍。放大没有新增地面细节；本地未生成或锐化。",
          "Official annotated image retained; the source includes a twofold enlargement. Enlargement adds no ground detail; no local generation or sharpening.",
        ),
      ),
      picture(
        "change4-lander-rover-lro.png",
        changeRover,
        `${lrocCredit} · M1303570617LR`,
        "2019-01-31",
        text(
          "2019-01-31 LROC NAC再次拍摄：箭头分别标出着陆器与玉兔二号，北向右上；玉兔二号仅约两个原始像素。这是着陆后约四周的轨道观察，不是1月3日落月照片。",
          "LROC NAC's January 31, 2019 observation: arrows identify the lander and Yutu-2, north toward upper right. The rover spans only about two native pixels. Orbital follow-up four weeks after landing, not a January 3 touchdown photograph.",
        ),
        text(
          "LROC官方四倍放大、裁切及箭头注释的发布图原样保留。像素块反映原始分辨率限制；未用AI补充探测器近景。",
          "LROC's published fourfold enlargement, crop and arrows retained as delivered. Blocky pixels reflect native resolution limits; no AI-generated vehicle close-up.",
        ),
      ),
    ],
    events: [
      {
        id: "moon-change4-farside-soft-landing",
        title: text(
          "首次无人月球背面软着陆",
          "The First Robotic Soft Landing on the Lunar Farside",
        ),
        date: "2019-01-03",
        description: text(
          "嫦娥四号与玉兔二号在冯·卡门陨石坑开展月面科学探测，借助鹊桥中继通信。“首次”限定于月球背面的无人软着陆，不是首次月球着陆，也不是载人登月。两张图库照片是NASA/LROC后期轨道观察。",
          "Chang'e 4 and Yutu-2 conducted surface science inside Von Kármán, communicating through the Queqiao relay. This first is a robotic soft landing on the lunar farside, not the first lunar landing or a crewed mission. Both gallery images are later NASA/LROC orbital observations.",
        ),
        sourceUrls: [moonMissions, changeFirstLook, changeRover],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [feature(15781), moonMissions, changeFirstLook, changeRover],
  }),
];
