import type { LocalizedText } from "./contentTypes";
import type { ImmersiveHotspotImage } from "./immersiveCatalog";
import type { PlanetStory } from "./planetStoryTypes";

const text = (zh: string, en: string): LocalizedText => ({ zh, en });
const photojournal = (slug: string) =>
  `https://science.nasa.gov/photojournal/${slug}/`;
const rights = "https://www.jpl.nasa.gov/jpl-image-use-policy/";
const facts = {
  jupiter: "https://science.nasa.gov/jupiter/jupiter-facts/",
  saturn: "https://science.nasa.gov/saturn/facts/",
  uranus: "https://science.nasa.gov/uranus/facts/",
  neptune: "https://science.nasa.gov/neptune/neptune-facts/",
};

function photo(
  id: string,
  slug: string,
  date: string,
  caption: LocalizedText,
  processing: LocalizedText,
  credit = "NASA/JPL",
): ImmersiveHotspotImage {
  return {
    path: `exploration/planets/gas/${id.toLowerCase()}.jpg`,
    sourceUrl: photojournal(slug),
    credit: `${credit} · ${id}`,
    date,
    caption,
    license: "NASA/JPL image-use policy; attribution and no endorsement",
    licenseUrl: rights,
    processing,
  };
}

const originalDownload = text(
  "下载 NASA Photojournal 的原始 JPEG；未本地裁剪、增强、放大或合成。滤镜、合成与颜色处理按来源图页说明。",
  "Original NASA Photojournal JPEG; no local crop, enhancement, upscaling or compositing. Filter combinations and color processing are described on the source page.",
);

const jupiterSpot = photo(
  "PIA00014",
  "jupiter-great-red-spot",
  "1979-02-25",
  text(
    "旅行者 1 号于 1979 年 2 月 25 日拍摄大红斑及附近湍流云层；当时可见约 160 千米尺度的云结构，不是今天的实时风暴位置。",
    "Voyager 1 observed the Great Red Spot and nearby turbulent clouds on February 25, 1979. Structures about 160 km across were visible; this is not the storm's live position today.",
  ),
  originalDownload,
);
const jupiterContext = photo(
  "PIA01384",
  "jupiters-great-red-spot-3",
  "1979",
  text(
    "旅行者 1 号的木星大红斑与云带影像；由三个黑白滤镜画面组合成彩色。标注年份为飞越年份，来源页未提供这组三帧的精确拍摄日。",
    "Voyager 1's view of Jupiter's Great Red Spot and cloud bands, assembled from three monochrome filter images. The year identifies the flyby; the source does not give an exact capture day for these frames.",
  ),
  text(
    "使用 NASA 图像服务提供的等比例 1280 像素宽 JPEG 版本，避免原始 5489×4637 图像的额外解码内存；未本地裁剪、调色、放大或合成。源图由三张滤镜黑白底片组合。",
    "NASA image service's proportionally scaled 1280-pixel-wide JPEG limits decoding memory compared with the 5489×4637 source. No local crop, recoloring, upscaling or compositing; the source combines three filtered monochrome negatives.",
  ),
);
const jupiterDisk = photo(
  "PIA01509",
  "jupiter-full-disk-with-great-red-spot",
  "1979-01-09",
  text(
    "旅行者 1 号于 1979 年 1 月 9 日拍摄的木星整球影像，展示大红斑及明暗云带；原始 JPEG 仅 400×400 像素，用于整体关系而非高精度局部细节。",
    "Voyager 1's full-disk view from January 9, 1979 shows the Great Red Spot and bright/dark cloud bands. The original JPEG is only 400×400 pixels, supplying overall context rather than precise local details.",
  ),
  originalDownload,
);
const saturnRings = photo(
  "PIA00534",
  "wide-angle-image-of-saturns-rings",
  "1981-08-26",
  text(
    "旅行者 2 号于 1981 年 8 月 26 日从斜角观察土星环；A 环与 B 环之间可见卡西尼缝。透视压缩使远侧环显得更窄，不代表环宽改变。",
    "Voyager 2's oblique view of Saturn's rings on August 26, 1981, including the Cassini Division between the A and B rings. Perspective compresses the far side; it does not indicate a changing ring width.",
  ),
  originalDownload,
);
const saturnRingColor = photo(
  "PIA01486",
  "composition-differences-within-saturns-rings",
  "1981-08-17",
  text(
    "旅行者 2 号 1981 年 8 月 17 日的环系增强色合成图；C 环、卡西尼缝及其他环的色差用于比较反射特征，不是肉眼自然色。",
    "An enhanced-color Voyager 2 ring composite from August 17, 1981. Color differences in the C ring, Cassini Division and other rings help compare reflectance; these are not naked-eye natural colors.",
  ),
  text(
    "来源由 clear、orange、ultraviolet 三种滤镜图像合成并高度增强颜色。下载原始 JPEG；未本地再处理，不将增强色当成真实视觉颜色。",
    "The source combines clear, orange and ultraviolet frames with strongly enhanced color. Original JPEG downloaded without further processing; enhanced colors are not presented as a literal visual appearance.",
  ),
);
const uranusCloud = photo(
  "PIA00370",
  "uranus-discrete-cloud",
  "1986-01-14",
  text(
    "旅行者 2 号于 1986 年 1 月 14 日拍摄的天王星假色合成图，边缘亮条为离散云；来源说明中的环形斑点属于镜头尘埃伪影，不是新的大气结构。",
    "A false-color Voyager 2 composite from January 14, 1986; the bright streak near the limb is a discrete cloud. Donut-shaped blemishes described by the source are optical dust artifacts, not atmospheric features.",
  ),
  text(
    "来源将 violet、blue、orange 图像对齐并强处理以突出微弱云结构，同时会增强相机瑕疵。下载原始 JPEG；未本地添加细节。",
    "The source aligns and strongly processes violet, blue and orange frames to reveal faint clouds, also emphasizing camera blemishes. Original JPEG downloaded; no details added locally.",
  ),
);
const uranusCrescent = photo(
  "PIA00143",
  "uranus-final-image",
  "1986-01-25",
  text(
    "旅行者 2 号于 1986 年 1 月 25 日离开天王星时拍摄的新月形整体影像，展示大气与高层霾；用于整球探测背景，不是环系近景。来源分辨率约 140 千米。",
    "Voyager 2's departing crescent view on January 25, 1986 shows Uranus' atmosphere and high-altitude haze. It supplies whole-planet exploration context, not a ring close-up; the source reports about 140 km resolution.",
  ),
  originalDownload,
);
const uranusRings = photo(
  "PIA00142",
  "uranus-ring-system",
  "1986",
  text(
    "旅行者 2 号 1986 年的天王星环系影像，高相位角突出细小尘埃。96 秒曝光带来拖影和恒星划痕；来源约 33 千米分辨率，不是模型中可放大的实体环。",
    "Voyager 2's 1986 view of Uranus' rings uses a high phase angle to reveal fine dust. Its 96-second exposure causes smear and star trails; the source reports about 33 km resolution, not a zoomable ring model.",
  ),
  originalDownload,
);
const neptuneSpot = photo(
  "PIA00052",
  "neptune-great-dark-spot-in-high-resolution",
  "1989",
  text(
    "旅行者 2 号在 1989 年飞越前约 45 小时拍摄的大暗斑与羽状白云，最小可见结构约 50 千米。这是后来消失的历史风暴，不代表当前海王星。",
    "Voyager 2 observed the Great Dark Spot and feathery white clouds about 45 hours before its 1989 encounter. Visible structures reach roughly 50 km; this historical storm later disappeared and is not a current view.",
  ),
  originalDownload,
);
const neptuneCloud = photo(
  "PIA02222",
  "neptune-clouds-on-the-dark-spot",
  "1989",
  text(
    "旅行者 2 号 1989 年飞越期间的大暗斑伴随高层白云影像；甲烷吸收使较深大气暗下去，白色高层云更突出。原始 JPEG 仅 400×400 像素，不提供虚构近景细节。",
    "Voyager 2's 1989 view of high-altitude white clouds accompanying the Great Dark Spot. Methane absorption darkens deeper atmospheric layers. The original JPEG is only 400×400 pixels; no close-up detail is invented.",
  ),
  originalDownload,
);

