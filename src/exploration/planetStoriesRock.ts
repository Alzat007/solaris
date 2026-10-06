import type { LocalizedText } from "./contentTypes";
import {
  getImmersiveSite,
  type ImmersiveHotspotImage,
} from "./immersiveCatalog";
import type { PlanetStory } from "./planetStoryTypes";

const text = (zh: string, en: string): LocalizedText => ({ zh, en });
const nasa = (slug: string) => `https://science.nasa.gov/photojournal/${slug}/`;
const jplPolicy = "https://www.jpl.nasa.gov/jpl-image-use-policy/";
const messengerCredit =
  "NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington";
const officialSizeVariants = new Set([
  "mercury-caloris-pia13675.jpg",
  "mercury-raditladi-pia19409.jpg",
  "venus-maxwell-radar-pia00149.jpg",
  "venus-maxwell-perspective-pia00316.jpg",
  "venus-maat-perspective-pia00106.jpg",
  "venus-maat-perspective-pia00254.jpg",
  "venus-aphrodite-ovda-pia00146.jpg",
  "venus-alpha-radar-pia00147.jpg",
  "venus-alpha-perspective-pia00481.jpg",
  "mars-valles-mosaic-pia00422.jpg",
  "mars-valles-clouds-pia00991.jpg",
]);

function picture(
  filename: string,
  sourceUrl: string,
  credit: string,
  date: string,
  caption: LocalizedText,
  processing: LocalizedText,
): ImmersiveHotspotImage {
  return {
    path: `exploration/planets/rock/${filename}`,
    sourceUrl,
    credit,
    date,
    caption,
    processing: officialSizeVariants.has(filename)
      ? text(
          `${processing.zh} 使用 NASA 官方等比例长边 1280 像素版本，降低图像解码内存；源数据精度不等于此显示版本的分辨率。`,
          `${processing.en} Uses NASA's official proportional 1280-pixel longest-edge size variant to reduce decoding memory; source-data resolution is not this display variant's resolution.`,
        )
      : processing,
    license:
      "NASA/JPL educational/informational image reuse; attribution required; no endorsement; third-party commercial rights not cleared",
    licenseUrl: jplPolicy,
  };
}

function reviewedLegacyImage(siteId: string): ImmersiveHotspotImage {
  const image = getImmersiveSite(siteId)?.hotspots[0]?.image;
  if (!image) throw new Error(`Missing existing mission image: ${siteId}`);
  return image;
}

const noLocalEdits = text(
  "保留 NASA 提供的 JPEG；未在本地裁剪、调色、合成或生成额外地形。",
  "NASA JPEG retained without local cropping, recoloring, compositing or generated terrain.",
);

const calorisSource = nasa(
  "mercurys-caloris-basin-one-of-the-largest-impact-basins-in-the-solar-system",
);
const calorisRimSource = nasa("the-caloris-montes");
const raditladiSource = nasa("a-detailed-look-at-raditladi-basin");
const raditladiFlybySource = nasa("the-curious-case-of-raditladi-basin");
const maxwellSource = nasa("venus-maxwell-montes-and-cleopatra-crater");
const maxwellPerspectiveSource = nasa(
  "looking-westward-across-the-fortuna-tessera-right-member-of-a-synthetic-stereo-pair",
);
const maatSource = nasa("venus-3-d-perspective-view-of-maat-mons");
const maatAlternateSource = nasa("venus-3-d-perspective-view-of-maat-mons-2");
const olympusSource =
  "https://www.jpl.nasa.gov/images/pia00993-olympus-mons-in-color/";
const olympusCalderaSource = nasa("photomosiac-of-olympus-mons");
const jezeroDriveSource = nasa("perseverance-hazcam-first-drive");
const jezeroLandingSource =
  "https://science.nasa.gov/resource/perseverances-first-full-color-look-at-mars/";
const vikingSource = "https://science.nasa.gov/mission/viking-1/";
const vikingColorSource =
  "https://science.nasa.gov/resource/first-color-image-from-viking-lander-1/";
const vikingLifeSource =
  "https://www.nasa.gov/history/25-years-of-continuous-robotic-mars-exploration-from-pathfinder-to-perseverance/";
const ishtarSource = nasa("perspective-view-of-ishtar-terra");
const danuSource = nasa("venus-danu-montes-and-lakshmi-planum");
const aphroditeSource = nasa("venus-ovda-regio");
const aphroditeComparisonSource = nasa("venus-aphrodite-terra");
const alphaSource = nasa("venus-false-color-image-of-alpha-regio");
const alphaPerspectiveSource = nasa(
  "venus-three-dimensional-perspective-view-of-alpha-region",
);
const magellanSource = "https://science.nasa.gov/mission/magellan/";
const vallesSource = nasa("valles-marineris");
const vallesCloudSource = nasa("valles-marineris-2");

type RockSpec = Pick<
  PlanetStory,
  | "id"
  | "bodyId"
  | "name"
  | "latitude"
  | "longitude"
  | "coordinateNote"
  | "introduction"
  | "gallery"
  | "events"
  | "sourceUrls"
>;

function region(spec: RockSpec): PlanetStory {
  return {
    ...spec,
    anchorKind: "surface",
    coordinateAccuracy: "approximate",
    summary: spec.introduction,
    paragraphs: spec.events.map((event) => event.description),
    date: spec.events[0].date,
    sectionTitle: text("科学与探索历程", "Science and Exploration"),
    relation: text(
      "这是区域级教育入口，不是着陆导航或真实近景重建。图库来自该区域的探测资料，每张图分别注明拍摄、发布或可视化关系；不把后期资料冒充事件发生瞬间。",
      "An educational regional anchor, not landing navigation or reconstructed close-up terrain. Gallery items identify acquisition, release and visualization context separately; later observations do not depict the instant of an earlier milestone.",
    ),
    image: spec.gallery[0],
    humanReview: "pending",
  };
}