const jupiterEquator = photo(
  "PIA01524",
  "jupiters-equatorial-zone-in-exaggerated-color",
  "1979-06-28",
  text(
    "旅行者 2 号 1979 年 6 月 28 日的增强色合成图：上方为北赤道带，中间为明亮赤道区及羽状云。来源最小可见结构约 190 千米，不是自然色或当前云图。",
    "Voyager 2's enhanced-color composite from June 28, 1979: the North Equatorial Belt is above the bright Equatorial Zone and its plumes. Visible structures reach about 190 km; this is neither natural color nor a current cloud map.",
  ),
  text(
    "来源增强颜色以突出云结构；原始 JPEG 下载，未本地再增强、裁剪或放大。赤道区与北赤道带是不同的大气条带。",
    "Source colors are exaggerated to reveal cloud structure. Original JPEG downloaded without local enhancement, crop or enlargement. The Equatorial Zone and North Equatorial Belt are distinct atmospheric bands.",
  ),
);
const jupiterNorthEquator = photo(
  "PIA00458",
  "jupiters-north-equatorial-belt",
  "1979-07-06",
  text(
    "旅行者 2 号于 1979 年 7 月 6 日拍摄北赤道带的一条长暗云及附近较亮云层；这是赤道带的局部观测，不是黑色陆地或地表裂谷。交付 JPEG 为 607×496 像素。",
    "Voyager 2 observed an elongated dark cloud and neighboring brighter clouds in the North Equatorial Belt on July 6, 1979. This is an atmospheric band observation, not black land or a surface rift; the delivered JPEG is 607×496 pixels.",
  ),
  originalDownload,
);
const jupiterNorthPolar = photo(
  "PIA22336",
  "a-new-view-on-jupiters-north-pole",
  "2017-02-02",
  text(
    "朱诺号 2017 年 2 月 2 日的 JIRAM 北极热红外数据可视化，展示中心气旋及周围八个气旋。图中的三维起伏由科学团队按辐射强度构造，不是现场照片或实测云顶地形。",
    "A scientific visualization of Juno JIRAM's February 2, 2017 north-polar infrared data, showing a central cyclone and eight surrounding cyclones. Its relief was constructed from radiance by the science team, not photographed on location or measured as cloud-top terrain.",
  ),
  text(
    "NASA/JIRAM 官方增强产品：红外辐射强度经反转与三维可视化，不把画面高度当测高数据，也不把假色当肉眼自然色。原始 JPEG 下载，未本地添加细节。",
    "Official NASA/JIRAM enhancement: infrared radiance is inverted and visualized in 3-D. Displayed relief is not altimetry and the colors are not natural eyesight. Original JPEG downloaded; no local details added.",
  ),
  "NASA/JPL-Caltech/SwRI/ASI/INAF/JIRAM",
);
const jupiterSouthPolarComparison = photo(
  "PIA24967",
  "jupiters-polar-vortices-over-five-years",
  "2021",
  text(
    "朱诺号 JIRAM 南极气旋比较图，图内标注左侧为 2017 年 2 月、右侧为 2021 年 10 月，展示中心气旋和周围五个气旋；与上一张北极图是不同半球。NASA 正文把左侧写作 2016 年，与图内标注不一致，精确日期仍待人工核对。",
    "A Juno JIRAM south-polar comparison labeled February 2017 on the left and October 2021 on the right, showing a central cyclone with five neighbors. This is the opposite pole to the preceding image. NASA's prose calls the left panel 2016, conflicting with its embedded label; exact dating awaits human review.",
  ),
  text(
    "使用 NASA 图像服务的等比例 1280 像素宽版本；保留原有箭头、网格、日期标注和红外处理。未本地裁剪、放大、重标日期或添加现场细节。",
    "NASA image service's proportional 1280-pixel-wide version retains original arrows, grids, date labels and infrared processing. No local crop, enlargement, date relabeling or invented on-location detail.",
  ),
  "NASA/JPL-Caltech/SwRI/ASI/INAF/JIRAM",
);
const saturnHexagon2006 = photo(
  "PIA09188",
  "saturns-active-north-pole",
  "2006-10-29",
  text(
    "卡西尼号 VIMS 于 2006 年 10 月 29 日在北极冬季拍摄的六边形区域，利用 5 微米热红外观察云层；来源反转了对比度，明暗和红色不等于肉眼外观。",
    "Cassini VIMS observed the north-polar hexagon during winter on October 29, 2006 using 5-micron thermal infrared. The source reverses contrast; its brightness and red coloring are not a naked-eye appearance.",
  ),
  text(
    "NASA 图像服务等比例缩至 1280 像素宽；保留来源热红外、反转对比度和着色处理。无本地裁剪、调色、测高或虚构云层细节。",
    "NASA image service's proportional 1280-pixel-wide version preserves thermal-infrared, contrast-inversion and coloring processing. No local crop, recoloring, altimetry or invented cloud detail.",
  ),
  "NASA/JPL/University of Arizona",
);
const saturnHexagon2013 = photo(
  "PIA17654",
  "looking-down-on-the-hexagon-in-infrared",
  "2013-06-14",
  text(
    "卡西尼号 VIMS 于 2013 年 6 月 14 日观测的六边形红外影片静帧，经极地投影与假色处理；青色表示日照云层，红色表示从内部逸出的红外光。不是六边形固体地貌。",
    "A still from Cassini VIMS's June 14, 2013 infrared hexagon movie, processed as a false-color polar projection. Aqua represents sunlit clouds and red infrared light from the interior, not a solid hexagonal landform.",
  ),
  text(
    "来源把 0.92、1.06、5 微米分别映射到蓝、绿、红通道。使用官方 JPEG 静帧，不宣称已播放原电影；未本地裁剪或合成。",
    "The source maps 0.92, 1.06 and 5 microns to blue, green and red. Official JPEG still used without claiming movie playback; no local crop or composite.",
  ),
  "NASA/JPL-Caltech/University of Arizona",
);
const neptuneSmallDarkSpot = photo(
  "PIA00064",
  "neptunes-dark-spot-d2-at-high-resolution",
  "1989-08-24",
  text(
    "旅行者 2 号于 1989 年 8 月 24 日记录小暗斑 D2 的亮核和周边云带，最小可见结构约 20 千米。它与大暗斑是不同天气系统，不是今天仍固定存在的地点。",
    "Voyager 2 observed the bright core and surrounding bands of Small Dark Spot D2 on August 24, 1989, with visible structures about 20 km across. D2 and the Great Dark Spot are different weather systems, not fixed places guaranteed to persist today.",
  ),
  originalDownload,
);

type StorySpec = Pick<
  PlanetStory,
  | "id"
  | "bodyId"
  | "name"
  | "latitude"
  | "longitude"
  | "anchorKind"
  | "ringRadius"
  | "ringAngleDegrees"
  | "coordinateNote"
  | "introduction"
  | "gallery"
  | "events"
>;

function story(spec: StorySpec): PlanetStory {
  return {
    ...spec,
    coordinateAccuracy: "approximate",
    sectionTitle: text("科学与探测", "Science and exploration"),
    summary: spec.introduction,
    paragraphs: spec.events.map((event) => event.description),
    date: spec.events[0].date,
    relation: text(
      "图片为实际探测器观测及其科学处理产品，逐张说明观测日期和关系；不是载人登陆、实时画面或贴图对应的精密测绘。",
      "Images are real spacecraft observations and science-processed products with individual dates and relationships; not human landings, live views or precise maps aligned to the model texture.",
    ),
    sourceUrls: [
      ...new Set([
        facts[spec.bodyId as keyof typeof facts],
        ...spec.events.flatMap((event) => event.sourceUrls),
        ...spec.gallery.map((image) => image.sourceUrl),
      ]),
    ],
    image: spec.gallery[0],
    humanReview: "pending",
  };
}

const representative = text(
  "云层现象的代表入口锚点；纬经度只用于球面标签布局，云层会运动，既不是固定地表位置，也不是实时观测或贴图精确对齐。",
  "Representative atmospheric entry anchor. Latitude/longitude support spherical label placement only; moving clouds have no fixed surface position and are not live or precisely texture-aligned observations.",
);