export const rockPlanetStories: PlanetStory[] = [
  region({
    id: "region-mercury-caloris",
    bodyId: "mercury",
    name: text("卡洛里盆地", "Caloris Basin"),
    latitude: 31.65,
    longitude: 161.98,
    coordinateNote: text(
      "USGS Feature 979 的区域中心为 31.65°N、198.02°W（西经正向），换算为 161.98°E。页面另列旧控制网 30.50°N、189.80°W；这里不混用。仅为示意锚点，未验证与球体纹理逐像素配准。",
      "USGS Feature 979 regional center: 31.65°N, 198.02°W, converted to 161.98°E. Its older control-network entry is 30.50°N / 189.80°W and is not mixed with this pair. Schematic anchor; pixel-level registration to the globe texture is unverified.",
    ),
    introduction: text(
      "卡洛里是水星的大型撞击盆地。盆地内部平原、边缘山环和后来的撞击坑，让科学家可以比较水星不同时期的地质变化。",
      "Caloris is a large impact basin on Mercury. Its interior plains, mountainous rim and younger craters preserve different stages of the planet's geological history.",
    ),
    gallery: [
      picture(
        "mercury-caloris-pia13675.jpg",
        calorisSource,
        messengerCredit,
        "2008-01-14",
        text(
          "PIA13675：MESSENGER 首次水星飞掠时拍摄的卡洛里全盆地拼接影像，采集于 2008-01-14；是轨道视角，不是地面照片。",
          "PIA13675: Caloris mosaic from MESSENGER's first Mercury flyby, acquired January 14, 2008; an orbital view, not a surface photograph.",
        ),
        text(
          "源图由多幅 MDIS 窄角相机影像拼接。日照较高，亮度差异明显而地形阴影较少；未本地改色或增强细节。",
          "Source mosaic combines MDIS narrow-angle images under high Sun illumination, emphasizing brightness rather than shadows. No local recoloring or detail enhancement.",
        ),
      ),
      picture(
        "mercury-caloris-rim-pia14239.jpg",
        calorisRimSource,
        messengerCredit,
        "2011-05-05",
        text(
          "PIA14239：卡洛里东南边缘山环，2011-05-05 拍摄，约 95 千米宽、163 米/像素。后期轨道观测，不是 2008 年飞掠的同一画面。",
          "PIA14239: southeastern Caloris rim, acquired May 5, 2011; about 95 km wide at 163 m/pixel. A later orbital observation, not the 2008 flyby frame.",
        ),
        noLocalEdits,
      ),
    ],
    events: [
      {
        id: "caloris-first-messenger-flyby",
        title: text("飞掠补全盆地面貌", "A Flyby Reveals the Whole Basin"),
        date: "2008-01-14",
        description: text(
          "Mariner 10 在 1974 年观测时，卡洛里只有东半部处于日照中。2008 年 MESSENGER 的首次水星飞掠获得了完整盆地影像，为比较平原、山环和撞击坑提供新资料；2011 年的山环照片展示了后续轨道探测。",
          "Only the eastern half of Caloris was illuminated during Mariner 10's 1974 observations. MESSENGER's first Mercury flyby in 2008 imaged the entire basin, enabling comparisons of plains, rim mountains and craters. The 2011 rim image illustrates follow-up orbital exploration.",
        ),
        sourceUrls: [calorisSource, calorisRimSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      "https://planetarynames.wr.usgs.gov/Feature/979",
      calorisSource,
      calorisRimSource,
    ],
  }),
  region({
    id: "region-mercury-raditladi",
    bodyId: "mercury",
    name: text("拉迪特拉迪盆地", "Raditladi Basin"),
    latitude: 27.1,
    longitude: 119.2,
    coordinateNote: text(
      "采用 PIA19409 标注的影像中心 27.1°N、119.2°E，东经保持正值。用于盆地区域定位，非环峰上某点的精确测绘坐标；未验证底图配准。",
      "PIA19409 image center, 27.1°N / 119.2°E, retaining positive-east longitude. Regional orientation, not a surveyed peak-ring point; base-texture registration is unverified.",
    ),
    introduction: text(
      "拉迪特拉迪是一座具有内部峰环的水星撞击盆地。保存较好的盆壁、环峰和盆底同心槽，帮助科学家研究撞击之后地壳如何变形。",
      "Raditladi is a peak-ring impact basin on Mercury. Its preserved walls, interior ring and concentric floor troughs help scientists investigate deformation after impacts.",
    ),
    gallery: [
      picture(
        "mercury-raditladi-pia19409.jpg",
        raditladiSource,
        messengerCredit,
        "2015-04-16",
        text(
          "PIA19409：拉迪特拉迪 MDIS 拼接影像，NASA 于 2015-04-16 发布；来源未给单一采集日，此处日期不是拍摄日期。",
          "PIA19409: MDIS mosaic of Raditladi, released by NASA April 16, 2015. No single acquisition day is supplied; this is a release date.",
        ),
        text(
          "探测器影像拼接，覆盖约 258 千米直径的盆地；来源未提供该拼接产品的单一米/像素值，不推算虚假精度。未本地修改。",
          "Spacecraft mosaic of the roughly 258-km basin. The source does not provide one m/pixel value for this mosaic; none is fabricated. No local edits.",
        ),
      ),
      picture(
        "mercury-raditladi-flyby-pia12042.jpg",
        raditladiFlybySource,
        messengerCredit,
        "2008-01-14",
        text(
          "PIA12042：2008-01-14 飞掠相机照片，250 米/像素。源说明另用蓝箭头解释同心槽，本地下载的灰度 JPEG 不含这些箭头。",
          "PIA12042: flyby image acquired January 14, 2008 at 250 m/pixel. The source discussion refers to blue arrows marking troughs; the downloaded grayscale JPEG does not include those arrows.",
        ),
        text(
          "保留 NASA 提供的未标箭头灰度影像版本，未添加本地箭头、地形或颜色。",
          "NASA's unannotated grayscale image version retained; no local arrows, terrain or color added.",
        ),
      ),
    ],
    events: [
      {
        id: "raditladi-messenger-observation",
        title: text("从峰环读懂地质变化", "Reading a Peak-Ring Basin"),
        date: "2008-01-14",
        description: text(
          "MESSENGER 首次水星飞掠拍摄了这一盆地，它随后于 2008 年 4 月获得正式名称。照片中的同心槽与峰环使这里成为研究水星近期地质过程的区域；2015 年公布的拼接图补充了更完整的结构视野。",
          "MESSENGER imaged this basin during its first Mercury flyby; it received its formal name in April 2008. Troughs and the peak ring made it a useful region for studying Mercury's later geological processes. The mosaic released in 2015 provides a broader structural view.",
        ),
        sourceUrls: [raditladiSource, raditladiFlybySource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [raditladiSource, raditladiFlybySource],
  }),
  region({
    id: "region-venus-maxwell-montes",
    bodyId: "venus",
    name: text("麦克斯韦山脉", "Maxwell Montes"),
    latitude: 65,
    longitude: 6,
    coordinateNote: text(
      "采用 NASA PIA00149 的区域影像中心 65°N、6°E，不是最高峰或克娄巴特拉撞击坑的单点坐标。金星底图外观与雷达地表的配准未验证。",
      "Regional image center from NASA PIA00149, 65°N / 6°E; not the exact summit or Cleopatra crater position. Registration between the displayed Venus texture and radar surface is unverified.",
    ),
    introduction: text(
      "麦克斯韦是金星最高的山脉，最高区域约高于行星平均参考半径 11 千米。厚云遮挡可见光，探测器借助雷达研究山脊、谷地与撞击坑。",
      "Maxwell is Venus's highest mountain range, reaching roughly 11 km above the mean planetary reference radius. Radar reveals its ridges, valleys and craters beneath the thick clouds.",
    ),
    gallery: [
      picture(
        "venus-maxwell-radar-pia00149.jpg",
        maxwellSource,
        "NASA/JPL",
        "1996-02-05",
        text(
          "PIA00149：Magellan 雷达地表影像，1996-02-05 为图库发布日期，来源未给单一拍摄日。亮暗反映雷达回波，不是可见光地面照片。",
          "PIA00149: Magellan surface radar image. February 5, 1996 is its archive release date, not a supplied acquisition day. Brightness represents radar return, not a visible-light surface photograph.",
        ),
        noLocalEdits,
      ),
      picture(
        "venus-maxwell-perspective-pia00316.jpg",
        maxwellPerspectiveSource,
        "NASA/JPL/USGS",
        "1998-06-04",
        text(
          "PIA00316：从 Fortuna Tessera 向麦克斯韦看的测量数据可视化，1998-06-04 发布。计算机生成视角、发射率配色与 20 倍垂直夸张；不是探测器从这个机位拍摄的照片。",
          "PIA00316: measured-data visualization looking from Fortuna Tessera toward Maxwell, released June 4, 1998. Computer-generated perspective, emissivity colors and 20x vertical exaggeration; not a camera photograph from this viewpoint.",
        ),
        text(
          "源产品结合 Magellan 雷达与高程，标注影像分辨率 75 米；此数字属于源数据，不代表本项目拥有该精度的实时三维地形。未本地加工。",
          "Source product combines Magellan radar and elevation and states 75-m image resolution. This describes the source, not real-time terrain resolution in SOLARIS. No local processing.",
        ),
      ),
    ],
    events: [
      {
        id: "maxwell-radar-interpretation",
        title: text(
          "雷达改变对撞击坑的认识",
          "Radar Clarifies a Crater's Origin",
        ),
        date: "1998-06-04",
        description: text(
          "这组 1998 年发布的资料展示了 Magellan 对金星高地的研究。麦克斯韦斜坡上的克娄巴特拉圆形结构曾被怀疑与火山有关，雷达显示的喷出物特征支持撞击成因。图中颜色表示测量性质，并非真实地面颜色。",
          "The data visualization released in 1998 illustrates Magellan's study of Venusian highlands. Cleopatra, a circular feature on Maxwell's slopes once suspected to be volcanic, shows an ejecta blanket supporting an impact origin. The colors encode measurements, not actual ground colors.",
        ),
        sourceUrls: [maxwellSource, maxwellPerspectiveSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [maxwellSource, maxwellPerspectiveSource],
  }),
  region({
    id: "region-venus-maat-mons",
    bodyId: "venus",
    name: text("玛阿特火山", "Maat Mons"),
    latitude: 0.9,
    longitude: -165.5,
    coordinateNote: text(
      "NASA PIA00106/PIA00254 给出约 0.9°N、194.5°E，换算到 [-180,180] 为 -165.5°。这是火山区域锚点，非照片机位或可着陆导航点；底图配准未验证。",
      "NASA PIA00106/PIA00254 place the volcano near 0.9°N / 194.5°E, normalized to -165.5°. Regional anchor, not a camera position or landing waypoint; texture registration is unverified.",
    ),
    introduction: text(
      "玛阿特是金星的大型火山。雷达和测高资料显示，熔岩流从火山附近延展到周围平原。这里的透视图用于解释测量，不意味着已有高空可见光航拍。",
      "Maat Mons is a large volcano on Venus. Radar and altimetry reveal flows extending into the surrounding plains. The perspectives explain measurements; they are not visible-light aerial photographs.",
    ),
    gallery: [
      picture(
        "venus-maat-perspective-pia00106.jpg",
        maatSource,
        "NASA/JPL",
        "1992-04-22",
        text(
          "PIA00106：1992-04-22 发布的 Magellan 测量数据可视化。虚拟机位在火山以北 634 千米、高约 3 千米；10 倍垂直夸张与模拟色，不是地面照片。",
          "PIA00106: Magellan measured-data visualization released April 22, 1992. Virtual viewpoint 634 km north at about 3 km elevation; 10x vertical exaggeration and simulated color, not a surface photograph.",
        ),
        text(
          "源图把雷达与测高及 USGS 高程图结合，模拟色参考 Venera 13/14 的颜色资料。保留 JPL 科学可视化，未生成本地细节。",
          "Source rendering combines radar, altimetry and a USGS elevation map; simulated hues refer to Venera 13/14 color information. Original JPL visualization retained without generated local detail.",
        ),
      ),
      picture(
        "venus-maat-perspective-pia00254.jpg",
        maatAlternateSource,
        "NASA/JPL",
        "1996-03-14",
        text(
          "PIA00254：另一机位的科学透视图，1996-03-14 为图库发布日期。虚拟机位在火山以北 560 千米、高约 1.7 千米，垂直夸张 22.5 倍；不是前一图的重复拷贝或真实航拍。",
          "PIA00254: a different scientific viewpoint; March 14, 1996 is its archive release date. Virtual position 560 km north at about 1.7 km elevation with 22.5x vertical exaggeration; not a duplicate of the previous image or an aerial photograph.",
        ),
        text(
          "源数据为雷达与测高，颜色为模拟；不同机位和夸张比例用于展示平原与火山的关系。未在本地改色、裁剪或补造地形。",
          "Radar and altimetry with simulated color; a distinct viewpoint and exaggeration show plains in relation to the volcano. No local recoloring, cropping or invented terrain.",
        ),
      ),
    ],
    events: [
      {
        id: "maat-radar-visualization",
        title: text(
          "用测量描绘云层下的火山",
          "Mapping a Volcano Beneath the Clouds",
        ),
        date: "1992-04-22",
        description: text(
          "JPL 在 1992 年公布了这幅以 Magellan 合成孔径雷达和测高资料生成的玛阿特透视图。科学团队把难以直接看见的地表转为可理解的地形视角；不同垂直夸张比例必须与图片一起说明，不能当成真实高度比例。",
          "In 1992 JPL released this Maat perspective built from Magellan synthetic-aperture radar and altimetry. The team translated a cloud-hidden surface into an understandable terrain view. Its vertical exaggeration must be disclosed rather than interpreted as a realistic height ratio.",
        ),
        sourceUrls: [maatSource, maatAlternateSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [maatSource, maatAlternateSource],
  }),
  region({
    id: "region-mars-olympus-mons",
    bodyId: "mars",
    name: text("奥林帕斯山", "Olympus Mons"),
    latitude: 18.65,
    longitude: -133.8,
    coordinateNote: text(
      "保留已有目录的 USGS Feature 4453 控制网中心 18.65°N、226.20°E，归一为 -133.80°。USGS 另列 18.40°N、226.00°E；不是实景火山口单点或着陆导航坐标，底图配准未验证。",
      "Retains the existing directory's USGS Feature 4453 control-network center, 18.65°N / 226.20°E, normalized to -133.80°. USGS also lists 18.40°N / 226.00°E. Not an exact caldera point or landing waypoint; texture registration is unverified.",
    ),
    introduction: text(
      "奥林帕斯是一座规模巨大的盾状火山。山顶多个相互叠合的破火山口，记录了岩浆排出后地表反复塌陷的过程；图库均为无人探测器从轨道观测。",
      "Olympus is an enormous shield volcano. Overlapping summit calderas record repeated collapse after magma withdrawal. Both gallery images come from uncrewed orbital observations.",
    ),
    gallery: [
      reviewedLegacyImage("mars-olympus-mons"),
      picture(
        "mars-olympus-caldera-pia02984.jpg",
        olympusCalderaSource,
        "NASA/JPL",
        "2000-11-04",
        text(
          "PIA02984：Viking Orbiter 1 的奥林帕斯山顶破火山口拼接图。2000-11-04 为 NASA 图库发布日期，原采集日未标明；不是 2000 年地面探测。",
          "PIA02984: Viking Orbiter 1 mosaic of the summit calderas. November 4, 2000 is NASA's archive release date; the original acquisition day is unspecified. Not surface exploration in 2000.",
        ),
        text(
          "原产品为轨道照片拼接；保留其测量视角，不把像素尺寸换算成未公开的米/像素值。未本地处理。",
          "Original orbital photomosaic retained. Pixel dimensions are not converted into an unsupported m/pixel value. No local processing.",
        ),
      ),
    ],
    events: [
      {
        id: "olympus-mgs-orbital-imaging",
        title: text(
          "跨任务观察巨大火山",
          "Observing a Volcano Across Missions",
        ),
        date: "1997-10-20",
        description: text(
          "Mars Global Surveyor 于 1997-10-20 用红、蓝波段记录奥林帕斯山。图中的绿色波段由源团队合成，因此不是未经处理的自然彩照。另一张 Viking 山顶拼接图让我们比较整座火山与局部塌陷结构，二者不是同一天的事件现场。",
          "Mars Global Surveyor imaged Olympus on October 20, 1997 in red and blue bands. The source team synthesized green, so this is not an unprocessed natural-color photograph. A separate Viking summit mosaic connects the volcano's overall form with local collapse structures; the images are not records of the same day.",
        ),
        sourceUrls: [olympusSource, olympusCalderaSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      "https://planetarynames.wr.usgs.gov/Feature/4453",
      olympusSource,
      olympusCalderaSource,
    ],
  }),
  region({
    id: "region-mars-jezero",
    bodyId: "mars",
    name: text("杰泽罗陨石坑", "Jezero Crater"),
    latitude: 18.41,
    longitude: 77.69,
    coordinateNote: text(
      "采用 USGS Feature 14300 当前区域中心 18.41°N、77.69°E（东经正向）。是约 47.52 千米直径撞击坑的中心示意，不是 Perseverance 着陆点、首次行驶终点或照片机位；未验证底图配准。",
      "USGS Feature 14300 regional center, 18.41°N / 77.69°E, positive-east longitude. Center of the roughly 47.52-km crater, not Perseverance's landing point, first-drive endpoint or camera position; texture registration is unverified.",
    ),
    introduction: text(
      "杰泽罗是 Perseverance 无人火星车的探索区域。探测器在这里研究岩石、地质和过去的气候，并寻找古代微生物生命可能留下的迹象；这些目标不等于已确认生命存在。",
      "Jezero is the exploration region of the uncrewed Perseverance rover. It studies rocks, geology and past climate and searches for possible signs of ancient microbial life; these objectives do not establish that life has been found.",
    ),
    gallery: [
      picture(
        "mars-jezero-landing-pia24430.jpg",
        jezeroLandingSource,
        "NASA/JPL-Caltech",
        "2021-02-18",
        text(
          "PIA24430：Perseverance 于 2021-02-18 着陆后，Hazcam 返回的高分辨率彩色地表照片。画面来自坑内着陆区，不是整个陨石坑的航拍。",
          "PIA24430: high-resolution color Hazcam image returned after Perseverance's February 18, 2021 landing. The view is from the landing area inside Jezero, not an aerial image of the entire crater.",
        ),
        noLocalEdits,
      ),
      picture(
        "mars-jezero-drive-pia24482.jpg",
        jezeroDriveSource,
        "NASA/JPL-Caltech",
        "2021-03-04",
        text(
          "PIA24482：2021-03-04 首次短距离行驶与转向期间拍摄的 Hazcam 照片。轮迹对应无人火星车行驶，不是人的脚印。",
          "PIA24482: Hazcam image acquired during the rover's first short drive and turn on March 4, 2021. Tracks belong to the uncrewed rover, not human footprints.",
        ),
        noLocalEdits,
      ),
    ],
    events: [
      {
        id: "jezero-perseverance-landing",
        title: text("无人探测器抵达杰泽罗", "An Uncrewed Rover Reaches Jezero"),
        date: "2021-02-18",
        description: text(
          "Perseverance 于 2021-02-18 在杰泽罗着陆，随后返回地表彩色照片。它于 3 月 4 日完成首次行驶测试，为后续科学调查验证移动能力。这里展示的是无人探测进展，绝不是人类登陆火星。",
          "Perseverance landed in Jezero on February 18, 2021 and returned color views of the surface. Its first drive test on March 4 verified mobility for later scientific work. This is progress in uncrewed exploration, not a human landing on Mars.",
        ),
        sourceUrls: [jezeroLandingSource, jezeroDriveSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      "https://planetarynames.wr.usgs.gov/Feature/14300",
      jezeroLandingSource,
      jezeroDriveSource,
    ],
  }),
  region({
    id: "region-mars-viking-1",
    bodyId: "mars",
    name: text("维京 1 号着陆点", "Viking 1 Landing Site"),
    latitude: 22.483,
    longitude: -47.94,
    coordinateNote: text(
      "复用现有目录，NASA Viking 1 任务页给出 22.483°N、47.94°W，西经转换为 -47.94°。来源未明确纬度基准，仅用于区域示意；不是当前可导航坐标，底图配准未验证。",
      "Reuses the existing directory: NASA's Viking 1 mission page gives 22.483°N / 47.94°W, represented as -47.94°. Latitude datum is unspecified; regional orientation only, not present-day navigation. Texture registration is unverified.",
    ),
    introduction: text(
      "维京 1 号是无人着陆器，1976 年到达火星克律塞平原。它观察地表、天气并进行土壤实验，把从轨道看火星的探索扩展到地面长期测量。",
      "Viking 1 was an uncrewed lander that reached Chryse Planitia in 1976. Surface imaging, weather observations and soil experiments extended orbital exploration into sustained measurements on the ground.",
    ),
    gallery: [
      reviewedLegacyImage("mars-viking-1"),
      picture(
        "mars-viking-color-pia00563.jpg",
        vikingColorSource,
        "NASA/JPL",
        "1976-07-21",
        text(
          "PIA00563：1976-07-21 着陆后第二天的彩色地表照片，与前一张黑白照片不同。NASA 部分旧页面替代文本误写 1997，此处依据 Historical Date 与正文使用 1976。",
          "PIA00563: color surface image from July 21, 1976, the day after landing, distinct from the preceding monochrome image. Some old NASA alt text incorrectly says 1997; the historical date and body text establish 1976.",
        ),
        text(
          "源产品由相机经三个颜色滤镜扫描并参考校准板平衡颜色。未本地调色或人工上色，不是现代拍摄。",
          "Source product combines three camera filter scans with calibration-chart color balancing. No local recoloring or colorization; not a modern photograph.",
        ),
      ),
    ],
    events: [
      {
        id: "viking-1-sustained-surface-science",
        title: text("把科学实验室送到火星", "A Science Laboratory on Mars"),
        date: "1976-07-20",
        description: text(
          "维京 1 号于 1976-07-20 安全着陆，开展影像、气象和土壤研究。这是美国首次成功开展火星地面任务；不能笼统称全球首次软着陆，因为苏联 Mars 3 在 1971 年已着陆但很快失联。维京实验也没有证实火星生命。",
          "Viking 1 landed safely on July 20, 1976 for imaging, weather and soil research. It was the first successful US Mars surface mission, not an unqualified first soft landing: the Soviet Mars 3 landed in 1971 but quickly lost contact. Viking's experiments did not establish life on Mars.",
        ),
        sourceUrls: [vikingSource, vikingColorSource, vikingLifeSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      vikingSource,
      "https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/",
      vikingColorSource,
      vikingLifeSource,
    ],
  }),
  region({
    id: "region-venus-ishtar-terra",
    bodyId: "venus",
    name: text("伊什塔尔高地", "Ishtar Terra"),
    latitude: 70.4,
    longitude: 27.5,
    coordinateNote: text(
      "USGS Feature 2733 的区域中心为 70.4°N、27.5°E，采用行星中心纬度、东经正向。测高总览的视图中心约 65°N、0°；Danu 局部图中心为 60°N、324.5°E（-35.5°）。区域锚点不是两张图的拍摄点，底图配准未验证。",
      "USGS Feature 2733 regional center: 70.4°N / 27.5°E, planetocentric and positive-east. The altimetry view centers near 65°N / 0°; the Danu detail at 60°N / 324.5°E (-35.5°). This regional anchor is not either image's acquisition point; texture registration is unverified.",
    ),
    introduction: text(
      "伊什塔尔是金星北部的高地区域，包含拉克希米高原及周围山脉。雷达测高让人们越过不透明云层，比较高原、山地和邻近低地的相对高度。",
      "Ishtar is a northern Venus highland containing Lakshmi Planum and surrounding mountain ranges. Radar altimetry looks through opaque clouds to compare elevations across plateau, mountains and nearby lowlands.",
    ),
    gallery: [
      picture(
        "venus-ishtar-altimetry-pia00093.jpg",
        ishtarSource,
        "NASA/JPL/USGS",
        "1998-06-03",
        text(
          "PIA00093：Pioneer Venus 雷达测高数据生成的伊什塔尔透视图，1998-06-03 为图库发布日期。颜色代表高度，不是可见光照片。",
          "PIA00093: Ishtar perspective generated from Pioneer Venus radar altimetry, archived June 3, 1998. Colors encode elevation; not a visible-light photograph.",
        ),
        text(
          "来源以 0.5 与 1 千米间隔表示高程；未给出单一采集日、统一像素精度或垂直夸张倍数，不自行补造。保留官方文件，未本地加工。",
          "Source colors mark 0.5- and 1-km elevation intervals. No single acquisition day, uniform pixel resolution or vertical-exaggeration factor is supplied; none is invented. Official file retained without local edits.",
        ),
      ),
      picture(
        "venus-ishtar-danu-pia00249.jpg",
        danuSource,
        "NASA/JPL",
        "1996-03-14",
        text(
          "PIA00249：拉克希米高原西南边缘的 Danu 山脉，Magellan 雷达图；1996-03-14 为图库发布日期，不是拍摄日期。覆盖约 75 千米见方，不是整个伊什塔尔的照片。",
          "PIA00249: Magellan radar detail of Danu Montes on Lakshmi Planum's southwestern edge, about 75 km across. March 14, 1996 is its archive date, not acquisition. Not a photograph of all Ishtar.",
        ),
        text(
          "侧视雷达存在坡面压缩与透视效应；亮度是回波而非阳光颜色。未本地重建地形，来源未给单一米/像素值。",
          "Side-looking radar produces slope foreshortening and perspective effects; brightness is radar return, not sunlight color. No local terrain reconstruction; source gives no single m/pixel value.",
        ),
      ),
    ],
    events: [
      {
        id: "ishtar-magellan-radar-mapping",
        title: text("用雷达补充高地细节", "Radar Adds Highland Detail"),
        date: "1990-09-15",
        description: text(
          "Magellan 于 1990-09-15 开始返回高质量金星地表雷达影像。早期 Pioneer Venus 的测高与后来的局部雷达图可以互补，帮助理解高原边缘与山脉结构。图库是不同任务的资料展示，不是当天同一视角的实拍。",
          "Magellan began returning high-quality Venus surface radar images on September 15, 1990. Earlier Pioneer Venus altimetry and later radar details complement each other in studying plateau edges and mountains. These are records from different missions, not same-day photographs.",
        ),
        sourceUrls: [magellanSource, ishtarSource, danuSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      "https://planetarynames.wr.usgs.gov/Feature/2733",
      ishtarSource,
      danuSource,
      magellanSource,
    ],
  }),
  region({
    id: "region-venus-aphrodite-terra",
    bodyId: "venus",
    name: text("阿佛洛狄忒高地", "Aphrodite Terra"),
    latitude: -5.8,
    longitude: 104.8,
    coordinateNote: text(
      "USGS Feature 317 的区域中心为 5.8°S、104.8°E（行星中心纬度、东经正向）。奥夫达图覆盖 8°N—12°S、62°E—90°E；对比图中心 2°S、74°E。它们是高地西部的局部资料，未验证与球体底图配准。",
      "USGS Feature 317 regional center: 5.8°S / 104.8°E, planetocentric and positive-east. Ovda image covers 8°N–12°S / 62°E–90°E; comparison frames center at 2°S / 74°E. Western highland details, not the whole feature; globe-texture registration is unverified.",
    ),
    introduction: text(
      "阿佛洛狄忒是沿金星赤道附近展开的大型高地。西部奥夫达区域交错的脊、谷与断裂，记录了多阶段地质变化；这里的雷达亮暗不等于真实地表颜色。",
      "Aphrodite is an extensive Venus highland near the equator. Ridges, valleys and fractures in western Ovda Regio preserve several stages of geological change. Radar brightness does not represent natural surface color.",
    ),
    gallery: [
      picture(
        "venus-aphrodite-ovda-pia00146.jpg",
        aphroditeSource,
        "NASA/JPL",
        "1996-08-13",
        text(
          "PIA00146：Magellan 奥夫达雷达图，属于阿佛洛狄忒西部；1996-08-13 为图库发布日期。源图约覆盖 2250×1300 千米，675 米/源像素，不是可见光照片。",
          "PIA00146: Magellan radar mosaic of Ovda, western Aphrodite, archived August 13, 1996. Source coverage about 2250 × 1300 km at 675 m/source pixel; not a visible-light photograph.",
        ),
        text(
          "官方雷达拼接影像，明亮区域表示较强回波；原图已相对全分辨率数据降低 9 倍，不能将显示缩略版当作原始精度。未本地改色。",
          "Official radar mosaic: bright terrain has stronger radar return. The source is already reduced ninefold from full-resolution data; this display variant is not original-resolution data. No local recoloring.",
        ),
      ),
      picture(
        "venus-aphrodite-comparison-pia00248.jpg",
        aphroditeComparisonSource,
        "NASA/JPL",
        "1996-03-14",
        text(
          "PIA00248：高地内同一局部的两期 Magellan 雷达图，每幅覆盖约 24×38 千米。左图采集于 1990 年 11 月下旬，右图为随后 7 月 23 日；1996-03-14 是发布日，不是现场照片。",
          "PIA00248: two Magellan radar observations of one highland locality, each about 24 × 38 km. Left: late November 1990; right: the following July 23. March 14, 1996 is release, not a surface-photography date.",
        ),
        text(
          "来源给出 120 米/数据像素。对比中的变化被讨论为可能的滑坡或构造作用，不将该解释写成已证实的金星地震。未本地增添对比箭头或生成地形。",
          "Source data resolution is 120 m/pixel. Changes were discussed as possible landslide or tectonic activity, not a confirmed Venusquake. No local arrows or generated terrain.",
        ),
      ),
    ],
    events: [
      {
        id: "aphrodite-ovda-data-publication",
        title: text(
          "公开观测资料讲述地质变化",
          "Sharing Observations of Geological Change",
        ),
        date: "1996-08-13",
        description: text(
          "NASA 于 1996-08-13 发布奥夫达区域雷达图，展示高地中的多代结构。配合另一处的两期雷达对比，人们可以学习如何从观测提出地质假说，并区分影像中的变化与尚待检验的解释；这一天是资料发布，不是地质事件发生日。",
          "NASA archived the Ovda radar view on August 13, 1996, showing successive structures in the highland. A separate locality's repeat observations illustrate how evidence motivates geological hypotheses without confirming every interpretation. This is a publication milestone, not a date of geological activity.",
        ),
        sourceUrls: [aphroditeSource, aphroditeComparisonSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      "https://planetarynames.wr.usgs.gov/Feature/317",
      aphroditeSource,
      aphroditeComparisonSource,
    ],
  }),
  region({
    id: "region-venus-alpha-regio",
    bodyId: "venus",
    name: text("阿尔法区 · 麦哲伦观测", "Alpha Regio · Magellan Observations"),
    latitude: -25,
    longitude: 4,
    coordinateNote: text(
      "NASA PIA00147 与 PIA00481 给出 Alpha Regio 区域中心 25°S、4°E；不是电影虚拟相机的位置，也不是着陆点。使用区域级东经正向锚点，未验证与球体纹理配准。",
      "NASA PIA00147 and PIA00481 give Alpha Regio's regional center as 25°S / 4°E. Not a virtual movie-camera position or landing site. Regional positive-east anchor; globe-texture registration is unverified.",
    ),
    introduction: text(
      "阿尔法区是具有交错山脊和断裂谷的金星高地，也是有明确官方名称与观测资料的麦哲伦雷达探测区域。图库用地图与科学透视图解释同一真实区域，不虚构笼统的“观测区”。",
      "Alpha Regio is a Venus upland with intersecting ridges and fault valleys, documented by Magellan radar. Its official name and mapped observations make this a concrete exploration region; the gallery compares a map with a scientific perspective visualization.",
    ),
    gallery: [
      picture(
        "venus-alpha-radar-pia00147.jpg",
        alphaSource,
        "NASA/JPL",
        "1996-02-07",
        text(
          "PIA00147：Magellan 阿尔法区假彩色雷达拼接图，1996-02-07 为图库发布日期。区域约宽 1300 千米；不是可见光照片，颜色不是实景颜色。",
          "PIA00147: Magellan false-color radar mosaic of Alpha Regio, archived February 7, 1996. Region about 1300 km wide; not a visible-light photograph or natural scene color.",
        ),
        text(
          "保留 NASA 官方假彩色雷达产品；来源未给单一采集日或本拼接图统一米/像素值，不自行推定。未本地调色或生成细节。",
          "NASA's official false-color radar product retained. No single acquisition day or uniform m/pixel value is supplied for this mosaic; none is inferred. No local recoloring or generated detail.",
        ),
      ),
      picture(
        "venus-alpha-perspective-pia00481.jpg",
        alphaPerspectiveSource,
        "NASA/JPL",
        "1991-03-05",
        text(
          "PIA00481：Magellan 雷达与测高生成的阿尔法区科学透视图；是 1991-03-05 发布电影中的一帧，1996-12-02 入库。约 23 倍垂直夸张，不是相机地表照片。",
          "PIA00481: Alpha Regio scientific perspective from Magellan radar and altimetry; a frame from the movie released March 5, 1991, archived December 2, 1996. About 23× vertical exaggeration; not a surface-camera photo.",
        ),
        text(
          "源产品使用光线追踪、USGS 高程图及依据 Venera 13/14 的模拟颜色。地形高度经过夸张，不能据图量真实坡度；未本地重建或 AI 补细节。",
          "Source uses ray tracing, a USGS elevation model and simulated hues based on Venera 13/14. Exaggerated heights cannot measure true slopes; no local reconstruction or AI detail generation.",
        ),
      ),
    ],
    events: [
      {
        id: "alpha-magellan-scientific-visualization",
        title: text(
          "把雷达测量变成可理解的视图",
          "Making Radar Measurements Understandable",
        ),
        date: "1991-03-05",
        description: text(
          "1991-03-05 的新闻发布会公布了包含这一阿尔法区画面的科学电影。研究者结合雷达与测高建立三维地图，再生成透视画面，使公众能理解云层下的复杂地形；模拟颜色与高度夸张都是表达手段，不是载人探险或地面拍摄。",
          "A scientific movie released at the March 5, 1991 press conference included this Alpha Regio view. Radar and altimetry formed a three-dimensional map for a public-facing perspective. Simulated hues and exaggerated height are visualization choices, not a crewed expedition or ground photography.",
        ),
        sourceUrls: [alphaSource, alphaPerspectiveSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [alphaSource, alphaPerspectiveSource],
  }),
  region({
    id: "region-mars-valles-marineris",
    bodyId: "mars",
    name: text("水手号峡谷", "Valles Marineris"),
    latitude: -14.01,
    longitude: -58.59,
    coordinateNote: text(
      "USGS Feature 6288 的 MDIM 2.1 控制网区域中心为 14.01°S、301.41°E，换算为 -58.59°；MDIM 2.0 另列 13.74°S、300.80°E，不混用。MGS 云雾图覆盖 73°W—86°W、5°N—10°S，是峡谷西部的局部，不是锚点实拍。底图配准未验证。",
      "USGS Feature 6288 MDIM 2.1 regional center: 14.01°S / 301.41°E, represented as -58.59°. The MDIM 2.0 pair, 13.74°S / 300.80°E, is not mixed in. MGS cloud view covers 73°W–86°W / 5°N–10°S, a western detail, not a photograph from the anchor. Texture registration is unverified.",
    ),
    introduction: text(
      "水手号峡谷是横跨火星的巨大峡谷系统。轨道观测记录了相连的谷地、崩塌地形和峡谷中的云雾，让人们从地质与大气两个角度理解火星；这里没有人类登陆故事。",
      "Valles Marineris is an enormous canyon system across Mars. Orbital observations reveal connected troughs, collapse terrain and canyon haze, linking geological and atmospheric study. This is uncrewed exploration, not a human landing story.",
    ),
    gallery: [
      picture(
        "mars-valles-mosaic-pia00422.jpg",
        vallesSource,
        "NASA/JPL/USGS",
        "1998-06-08",
        text(
          "PIA00422：Viking 轨道器峡谷系统拼接图，1998-06-08 为图库发布日期，未给单一采集日。展示从西部夜迷宫到东部混沌地形的区域，不是地面照片。",
          "PIA00422: Viking orbiter mosaic across the canyon system, archived June 8, 1998; no single acquisition day supplied. It spans western Noctis Labyrinthus to eastern chaotic terrain, not a ground photograph.",
        ),
        text(
          "源图结合中分辨率黑白影像与低分辨率彩色影像，使用墨卡托投影；不把拼接图当成瞬时照片或真实三维地形。未本地加工，来源未给统一米/像素值。",
          "Source combines medium-resolution monochrome and low-resolution color images in Mercator projection. A mosaic, not an instantaneous photograph or true 3D terrain. No local edits; source gives no uniform m/pixel value.",
        ),
      ),
      picture(
        "mars-valles-clouds-pia00991.jpg",
        vallesCloudSource,
        "NASA/JPL/Malin Space Science Systems",
        "1997-10-03",
        text(
          "PIA00991：Mars Global Surveyor 于 1997-10-03 观测到峡谷中的午后云雾。原始红、蓝相机影像合成绿色通道；源精度约 350—600 米/像素，不是载人飞行照片。",
          "PIA00991: afternoon canyon clouds observed by Mars Global Surveyor on October 3, 1997. Green was synthesized from red and blue camera images; source resolution about 350–600 m/pixel. Not a crewed-flight photograph.",
        ),
        text(
          "两幅 MOC 宽角影像拼接，斜视及逐行扫描造成一定几何变形；保留原始产品的合成颜色。未本地拉伸、调色或制造近景。",
          "Two MOC wide-angle frames combined; oblique viewing and line scanning introduce some geometric distortion. Source synthesized color retained; no local stretching, recoloring or fabricated close-up detail.",
        ),
      ),
    ],
    events: [
      {
        id: "valles-mgs-cloud-observation",
        title: text(
          "轨道相机观察峡谷云雾",
          "An Orbiter Observes Canyon Clouds",
        ),
        date: "1997-10-03",
        description: text(
          "Mars Global Surveyor 在 1997-10-03 的近火星飞行中记录了峡谷内的午后云雾。与 Viking 的广域拼接图对照，可以理解同一峡谷系统的地形背景与大气现象；两图来自不同任务，并非同一天或同一地点的画面，任务均为无人探测。",
          "During a close pass on October 3, 1997, Mars Global Surveyor recorded afternoon clouds within the canyons. Comparison with Viking's regional mosaic connects atmospheric observations to their geological setting. The images come from different uncrewed missions, dates and footprints.",
        ),
        sourceUrls: [vallesSource, vallesCloudSource],
        imageIndices: [0, 1],
      },
    ],
    sourceUrls: [
      "https://planetarynames.wr.usgs.gov/Feature/6288",
      vallesSource,
      vallesCloudSource,
    ],
  }),
];