export const gasPlanetStories: PlanetStory[] = [
  story({
    id: "region-jupiter-great-red-spot",
    bodyId: "jupiter",
    name: text("大红斑", "Great Red Spot"),
    latitude: -22,
    longitude: 80,
    anchorKind: "cloud",
    coordinateNote: text(
      "大红斑位于南半球约 22°S 的区域，此处取 -22° 为示意纬度，不混同行星地理纬度与行星中心纬度；80° 经度只是代表入口锚点，不是固定或实时经度，也不保证与现有示意贴图精确对齐。",
      "The Great Red Spot occupies a southern region near 22°S. The -22° anchor is approximate, not an interchange of planetographic and planetocentric latitude. Longitude 80° is a representative entry, not a fixed/live longitude or exact alignment with the schematic texture.",
    ),
    introduction: text(
      "大红斑是木星大气中的大型反气旋风暴，不是山脉或固体表面的红色地块。对它和周围云纹的长期观测，帮助科学家研究巨行星的大气运动。",
      "The Great Red Spot is a large anticyclonic storm in Jupiter's atmosphere, not a mountain or a red patch on solid ground. Observations of the storm and surrounding clouds help scientists investigate giant-planet atmospheric motion.",
    ),
    gallery: [jupiterSpot, jupiterContext],
    events: [
      {
        id: "jupiter-voyager-storm-observation",
        title: text(
          "1979：旅行者近距离观察",
          "1979: Voyager's close observations",
        ),
        date: "1979",
        description: text(
          "旅行者 1 号在 1979 年接近木星时记录大红斑与周边波状云纹。连续观测让远处的色斑成为可研究的天气系统；这些旧影像不能用来宣称今天的风暴尺寸、颜色或经度。",
          "Voyager 1 recorded the Great Red Spot and nearby wavy clouds during its 1979 approach. Repeated images turned a distant colored feature into a weather system to study; they do not establish the storm's size, color or longitude today.",
        ),
        sourceUrls: [
          jupiterSpot.sourceUrl,
          jupiterContext.sourceUrl,
          "https://ntrs.nasa.gov/citations/20210022719",
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-jupiter-cloud-belts",
    bodyId: "jupiter",
    name: text("云带与云区", "Belts and zones"),
    latitude: 16,
    longitude: 125,
    anchorKind: "cloud",
    coordinateNote: representative,
    introduction: text(
      "木星交替的明亮云区与较暗云带环绕整颗星球，它们是大气结构，不是大陆。不同方向的高速气流与云带边缘的扰动，共同形成木星富有层次的外观。",
      "Jupiter's alternating bright zones and darker belts encircle the planet. They are atmospheric structures, not continents; winds flowing in different directions and disturbances near band edges shape the layered appearance.",
    ),
    gallery: [jupiterDisk, jupiterSpot],
    events: [
      {
        id: "jupiter-belt-cloud-science",
        title: text(
          "从颜色和运动认识大气",
          "Learning from cloud color and motion",
        ),
        date: "1979",
        description: text(
          "图库的整片云层视图展示明暗条带，大红斑近景则展示条带附近的湍流。这里的两张旅行者影像提供互补背景，不把某一拍摄时刻的云纹当成永远不变的地理区域。",
          "The wider view shows bright and dark bands, while the Great Red Spot close-up supplies neighboring turbulent-cloud context. These complementary Voyager images do not turn transient cloud patterns into permanent geographic regions.",
        ),
        sourceUrls: [
          facts.jupiter,
          jupiterDisk.sourceUrl,
          jupiterSpot.sourceUrl,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-saturn-rings",
    bodyId: "saturn",
    name: text("土星环", "Saturn's rings"),
    latitude: 0,
    longitude: 0,
    anchorKind: "ring",
    ringRadius: 1.7,
    ringAngleDegrees: 25,
    coordinateNote: text(
      "代表入口绑定现有倾斜环面：示意半径 1.7、环面角 25°；并非土星表面经纬度。环粒子会绕行，模型大小、比例、倾角和标签位置不是精密测绘。",
      "Representative entry on the existing tilted ring plane: schematic radius 1.7 and angle 25°, not surface latitude/longitude. Particles orbit Saturn; model scale, proportions, tilt and label position are not precise cartography.",
    ),
    introduction: text(
      "土星环由大量冰粒及含岩石、尘埃的物质组成，并非一整块固体圆盘。环之间的亮度差异、缝隙和细条带，帮助我们理解粒子组成与轨道运动。",
      "Saturn's rings contain countless ice particles with rocky and dusty material, not one solid disk. Brightness differences, gaps and ringlets offer clues to particle composition and orbital motion.",
    ),
    gallery: [saturnRings, saturnRingColor],
    events: [
      {
        id: "saturn-voyager-ring-science",
        title: text(
          "1981：从斜角观察复杂环系",
          "1981: An oblique view of a complex ring system",
        ),
        date: "1981",
        description: text(
          "旅行者 2 号于 1981 年飞越土星。宽角影像展示多个主要环，另一张增强色图通过不同滤镜比较反射特征。增强色只是科学分析手段，不能作为肉眼颜色或确定成分的唯一证据。",
          "Voyager 2 flew past Saturn in 1981. A wide-angle view records the major rings, while an enhanced-color filter composite compares reflectance. Enhanced color is a science-analysis technique, not literal eye color or sole proof of composition.",
        ),
        sourceUrls: [
          saturnRings.sourceUrl,
          saturnRingColor.sourceUrl,
          facts.saturn,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-saturn-cassini-division",
    bodyId: "saturn",
    name: text("卡西尼缝", "Cassini Division"),
    latitude: 0,
    longitude: 0,
    anchorKind: "ring",
    ringRadius: 1.925,
    ringAngleDegrees: 115,
    coordinateNote: text(
      "代表入口绑定现有倾斜环面：示意半径 1.925、环面角 115°。位置只区分环系入口，不宣称模型精确还原 A/B 环边界或卡西尼缝宽度，亦非土星地表坐标。",
      "Representative entry on the existing tilted ring plane: schematic radius 1.925 and angle 115°. This separates ring entries without claiming exact A/B boundaries or Division width; it is not a surface coordinate.",
    ),
    introduction: text(
      "卡西尼缝位于土星 A 环与 B 环之间。它较暗、粒子分布较稀，但不是完全空无一物的裂口；对它的观测说明明暗外观不能简单等同于有物质或无物质。",
      "The Cassini Division lies between Saturn's A and B rings. It is darker and less densely populated, not an entirely empty crack. Its appearance shows why brightness cannot simply be equated with presence or absence of material.",
    ),
    gallery: [saturnRingColor, saturnRings],
    events: [
      {
        id: "saturn-cassini-division-observation",
        title: text(
          "理解环之间的较暗区域",
          "Understanding a darker region between rings",
        ),
        date: "1981",
        description: text(
          "旅行者 2 号的斜角环系照片和增强色图都包含卡西尼缝。照片视角与颜色处理不同，但研究的是同一个较稀疏环区；这里不把卡西尼缝与 A 环内另一处恩克缝混为一谈。",
          "Both the oblique ring view and enhanced-color Voyager 2 image include the Cassini Division. Their perspectives and color processing differ, but refer to the same relatively sparse region; the Division is not the separate Encke Gap within the A ring.",
        ),
        sourceUrls: [
          saturnRings.sourceUrl,
          saturnRingColor.sourceUrl,
          "https://www.jpl.nasa.gov/images/pia00400-saturn-and-4-icy-moons-in-natural-color/",
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-uranus-clouds",
    bodyId: "uranus",
    name: text("云层与高层霾", "Clouds and high-altitude haze"),
    latitude: -35,
    longitude: 85,
    anchorKind: "cloud",
    coordinateNote: representative,
    introduction: text(
      "天王星看似平静的蓝绿色外观并不代表完全没有天气。甲烷吸收红光，云和高层霾影响我们看见的颜色与纹理；微弱特征有时需要滤镜组合与科学处理才能辨认。",
      "Uranus' apparently quiet blue-green appearance does not mean it lacks weather. Methane absorbs red light, while clouds and haze affect visible color and texture; faint features may need filter combinations and science processing to reveal them.",
    ),
    gallery: [uranusCloud, uranusCrescent],
    events: [
      {
        id: "uranus-voyager-cloud-observation",
        title: text(
          "1986：辨认微弱云结构",
          "1986: Revealing faint cloud features",
        ),
        date: "1986",
        description: text(
          "旅行者 2 号的假色图显示一条离散云，离开时的整体新月影像则显示高层霾。前者的环形瑕疵是镜头尘埃伪影，两种处理产品都不能被当成地表照片或载人登陆记录。",
          "Voyager 2's false-color image reveals a discrete cloud, and its departing crescent view shows high-altitude haze. Donut-shaped blemishes in the former are optical dust artifacts; neither product is a surface photograph or record of a human landing.",
        ),
        sourceUrls: [uranusCloud.sourceUrl, uranusCrescent.sourceUrl],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-uranus-rings",
    bodyId: "uranus",
    name: text("天王星环系", "Uranus' ring system"),
    latitude: 0,
    longitude: 135,
    anchorKind: "phenomenon",
    coordinateNote: text(
      "整球上的代表入口锚点，不是环上经纬度；当前模型尚未重建天王星实体环几何。通过图库认识真实环系，不用标签位置冒充精确环面测量。",
      "Representative entry on the globe, not ring latitude/longitude. The current model does not reconstruct Uranus' ring geometry. The gallery teaches the real ring system without presenting the label as a precise ring-plane measurement.",
    ),
    introduction: text(
      "天王星也拥有环系。环中细小尘埃在特殊观测角度下更容易显现，探测器的照明几何和曝光时间决定了哪些结构能被看见。",
      "Uranus also has a ring system. Fine dust becomes more visible under particular viewing geometry; illumination and exposure determine which structures a spacecraft can detect.",
    ),
    gallery: [uranusRings, uranusCrescent],
    events: [
      {
        id: "uranus-voyager-ring-observation",
        title: text(
          "1986：逆光揭示环中尘埃",
          "1986: Backlighting reveals ring dust",
        ),
        date: "1986",
        description: text(
          "旅行者 2 号在高相位角下使用长曝光观察环系，细小尘埃的亮带因而突出。图库第二张是同次飞越后的整球大气背景，不是环近景；拖影和恒星划痕也不是新的环条带。",
          "Voyager 2's long-exposure, high-phase-angle view emphasizes lanes of fine ring dust. The second gallery image provides atmospheric whole-planet context after the same encounter, not a ring close-up; smear and star trails are not additional ringlets.",
        ),
        sourceUrls: [
          uranusRings.sourceUrl,
          uranusCrescent.sourceUrl,
          facts.uranus,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-neptune-great-dark-spot",
    bodyId: "neptune",
    name: text("1989 年大暗斑", "Great Dark Spot (1989)"),
    latitude: -22,
    longitude: 80,
    anchorKind: "cloud",
    coordinateNote: text(
      "南半球风暴的代表入口锚点，不是固定地表位置或今天的风暴坐标；纬经度与模型贴图只是示意。1989 年旅行者观察到的这处大暗斑后来消失，不能声称仍位于此处。",
      "Representative entry for a southern storm, not a fixed surface position or today's storm coordinates; latitude/longitude and texture are schematic. The Great Dark Spot observed in 1989 later disappeared and cannot be claimed to remain here.",
    ),
    introduction: text(
      "旅行者 2 号在 1989 年观察到海王星南半球的大暗斑。它是大气风暴而非地表坑洞，后来已消失；新的暗斑可出现在不同位置，说明远方行星的天气也会变化。",
      "Voyager 2 observed Neptune's southern Great Dark Spot in 1989. It was an atmospheric storm, not a surface crater, and later disappeared. New dark spots can emerge elsewhere, demonstrating changing weather on a distant planet.",
    ),
    gallery: [neptuneSpot, neptuneCloud],
    events: [
      {
        id: "neptune-voyager-historical-storm",
        title: text(
          "1989：飞越影像留下天气记录",
          "1989: Flyby images preserve a weather record",
        ),
        date: "1989",
        description: text(
          "近景记录暗斑边界和羽状白云，另一幅影像突出暗斑附近的高层云。这些观测让科学家研究巨行星天气，图像只代表当年的观测时期，不是可无限放大的当前地形。",
          "The close-up records a dark boundary and feathery white clouds, while another view highlights nearby high clouds. These observations support giant-planet weather science; they record that historical period, not current terrain that can be zoomed indefinitely.",
        ),
        sourceUrls: [
          neptuneSpot.sourceUrl,
          neptuneCloud.sourceUrl,
          facts.neptune,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-neptune-high-clouds",
    bodyId: "neptune",
    name: text("高层白云", "High-altitude white clouds"),
    latitude: -35,
    longitude: 135,
    anchorKind: "cloud",
    coordinateNote: representative,
    introduction: text(
      "海王星的高层云可在较暗的大气背景上显得明亮。不同波段对甲烷吸收的响应不同，帮助研究者分辨云层高度；这不是固体表面的白色山峰。",
      "High clouds on Neptune can stand out brightly against a darker atmosphere. Wavelength-dependent methane absorption helps distinguish cloud altitude; these are not white mountain peaks on a solid surface.",
    ),
    gallery: [neptuneCloud, neptuneSpot],
    events: [
      {
        id: "neptune-cloud-filter-science",
        title: text(
          "用光谱响应认识云层",
          "Learning about clouds from spectral response",
        ),
        date: "1989",
        description: text(
          "旅行者影像中，大暗斑附近的白色结构是高层云，周围大气在甲烷吸收波段较暗。另一张近景说明这些白云与历史风暴的关系；不能把这两张旧照片当成今天的云层位置。",
          "White features near the Great Dark Spot appear at high altitude while methane absorption darkens deeper layers. The close-up supplies historical storm context; neither older photograph locates clouds today.",
        ),
        sourceUrls: [
          neptuneCloud.sourceUrl,
          neptuneSpot.sourceUrl,
          facts.neptune,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-jupiter-equatorial-belts",
    bodyId: "jupiter",
    name: text("赤道云带观测区", "Equatorial cloud bands"),
    latitude: 8,
    longitude: -45,
    anchorKind: "cloud",
    coordinateNote: representative,
    introduction: text(
      "赤道附近的明亮赤道区与较暗北赤道带不是同一条带，也不是地表行政区。这里专门比较两者的云纹与高度线索；原有「云带与云区」入口仍保留为整球概览。",
      "The bright Equatorial Zone and darker North Equatorial Belt are distinct bands near Jupiter's equator, not surface districts. This entry compares their cloud patterns and altitude clues; the existing Belts and zones entry remains a global overview.",
    ),
    gallery: [jupiterEquator, jupiterNorthEquator],
    events: [
      {
        id: "jupiter-voyager-equatorial-comparison",
        title: text(
          "1979：比较赤道区与北赤道带",
          "1979: Comparing zone and belt",
        ),
        date: "1979",
        description: text(
          "旅行者 2 号 6 月的增强色影像展示赤道区的羽状云和其北侧较暗云带；7 月的另一张影像记录北赤道带的长暗云及较亮云层。它们是不同观测，帮助比较大气结构，不支持把暗带当成固定地表。",
          "Voyager 2's June enhanced-color view shows plumes in the Equatorial Zone and a darker belt to its north. A separate July observation records an elongated dark cloud and brighter clouds in the North Equatorial Belt. These different observations compare atmospheric structures, not fixed land.",
        ),
        sourceUrls: [jupiterEquator.sourceUrl, jupiterNorthEquator.sourceUrl],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-jupiter-polar-cyclones",
    bodyId: "jupiter",
    name: text("极地气旋观测区", "Polar cyclone observations"),
    latitude: 82,
    longitude: -110,
    anchorKind: "phenomenon",
    coordinateNote: text(
      "北极附近的代表入口锚点，内容比较南北两极；82° 与 -110° 只用于布局，不是任何一个气旋的固定或实时坐标。气旋会运动，当前球体也未重建气旋地形。",
      "Representative entry near the north pole for content comparing both poles. The 82°/-110° layout anchor is not a fixed or live cyclone coordinate. Cyclones move; the current globe does not reconstruct cyclone terrain.",
    ),
    introduction: text(
      "朱诺号用热红外研究木星的极地气旋群。北极曾观测到一个中心气旋周围排列八个气旋，南极的比较资料展示中心气旋与五个邻近气旋；这些是观测时期的天气结构，不是永远不变的地点。",
      "Juno studies Jupiter's polar cyclone groups in thermal infrared. North-polar observations show a central cyclone surrounded by eight; the south-polar comparison shows a central cyclone with five neighbors. These are weather structures at the observation epochs, not permanently fixed places.",
    ),
    gallery: [jupiterNorthPolar, jupiterSouthPolarComparison],
    events: [
      {
        id: "jupiter-jiram-polar-weather",
        title: text(
          "从红外数据认识极地天气",
          "Polar weather through infrared data",
        ),
        date: "2021",
        description: text(
          "JIRAM 记录木星向外发出的红外辐射，让研究者在可见光之外追踪云层和气旋。图库第一张为北极数据的官方三维可视化，不是高度实测；第二张为南极不同年份的带注释比较图，说明气旋群的位置关系随时间变化。",
          "JIRAM measures infrared radiation emerging from Jupiter to track clouds and cyclones beyond visible light. The first image is an official north-polar data visualization, not measured relief; the second is an annotated south-polar comparison across years showing changing cyclone arrangements.",
        ),
        sourceUrls: [
          jupiterNorthPolar.sourceUrl,
          jupiterSouthPolarComparison.sourceUrl,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-saturn-north-hexagon",
    bodyId: "saturn",
    name: text("北极六边形", "North-polar hexagon"),
    latitude: 78,
    longitude: -65,
    anchorKind: "cloud",
    coordinateNote: text(
      "约北纬 78° 的六边形急流代表入口锚点；此处纬度为球面示意，不精确互换行星地理/中心纬度。-65° 经度只作布局，六边形不是固定地表结构，也未在现有贴图上精确测绘。",
      "Representative entry for the hexagonal jet near 78°N. Latitude is schematic, not an exact conversion of planetographic/planetocentric coordinates. Longitude -65° is for layout; the hexagon is neither fixed terrain nor precisely mapped onto the current texture.",
    ),
    introduction: text(
      "土星北极六边形是环绕极区的六边形急流及相关云层现象，不是人造建筑或固体边缘。卡西尼号的红外仪器能在冬季黑暗中观察它，之后又记录了不同照明条件下的变化。",
      "Saturn's north-polar hexagon is a six-sided jet stream and associated clouds, not a building or a solid edge. Cassini's infrared instrument observed it through winter darkness and later under different illumination.",
    ),
    gallery: [saturnHexagon2006, saturnHexagon2013],
    events: [
      {
        id: "saturn-vims-hexagon-observations",
        title: text(
          "2006 与 2013：红外观察六边形",
          "2006 and 2013: Infrared views of the hexagon",
        ),
        date: "2013-06-14",
        description: text(
          "2006 年的 5 微米观测借助土星内部发出的热红外光揭示北极云层；2013 年的极地投影把不同波长分配成假色，区分日照云与内部红外光。两图来自不同观测时期，不把处理颜色或图像明暗当成固体地形。",
          "The 2006 five-micron observation uses Saturn's interior infrared glow to reveal polar clouds. The 2013 polar projection assigns false colors to wavelengths to distinguish sunlit clouds and interior infrared light. The images represent different observations; processing colors and brightness are not solid terrain.",
        ),
        sourceUrls: [saturnHexagon2006.sourceUrl, saturnHexagon2013.sourceUrl],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-saturn-ring-observation",
    bodyId: "saturn",
    name: text("C 环代表性观测区", "C-ring observation region"),
    latitude: 0,
    longitude: 0,
    anchorKind: "ring",
    ringRadius: 1.5,
    ringAngleDegrees: 225,
    coordinateNote: text(
      "代表入口绑定已有土星倾斜环面，示意半径 1.5、角度 225°。模型未按真实千米值重建 C 环内外边缘，这不是地表纬经度，也不声称该点精确对应某条环纹。",
      "Representative entry attached to the existing tilted Saturn ring plane at illustrative radius 1.5 and angle 225°. The model does not rebuild the C-ring edges in kilometers. This is not surface latitude/longitude or an exact ringlet coordinate.",
    ),
    introduction: text(
      "C 环是土星主环系的一部分。这个观测入口比较宽角几何与增强色影像，认识同一环系为什么在不同角度、波长与处理方式下呈现不同明暗；它不是新造的近景环纹理。",
      "The C ring is part of Saturn's main ring system. This entry compares wide-angle geometry with enhanced-color imagery to explain how angle, wavelength and processing change ring appearance. It does not create a new close-up ring texture.",
    ),
    gallery: [saturnRingColor, saturnRings],
    events: [
      {
        id: "saturn-voyager-c-ring-comparison",
        title: text(
          "1981：用两种影像比较环带",
          "1981: Comparing ring regions in two views",
        ),
        date: "1981",
        description: text(
          "8 月 17 日的滤镜组合增强了 C 环、卡西尼缝及其他环的反射差异；8 月 26 日的斜角宽图说明整体环系和透视关系。两张照片均覆盖多个环带，不当成 C 环单独近景，也不由颜色直接断言具体物质成分。",
          "The August 17 filter composite enhances reflectance differences in the C ring, Cassini Division and other rings. The August 26 oblique view supplies wider ring geometry. Both images cover several ring regions, not an isolated C-ring close-up; color alone does not establish exact composition.",
        ),
        sourceUrls: [saturnRingColor.sourceUrl, saturnRings.sourceUrl],
        imageIndices: [0, 1],
      },
    ],
  }),
  story({
    id: "region-neptune-storm-activity",
    bodyId: "neptune",
    name: text("风暴活动观测区", "Storm-activity observations"),
    latitude: -50,
    longitude: -70,
    anchorKind: "phenomenon",
    coordinateNote: text(
      "海王星天气案例的代表入口锚点；-50°、-70° 是标签布局，不是 D2 或大暗斑的固定坐标。两张图记录 1989 年不同风暴，均不代表当前仍存在于此处。",
      "Representative entry for Neptune weather cases; -50°/-70° place the label, not D2 or the Great Dark Spot at fixed coordinates. The two images show different 1989 storms, neither guaranteed to persist here today.",
    ),
    introduction: text(
      "海王星不只有一个暗斑。旅行者 2 号曾观察到大暗斑与较小的 D2 系统，它们的亮云、周边条带和不同形态为研究远方天气提供线索。风暴可能形成、移动并消失，不属于固定地表地点。",
      "Neptune has more than one kind of dark spot. Voyager 2 observed the Great Dark Spot and smaller D2 system; bright clouds, surrounding bands and different forms offer clues to distant weather. Storms form, move and fade rather than occupying fixed surface locations.",
    ),
    gallery: [neptuneSmallDarkSpot, neptuneSpot],
    events: [
      {
        id: "neptune-voyager-two-weather-systems",
        title: text(
          "1989：区分 D2 与大暗斑",
          "1989: Distinguishing D2 and the Great Dark Spot",
        ),
        date: "1989-08-24",
        description: text(
          "8 月 24 日的 D2 高分辨率观测记录亮核和细小云纹，来源可见最小结构约 20 千米；另一张大暗斑图展示不同风暴及羽状伴随云。图页中的旋转与上升气流是当时研究者根据云结构提出的解释，不应把未测定的旋转速率写成确定数值。",
          "The August 24 high-resolution D2 view records a bright core and cloud detail, with visible structures about 20 km across. The Great Dark Spot image shows a different storm and companion plumes. Rotation and upwelling interpretations in the source were inferred from cloud structure; an unmeasured rotation rate is not reported as a fact.",
        ),
        sourceUrls: [
          neptuneSmallDarkSpot.sourceUrl,
          neptuneSpot.sourceUrl,
          facts.neptune,
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
];
