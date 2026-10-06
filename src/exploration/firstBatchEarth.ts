import type { LocalizedText } from "./contentTypes";
import { cityStories } from "./cityStories";
import {
  earthDirectory,
  getEarthCity,
  getCountryEntry,
} from "./earthDirectory";
import type { GalleryStory } from "./galleryStory";
import cityPhotoRecords from "../../public/exploration/first-batch/cities/source-records.json" with { type: "json" };
import type { ImmersiveHotspotImage } from "./immersiveCatalog";
import { getCityLandmarks } from "./cityLandmarks";

export type FirstBatchContinentId =
  | "asia"
  | "europe"
  | "north-america"
  | "south-america"
  | "oceania"
  | "africa";

export interface FirstBatchCity {
  id: string;
  name: LocalizedText;
  label: LocalizedText;
  latitude: number;
  longitude: number;
  capital: boolean;
  featured: true;
  countryId: string;
  countryName: LocalizedText;
  continentId: FirstBatchContinentId;
  sourceUrls: string[];
}

const text = (zh: string, en: string): LocalizedText => ({ zh, en });
const directoryUrl = earthDirectory.databaseLicense.sourceUrl;

// These are user-selected navigation groups, not sovereign-state or boundary decisions.
export const firstBatchContinents = [
  { id: "asia", name: text("亚洲", "Asia") },
  { id: "europe", name: text("欧洲", "Europe") },
  { id: "north-america", name: text("北美洲", "North America") },
  { id: "south-america", name: text("南美洲", "South America") },
  { id: "oceania", name: text("大洋洲", "Oceania") },
  { id: "africa", name: text("非洲", "Africa") },
] satisfies { id: FirstBatchContinentId; name: LocalizedText }[];

type CitySpec = readonly [
  slug: string,
  zh: string,
  en: string,
  countryId: string,
  continentId: FirstBatchContinentId,
  position?: readonly [latitude: number, longitude: number, wikidataId: string],
];

const citySpecs: CitySpec[] = [
  ["beijing", "北京", "Beijing", "cn", "asia"],
  [
    "shanghai",
    "上海",
    "Shanghai",
    "cn",
    "asia",
    [31.2325, 121.469167, "Q8686"],
  ],
  [
    "shenzhen",
    "深圳",
    "Shenzhen",
    "cn",
    "asia",
    [22.546667, 114.054444, "Q15174"],
  ],
  ["hangzhou", "杭州", "Hangzhou", "cn", "asia", [30.25, 120.1675, "Q4970"]],
  [
    "hong-kong",
    "香港",
    "Hong Kong",
    "cn",
    "asia",
    [22.278333, 114.158611, "Q8646"],
  ],
  ["taipei", "台北", "Taipei", "cn", "asia"],
  ["tokyo", "东京", "Tokyo", "jp", "asia"],
  ["kyoto", "京都", "Kyoto", "jp", "asia", [35.011611, 135.768111, "Q34600"]],
  [
    "sapporo",
    "札幌",
    "Sapporo",
    "jp",
    "asia",
    [43.061944, 141.354444, "Q37951"],
  ],
  ["seoul", "首尔", "Seoul", "kr", "asia"],
  ["pyongyang", "平壤", "Pyongyang", "kp", "asia"],
  ["singapore", "新加坡", "Singapore", "sg", "asia"],
  ["kuala-lumpur", "吉隆坡", "Kuala Lumpur", "my", "asia"],
  ["bangkok", "曼谷", "Bangkok", "th", "asia"],
  ["hanoi", "河内", "Hanoi", "vn", "asia"],
  ["manila", "马尼拉", "Manila", "ph", "asia"],
  ["jakarta", "雅加达", "Jakarta", "id", "asia"],
  ["new-delhi", "新德里", "New Delhi", "in", "asia"],
  ["london", "伦敦", "London", "gb", "europe"],
  [
    "manchester",
    "曼彻斯特",
    "Manchester",
    "gb",
    "europe",
    [53.479444, -2.245278, "Q18125"],
  ],
  ["paris", "巴黎", "Paris", "fr", "europe"],
  ["berlin", "柏林", "Berlin", "de", "europe"],
  ["rome", "罗马", "Rome", "it", "europe"],
  ["madrid", "马德里", "Madrid", "es", "europe"],
  [
    "barcelona",
    "巴塞罗那",
    "Barcelona",
    "es",
    "europe",
    [41.3825, 2.176944, "Q1492"],
  ],
  ["moscow", "莫斯科", "Moscow", "ru", "europe"],
  [
    "saint-petersburg",
    "圣彼得堡",
    "Saint Petersburg",
    "ru",
    "europe",
    [59.95, 30.316667, "Q656"],
  ],
  ["washington-dc", "华盛顿", "Washington, D.C.", "us", "north-america"],
  ["new-york", "纽约", "New York City", "us", "north-america"],
  [
    "los-angeles",
    "洛杉矶",
    "Los Angeles",
    "us",
    "north-america",
    [34.05223, -118.24368, "Q65"],
  ],
  [
    "san-francisco",
    "旧金山",
    "San Francisco",
    "us",
    "north-america",
    [37.775, -122.419444, "Q62"],
  ],
  [
    "chicago",
    "芝加哥",
    "Chicago",
    "us",
    "north-america",
    [41.881944, -87.627778, "Q1297"],
  ],
  ["ottawa", "渥太华", "Ottawa", "ca", "north-america"],
  [
    "toronto",
    "多伦多",
    "Toronto",
    "ca",
    "north-america",
    [43.670278, -79.386667, "Q172"],
  ],
  [
    "vancouver",
    "温哥华",
    "Vancouver",
    "ca",
    "north-america",
    [49.260833, -123.113889, "Q24639"],
  ],
  ["mexico-city", "墨西哥城", "Mexico City", "mx", "north-america"],
  ["brasilia", "巴西利亚", "Brasilia", "br", "south-america"],
  [
    "rio-de-janeiro",
    "里约热内卢",
    "Rio de Janeiro",
    "br",
    "south-america",
    [-22.911111, -43.205556, "Q8678"],
  ],
  [
    "sao-paulo",
    "圣保罗",
    "Sao Paulo",
    "br",
    "south-america",
    [-23.550394, -46.633947, "Q174"],
  ],
  ["buenos-aires", "布宜诺斯艾利斯", "Buenos Aires", "ar", "south-america"],
  ["canberra", "堪培拉", "Canberra", "au", "oceania"],
  ["sydney", "悉尼", "Sydney", "au", "oceania", [-33.867778, 151.21, "Q3130"]],
  [
    "melbourne",
    "墨尔本",
    "Melbourne",
    "au",
    "oceania",
    [-37.814167, 144.963056, "Q3141"],
  ],
  ["wellington", "惠灵顿", "Wellington", "nz", "oceania"],
  [
    "auckland",
    "奥克兰",
    "Auckland",
    "nz",
    "oceania",
    [-36.849167, 174.765278, "Q37100"],
  ],
  ["cairo", "开罗", "Cairo", "eg", "africa"],
  ["abuja", "阿布贾", "Abuja", "ng", "africa"],
  ["nairobi", "内罗毕", "Nairobi", "ke", "africa"],
  ["addis-ababa", "亚的斯亚贝巴", "Addis Ababa", "et", "africa"],
  ["rabat", "拉巴特", "Rabat", "ma", "africa"],
  ["algiers", "阿尔及尔", "Algiers", "dz", "africa"],
  ["accra", "阿克拉", "Accra", "gh", "africa"],
];

export const firstBatchCities: FirstBatchCity[] = citySpecs.map(
  ([slug, zh, en, countryId, continentId, fallback]) => {
    const id = `city-${slug}`;
    const existing = getEarthCity(id);
    const position =
      existing?.coordinates ??
      (fallback
        ? { latitude: fallback[0], longitude: fallback[1] }
        : undefined);
    if (!position) throw new Error(`Source position missing for ${id}`);
    const country = getCountryEntry(countryId);
    if (!country)
      throw new Error(`Unknown country/territory group ${countryId}`);
    const countryName =
      countryId === "cn" ? text("中国组", "China group") : country.name;
    const capital =
      countryId === "cn"
        ? id === "city-beijing"
        : Boolean(existing?.tags.includes("capital"));
    return {
      id,
      name: text(zh, en),
      label: text(`${countryName.zh} · ${zh}`, `${countryName.en} · ${en}`),
      ...position,
      capital,
      featured: true,
      countryId,
      countryName,
      continentId,
      sourceUrls:
        fallback && !existing?.coordinates
          ? [`https://www.wikidata.org/wiki/${fallback[2]}`]
          : [directoryUrl],
    };
  },
);

export const firstBatchCountries = [
  ...new Map(
    firstBatchCities.map((city) => [
      `${city.continentId}:${city.countryId}`,
      {
        id: city.countryId,
        name: city.countryName,
        continentId: city.continentId,
      },
    ]),
  ).values(),
];

interface CheckedCityPhoto {
  cityId: string;
  path: string;
  sourceUrl: string;
  author: string;
  date: string;
  license: string;
  licenseUrl: string;
  subject: LocalizedText;
  review: "source-checked";
  dateNote?: LocalizedText;
}

const imageProcessing = text(
  "使用 Wikimedia 提供的尺寸版本；未本地裁剪、调色或合成。原作者的裁剪、拼接、HDR 或修正记录见原始文件页；照片保留各自原许可。",
  "Wikimedia-provided size variant; no local crop, recoloring or compositing. See the original file record for any crop, stitching, HDR or corrections by its authors; each photograph retains its own license.",
);

function reviewedPhoto(record: CheckedCityPhoto): ImmersiveHotspotImage {
  return {
    path: record.path,
    sourceUrl: record.sourceUrl,
    credit: `${record.author} / Wikimedia Commons / ${record.license}`,
    date: record.date,
    license: record.license,
    licenseUrl: record.licenseUrl,
    caption: text(
      `${record.subject.zh}，拍于 ${record.date}。地点或城市背景配图，不是下述历史事件、建成或遗产列名的现场照片。${record.dateNote?.zh ?? ""}`,
      `${record.subject.en}, photographed ${record.date}. A place or city-context illustration, not a photograph of the historical event, construction or heritage-inscription decision below.${record.dateNote?.en ? ` ${record.dateNote.en}` : ""}`,
    ),
    processing: imageProcessing,
  };
}

type CityFactSpec = readonly [
  slug: string,
  introduction: LocalizedText,
  title: LocalizedText,
  date: string,
  description: LocalizedText,
  sourceUrls: string[],
  imageIndices?: number[],
];
const unesco = (id: string) => `https://whc.unesco.org/en/list/${id}/`;
const factSpecs: CityFactSpec[] = [
  [
    "shenzhen",
    text(
      "深圳把工业、建筑与设计联系在一起。深圳湾和华强北提供了观察城市滨水空间与商业街区的不同起点。",
      "Shenzhen connects industry, architecture and design. Shenzhen Bay and Huaqiangbei offer different starting points for exploring waterfront space and commercial streets.",
    ),
    text("加入设计之都网络", "Joining the Creative Cities of Design network"),
    "2008",
    text(
      "深圳于 2008 年加入 UNESCO 创意城市网络，领域为设计。这个城市主题强调设计与文化交流；深圳湾和华强北照片是城市背景，不是加入网络的活动现场。",
      "Shenzhen joined the UNESCO Creative Cities Network in the field of Design in 2008. This theme connects design with cultural exchange; Shenzhen Bay and Huaqiangbei photographs illustrate the city, not the network-admission event.",
    ),
    ["https://www.unesco.org/en/creative-cities/shenzhen"],
  ],
  [
    "hangzhou",
    text(
      "杭州西湖把湖水、堤道、园林和城市连接起来，是观察人与自然共同营造景观的一个例子。",
      "Hangzhou's West Lake connects water, causeways, gardens and city life, illustrating a landscape shaped by both nature and people.",
    ),
    text("西湖文化景观列名", "West Lake Cultural Landscape inscription"),
    "2011",
    text(
      "西湖文化景观于 2011 年列入《世界遗产名录》。堤道、岛屿与园林体现了长期的景观营造传统；遗产范围是特定文化景观，不是整个杭州市。西湖照片是地点配图，不记录列名决议；灵隐寺照片仅作另一处杭州地标，不据此判定它属于列名范围。",
      "The West Lake Cultural Landscape entered the World Heritage List in 2011. Causeways, islands and gardens reflect a long landscape-design tradition. The property is a specific cultural landscape, not all Hangzhou. The lake photograph does not depict the inscription decision; Lingyin Temple is a separate Hangzhou landmark, without a claim here about inclusion within the inscribed boundary.",
    ),
    [unesco("1334")],
    [0],
  ],
  [
    "hong-kong",
    text(
      "香港会展中心把大型公共建筑、滨水空间与展览交流联系起来，建筑的不同视角帮助观察工程与城市的关系。",
      "Hong Kong Convention and Exhibition Centre connects a major public building, waterfront space and exhibition exchange. Different views reveal relationships between engineering and the city.",
    ),
    text("香港会展中心开放与扩建", "HKCEC opens and expands"),
    "1988",
    text(
      "香港会展中心于 1988 年开放，1997 年完成第一次扩建，2009 年完成第二次扩建。建筑阶段的变化让人认识展览设施与城市空间的持续发展。图库展示会展中心的不同视角，不冒充开放、扩建施工或竣工典礼现场。",
      "HKCEC opened in 1988, with its first expansion in 1997 and second expansion completed in 2009. These building stages introduce the continuing development of exhibition facilities and urban space. The gallery shows different views of HKCEC, not its opening, construction work or completion ceremonies.",
    ),
    ["https://www.hkcec.com/en/image-gallery"],
  ],
  [
    "taipei",
    text(
      "台北的故宫博物院把文物收藏、研究和公共教育联系起来。馆舍外观与馆内文物、历史活动分别记录。",
      "Taipei's National Palace Museum connects artifact collections, research and public education. Views of the building are distinguished from its collections and historical events.",
    ),
    text(
      "故宫博物院台北院区对公众开放",
      "National Palace Museum opens to the public in Taipei",
    ),
    "1965-11-13",
    text(
      "故宫博物院在台北的新馆于 1965 年 11 月 13 日正式向公众开放，前一日为内部开放。文物编目、研究与教育是其博物馆工作的组成部分。图库展示台北院区馆舍外观，不冒充馆内文物、1965 年开馆现场或当时的建筑原貌。",
      "The National Palace Museum's new Taipei building officially opened to the public on November 13, 1965, following an internal opening the previous day. Cataloguing, research and education form part of its museum work. The gallery illustrates the Taipei museum's exterior, not its artifacts, 1965 opening or the building's exact appearance at that time.",
    ),
    ["https://www.npm.gov.tw/Articles.aspx?l=2&sno=03012532"],
  ],
  [
    "kyoto",
    text(
      "京都的寺院、木构建筑和园林提供了一组理解传统建筑与文化保护的线索。",
      "Kyoto's temples, timber buildings and gardens provide perspectives on traditional architecture and cultural conservation.",
    ),
    text(
      "古京都遗产系列列名",
      "Historic Monuments of Ancient Kyoto inscription",
    ),
    "1994",
    text(
      "古京都遗址于 1994 年列入《世界遗产名录》，是一组分布在京都、宇治和大津的遗产，不是所有京都建筑。其木构建筑和园林反映长期的设计传统；图库中的具体地标独立标注，不是列名活动照片。",
      "The Historic Monuments of Ancient Kyoto entered the World Heritage List in 1994. The serial property spans Kyoto, Uji and Otsu rather than all buildings in Kyoto. Its timber architecture and gardens reflect long design traditions; the named landmarks are not photographs of the inscription event.",
    ),
    [unesco("688")],
  ],
  [
    "sapporo",
    text(
      "札幌钟楼把城市生活中的报时功能与学校教育的历史连接起来。保存木构建筑也需要持续维护。",
      "Sapporo's Clock Tower connects public timekeeping with the history of school education. Conserving a timber building also requires continuing maintenance.",
    ),
    text("农学校演武场建成", "Agricultural-school drill hall built"),
    "1878",
    text(
      "札幌钟楼所在建筑于 1878 年作为札幌农学校演武场建成，该校是北海道大学的前身。建筑建成与后续安装时钟不是同一事件；图库中的 2008 和 2018 年外观不冒充 1878 年现场。",
      "The building now known as Sapporo Clock Tower was constructed in 1878 as a drill hall for Sapporo Agricultural School, a predecessor of Hokkaido University. Construction and later clock installation were separate milestones; the 2008 and 2018 exterior photographs are not 1878 event records.",
    ),
    ["https://www.sapporo.travel/en/spot/facility/clock_tower/"],
  ],
  [
    "pyongyang",
    text(
      "平壤沿大同江展开。城市景观是了解地域的背景，周边古墓的壁画则为研究过去的日常生活提供另一类证据。",
      "Pyongyang extends along the Taedong River. City views provide geographic context, while murals in regional tombs offer a different kind of evidence about past daily life.",
    ),
    text("高句丽古墓群的文化研究", "Cultural study of the Koguryo tombs"),
    "2004",
    text(
      "位于平壤及周边地区的高句丽古墓群于 2004 年列入《世界遗产名录》，部分墓室壁画保存了服饰和生活习俗的线索。图库是平壤与大同江的现代城市背景，不是墓群、壁画或列名现场照片，也不意味着整座平壤为该遗产。",
      "The Complex of Koguryo Tombs in Pyongyang and surrounding regions entered the World Heritage List in 2004. Some tomb murals preserve evidence of clothing and daily customs. These modern Pyongyang and Taedong River photographs provide city context, not views of the tombs, murals or inscription event; the property is not all Pyongyang.",
    ),
    [unesco("1091")],
  ],
  [
    "kuala-lumpur",
    text(
      "吉隆坡的双塔让人从建筑形态认识现代工程；不同照片展示同一城市地标的不同角度。",
      "Kuala Lumpur's twin towers introduce modern engineering through architectural form. Separate photographs show different views of the same city landmark.",
    ),
    text("双塔正式开放", "Petronas Twin Towers officially opens"),
    "1999",
    text(
      "PETRONAS 双塔于 1999 年正式开放。建成、使用与正式开放可以有不同时间口径，因此这里不把“1998 年高度纪录”当作开幕时间。现代地标照片用于观察建筑，不是开幕式现场。",
      "PETRONAS Twin Towers officially opened in 1999. Completion, occupation and an official opening can have different dates; the 1998 height-record milestone is not treated as the opening date here. Later landmark photographs illustrate the architecture, not the opening ceremony.",
    ),
    [
      "https://www.petronas.com/sites/default/files/uploads/content/2022/petronas-annual-report-2017.pdf",
    ],
  ],
  [
    "bangkok",
    text(
      "曼谷卧佛寺的建筑与石刻让文化保存和公共知识传播联系在一起。",
      "Bangkok's Wat Pho connects architectural heritage and stone inscriptions with the preservation and sharing of knowledge.",
    ),
    text("卧佛寺石刻档案登记", "Wat Pho inscription archives registered"),
    "2011",
    text(
      "卧佛寺石刻档案于 2011 年进入 UNESCO 世界记忆名录。其 1831 至 1841 年制作的石刻涉及宗教与世俗知识，并具有公众教育目的。寺院建筑照片只是地点背景，不冒充石刻逐字记录；世界记忆登记也不等于世界遗产列名。",
      "Wat Pho's epigraphic archives entered UNESCO's Memory of the World Register in 2011. The 1831–1841 inscriptions cover religious and secular knowledge and were intended for public education. Temple photographs provide site context rather than a transcription of the inscriptions; Memory of the World registration is not World Heritage inscription.",
    ),
    ["https://www.unesco.org/en/memory-world/epigraphic-archives-wat-pho"],
  ],
  [
    "hanoi",
    text(
      "河内升龙皇城的建筑和考古遗存，让城市里多个历史阶段的文化联系可以被研究。",
      "Hanoi's Thang Long Imperial Citadel connects buildings and archaeological remains with the study of multiple layers of urban history.",
    ),
    text("升龙皇城中心区列名", "Central Sector of Thang Long inscription"),
    "2010",
    text(
      "河内升龙皇城中心区于 2010 年列入《世界遗产名录》，包括皇城建筑与黄耀街 18 号考古遗址的证据。遗产是特定中心区，而不是整个河内；现代皇城照片不记录列名决议。",
      "The Central Sector of the Imperial Citadel of Thang Long entered the World Heritage List in 2010, connecting citadel buildings with evidence from the 18 Hoang Dieu archaeological site. It is a specific central sector, not all Hanoi; later citadel photographs do not depict the inscription decision.",
    ),
    [unesco("1328")],
  ],
  [
    "manila",
    text(
      "马尼拉的圣奥古斯丁教堂展示建筑工艺在不同文化之间的交流，城市公共空间提供另一种观察角度。",
      "Manila's San Agustin Church introduces the exchange of building techniques across cultures, with public spaces providing another perspective on the city.",
    ),
    text("巴洛克教堂系列列名", "Baroque Churches serial-property inscription"),
    "1993",
    text(
      "菲律宾巴洛克教堂于 1993 年列入《世界遗产名录》，包括马尼拉的圣奥古斯丁教堂及另外三地的教堂。其建筑反映欧洲形式与菲律宾、中国工匠的再创造。黎刹纪念碑只作同城背景，不是该教堂系列的组成部分。",
      "The Baroque Churches of the Philippines entered the World Heritage List in 1993, including San Agustin in Manila and churches in three other locations. Their architecture reflects European forms reinterpreted by Philippine and Chinese craftspeople. Rizal Monument provides city context only and is not a component of this church property.",
    ),
    [unesco("677")],
    [0],
  ],
  [
    "jakarta",
    text(
      "雅加达历史博物馆与法塔希拉广场，让一座旧建筑在公共空间中继续承担历史教育的角色。",
      "Jakarta History Museum and Fatahillah Square show an older building continuing to serve historical education within public space.",
    ),
    text("历史博物馆设立", "Jakarta History Museum established"),
    "1974",
    text(
      "雅加达市政府资料记载，这座旧建筑于 1974 年成为雅加达历史博物馆，展示城市多个历史时期的实物与复制品。两张 2025 年照片记录博物馆与广场的不同视角，不是博物馆设立时的现场。",
      "Jakarta's city-government record dates the building's conversion into Jakarta History Museum to 1974. Its collections introduce multiple periods of city history through objects and replicas. Two different 2025 views depict the museum and square, not its establishment event.",
    ),
    ["https://www.jakarta.go.id/museum"],
  ],
  [
    "new-delhi",
    text(
      "新德里入口关联更广阔德里城市区域中的花园陵墓与石塔，认识历史建筑如何联系园林和结构设计。",
      "The New Delhi entry connects landmarks in the wider Delhi urban area: a garden tomb and stone tower that introduce landscape and structural design.",
    ),
    text("胡马雍陵的花园建筑", "Humayun's Tomb and garden architecture"),
    "1993",
    text(
      "德里的胡马雍陵于 1993 年列入《世界遗产名录》。陵墓与花园布局是莫卧儿建筑研究的重要线索。库特卜塔属于另一处遗产，不是胡马雍陵的一部分；城市示意锚点也不是两座地标的精确位置。",
      "Humayun's Tomb in Delhi entered the World Heritage List in 1993. Its tomb-and-garden plan provides evidence for studying Mughal architecture. Qutb Minar is a separate property, not part of Humayun's Tomb; the city anchor is not the precise position of either landmark.",
    ),
    [unesco("232")],
    [0],
  ],
  [
    "manchester",
    text(
      "曼彻斯特的科学与工业博物馆把铁路、机器和城市发展放在可以学习的历史环境中。",
      "Manchester's Science and Industry Museum connects railways, machines and city development within a setting for learning about history.",
    ),
    text("利物浦路铁路车站开放", "Liverpool Road railway station opens"),
    "1830",
    text(
      "利物浦与曼彻斯特铁路于 1830 年开放，曼彻斯特的利物浦路旧车站后来成为科学与工业博物馆园区的一部分。铁路遗产让交通工程与公共教育产生联系。图中的博物馆标识与约翰赖兰兹图书馆是现代地点配图，不是 1830 年的列车现场。",
      "The Liverpool and Manchester Railway opened in 1830; Manchester's former Liverpool Road station later became part of the Science and Industry Museum site. Railway heritage connects transport engineering with public education. The museum sign and John Rylands Library photographs illustrate places, not an 1830 train event.",
    ),
    [
      "https://blog.scienceandindustrymuseum.org.uk/transforming-liverpool-road-station/",
    ],
    [0],
  ],
  [
    "berlin",
    text(
      "柏林博物馆岛把不同的博物馆建筑连接成一个文化学习区域，可以比较建筑如何为收藏服务。",
      "Berlin's Museum Island links distinct museum buildings into a cultural-learning setting, inviting comparisons between architecture and the collections it houses.",
    ),
    text("博物馆岛列名", "Museum Island inscription"),
    "1999",
    text(
      "博物馆岛于 1999 年列入《世界遗产名录》。五座博物馆的建设跨越 1824 至 1930 年，展示博物馆设计的演变。图库分别展示老博物馆与旧国家美术馆，不是整个柏林或列名活动现场。",
      "Museum Island entered the World Heritage List in 1999. Its five museums were built between 1824 and 1930, illustrating changes in museum design. The gallery separately shows the Altes Museum and Alte Nationalgalerie, not all Berlin or the inscription event.",
    ),
    [unesco("896")],
  ],
  [
    "rome",
    text(
      "罗马的斗兽场与古罗马广场使不同类型的古代公共建筑可以被对照观察，文化保护帮助这些遗存被持续研究。",
      "Rome's Colosseum and Roman Forum allow different forms of ancient public architecture to be compared, with conservation supporting continuing study.",
    ),
    text("历史中心列名", "Historic Centre inscription"),
    "1980",
    text(
      "罗马历史中心于 1980 年列入《世界遗产名录》，1990 年扩展了列名范围。遗产包含城市多层历史，不是把整个现代罗马冻结成同一时代。现代斗兽场与广场照片是遗存配图，不是古代活动或列名决议的现场记录。",
      "Rome's Historic Centre entered the World Heritage List in 1980, with a significant extension in 1990. The property reflects layered history rather than all modern Rome belonging to one period. Modern Colosseum and Forum photographs show remains, not ancient events or the inscription decision.",
    ),
    [unesco("91")],
  ],
  [
    "madrid",
    text(
      "马德里把博物馆、园林与公共步道连接起来，艺术和自然科学可以在同一城市景观中被认识。",
      "Madrid connects museums, gardens and public promenades, bringing art and natural science into one urban landscape.",
    ),
    text("艺术与科学景观列名", "Landscape of Arts and Sciences inscription"),
    "2021",
    text(
      "普拉多大道与丽池公园于 2021 年以“艺术与科学景观”列入《世界遗产名录》。这一特定区域联系文化机构、绿地与公众空间；普拉多博物馆和丽池公园照片展示地点，不是整个马德里或列名现场。",
      "Paseo del Prado and Buen Retiro entered the World Heritage List in 2021 as a Landscape of Arts and Sciences. This specific area connects cultural institutions, greenery and public spaces; the Prado Museum and Retiro Park photographs illustrate places, not all Madrid or the inscription event.",
    ),
    [unesco("1618")],
  ],
  [
    "barcelona",
    text(
      "巴塞罗那的圭尔公园与巴特罗之家展现高迪把建筑、装饰与景观联系起来的设计方式。",
      "Barcelona's Park Guell and Casa Batllo introduce Gaudi's connections between architecture, decoration and landscape.",
    ),
    text("高迪建筑遗产系列扩展", "Works of Antoni Gaudi property extended"),
    "2005",
    text(
      "高迪建筑作品最初于 1984 年列入《世界遗产名录》，2005 年扩展后包括巴特罗之家等建筑。圭尔公园与巴特罗之家是不同组成部分；现代地标照片不记录建造过程或列名决议。",
      "Works of Antoni Gaudi first entered the World Heritage List in 1984 and was extended in 2005 to include Casa Batllo and other works. Park Guell and Casa Batllo are different components; modern landmark photographs do not depict construction or inscription decisions.",
    ),
    [unesco("320")],
  ],
  [
    "saint-petersburg",
    text(
      "圣彼得堡的河道、桥梁与博物馆建筑构成一个可观察的城市规划与文化收藏环境。",
      "Saint Petersburg's waterways, bridges and museum buildings offer perspectives on urban planning and cultural collections.",
    ),
    text(
      "历史中心及相关古迹群列名",
      "Historic Centre and related monuments inscription",
    ),
    "1990",
    text(
      "圣彼得堡历史中心及相关古迹群于 1990 年列入《世界遗产名录》。其城市规划与巴洛克、古典建筑共同组成文化景观。图库中的具体地标独立标名；这里按城市位置归入欧洲，不代表整个俄罗斯只在欧洲。",
      "Saint Petersburg's Historic Centre and Related Groups of Monuments entered the World Heritage List in 1990. Urban planning, Baroque and neoclassical buildings shape its cultural landscape. Each photographed landmark is named separately. The city is grouped by its European location, not a claim that all Russia is in Europe.",
    ),
    [unesco("540")],
  ],
  [
    "los-angeles",
    text(
      "洛杉矶格里菲斯天文台把观测天空与公共科学教育结合起来，周边公园则提供观察城市与山地环境的视角。",
      "Los Angeles's Griffith Observatory connects sky observation with public science education, while its surrounding park offers a view of city and hillside environments.",
    ),
    text("公共天文台开放", "Public observatory opens"),
    "1935-05-14",
    text(
      "格里菲斯天文台于 1935 年 5 月 14 日落成开放，为公众提供天文学习与观测机会。2006 年的天文台照片与公园林地照片是后期地点配图，不是开馆现场，也不是某次天文观测的实测影像。",
      "Griffith Observatory was dedicated on May 14, 1935, offering public opportunities to learn astronomy and observe the sky. The 2006 observatory photograph and park-woodland photograph are later site illustrations, not the opening or measured images from an astronomical observation.",
    ),
    ["https://griffithobservatory.lacity.gov/about/observatory-history/"],
    [0],
  ],
  [
    "san-francisco",
    text(
      "旧金山金门大桥把海湾两岸的交通与悬索桥工程联系起来，也成为认识海峡环境的一个起点。",
      "San Francisco's Golden Gate Bridge connects transport across the bay with suspension-bridge engineering and the environment of the strait.",
    ),
    text("金门大桥开放", "Golden Gate Bridge opens"),
    "1937-05-27",
    text(
      "金门大桥于 1937 年 5 月 27 日先向行人开放，翌日开放汽车通行。两个日期对应不同交通阶段，而不是相互矛盾的开桥时间。图库中的现代桥梁照片用于观察结构与环境，不是 1937 年庆典现场。",
      "Golden Gate Bridge opened to pedestrians on May 27, 1937, and to vehicles the following day. The dates describe distinct stages rather than conflicting opening dates. Modern bridge photographs illustrate structure and setting, not the 1937 festivities.",
    ),
    [
      "https://www.goldengate.org/bridge/history-research/moments-events/key-dates/",
    ],
  ],
  [
    "chicago",
    text(
      "芝加哥文化中心所在建筑从公共图书馆发展为文化活动空间，连接建筑保护与公众学习。",
      "Chicago Cultural Center's building evolved from a public library into a cultural venue, connecting architectural conservation and public learning.",
    ),
    text("中央图书馆馆舍开放", "Central Library building opens"),
    "1897",
    text(
      "芝加哥公共图书馆的中央馆于 1897 年在今天文化中心所在建筑开放。这座建筑于 1977 年经过改造、重新开放并更名为文化中心。图库中的 2021 与 2022 年照片展示今天的建筑，不是 1897 年开馆或 1977 年重新开放活动。",
      "Chicago Public Library's Central Library opened in 1897 in the building that is now the Cultural Center. Following renovation, it reopened and was renamed the Cultural Center in 1977. The 2021 and 2022 gallery photographs show the later building, not the 1897 opening or 1977 reopening events.",
    ),
    [
      "https://www.chipublib.org/cpl-history/",
      "https://www.chipublib.org/chicago-cultural-center-opening-day-digital-collection/",
    ],
  ],
  [
    "ottawa",
    text(
      "渥太华的丽都运河让水利工程、交通历史与城市公共空间相连，河岸视角也能认识周边建筑。",
      "Ottawa's Rideau Canal connects hydraulic engineering, transport history and urban public space, with waterfront views introducing nearby buildings.",
    ),
    text("丽都运河列名", "Rideau Canal inscription"),
    "2007",
    text(
      "丽都运河于 2007 年列入《世界遗产名录》。这条约 202 公里的历史水道连接渥太华与金斯顿，使用水闸等设施调节通航条件。图库展示渥太华段及其城市环境，不代表整条运河，也不是列名活动现场。",
      "Rideau Canal entered the World Heritage List in 2007. This roughly 202-kilometer historic waterway connects Ottawa and Kingston and uses locks and other structures to support navigation. The photographs illustrate its Ottawa setting, not the entire canal or inscription event.",
    ),
    [unesco("1221")],
  ],
  [
    "toronto",
    text(
      "多伦多的加拿大国家电视塔与皇家安大略博物馆分别提供工程与文化学习的视角。",
      "Toronto's CN Tower and Royal Ontario Museum offer complementary perspectives on engineering and cultural learning.",
    ),
    text("加拿大国家电视塔开放", "CN Tower opens"),
    "1976-06-26",
    text(
      "加拿大国家电视塔于 1976 年 6 月 26 日向公众开放。塔楼建筑可作为认识大型工程的起点；皇家安大略博物馆是另一处同城机构，不是电视塔的一部分。后期照片不记录 1976 年开放现场。",
      "CN Tower opened to the public on June 26, 1976. The tower introduces large-scale engineering; Royal Ontario Museum is a separate institution, not part of it. Later photographs do not record the 1976 opening.",
    ),
    ["https://www.mint.ca/en-us/blog/2026-04-history-of-the-cn-tower"],
    [0],
  ],
  [
    "vancouver",
    text(
      "温哥华斯坦利公园让森林、海岸和城市日常生活紧密相连，保护城市生态需要长期管理。",
      "Vancouver's Stanley Park connects forest, shoreline and everyday city life, with urban-ecology conservation requiring long-term management.",
    ),
    text("斯坦利公园开放", "Stanley Park opens"),
    "1888",
    text(
      "斯坦利公园于 1888 年开放。温哥华市的资料将生态保护、可持续性与公众享用列为其持续管理主题。2022 年不同角度的公园照片展示当时的地点环境，不是 1888 年开放活动或当前实时画面。",
      "Stanley Park opened in 1888. Vancouver's city record identifies ecology, sustainability and public enjoyment as continuing management themes. Different 2022 views illustrate the park at that time, not the 1888 opening or a current live scene.",
    ),
    [
      "https://vancouver.ca/parks-recreation-culture/stanley-park-story.aspx?mgid=18083",
    ],
  ],
  [
    "mexico-city",
    text(
      "墨西哥城历史中心的广场与建筑保存着多个城市时代的线索，文化保护需要理解这些不同层次。",
      "Mexico City's Historic Centre preserves evidence of multiple urban periods in its squares and buildings, requiring conservation to understand these layers.",
    ),
    text(
      "历史中心与霍奇米尔科列名",
      "Historic Centre and Xochimilco inscription",
    ),
    "1987",
    text(
      "墨西哥城历史中心与霍奇米尔科于 1987 年列入《世界遗产名录》。图库展示大教堂与宪法广场，不代表另一个区域霍奇米尔科的运河，也不是整个现代墨西哥城都被列名。照片不是列名决议现场。",
      "The Historic Centre of Mexico City and Xochimilco entered the World Heritage List in 1987. The gallery shows the cathedral and Zocalo, not Xochimilco's canals in a different area; the listing does not encompass all modern Mexico City. These photographs do not depict the inscription decision.",
    ),
    [unesco("412")],
  ],
  [
    "brasilia",
    text(
      "巴西利亚把城市规划与现代建筑结合起来，国会与主教座堂的不同形态可以作为比较设计的实例。",
      "Brasilia connects urban planning with modern architecture; the Congress and cathedral offer contrasting forms for comparing design.",
    ),
    text("规划城市列名", "Planned-city inscription"),
    "1987",
    text(
      "巴西利亚于 1987 年列入《世界遗产名录》。卢西奥·科斯塔的规划与奥斯卡·尼迈尔的建筑共同构成其现代城市设计主题。图库建筑照片分别拍摄，不是规划图，也不代表列名活动或整座城市的每个街区。",
      "Brasilia entered the World Heritage List in 1987. Lucio Costa's planning and Oscar Niemeyer's buildings contribute to its modern urban-design theme. The separate building photographs are not a planning map, an inscription event or a representation of every district.",
    ),
    [unesco("445")],
  ],
  [
    "rio-de-janeiro",
    text(
      "里约热内卢的山地、海湾与城市景观紧密相连，让自然环境与文化活动可以一起观察。",
      "Rio de Janeiro's mountains, bay and cityscape connect natural surroundings with cultural activity.",
    ),
    text("山海之间的文化景观列名", "Carioca Landscapes inscription"),
    "2012",
    text(
      "里约“山与海之间的卡里奥卡景观”于 2012 年列入《世界遗产名录》。该景观联系蒂茹卡山地、科尔科瓦多山及海湾周边的设计环境。糖面包山与基督像照片是地点配图，不是列名现场；这不意味着整座城市所有建筑都属于同一遗产。",
      "Rio's Carioca Landscapes between the Mountain and the Sea entered the World Heritage List in 2012. The property connects Tijuca's mountains, Corcovado and designed settings around the bay. Sugarloaf Mountain and Christ statue photographs illustrate places, not the inscription; not every building in Rio belongs to the property.",
    ),
    [unesco("1100")],
  ],
  [
    "sao-paulo",
    text(
      "圣保罗的艺术机构连接收藏、公众学习与现代建筑，保利斯塔大道上的 MASP 提供了一个具体例子。",
      "Sao Paulo's art institutions connect collections, public learning and modern architecture, with MASP on Paulista Avenue as a concrete example.",
    ),
    text("MASP 迁入保利斯塔大道馆舍", "MASP moves to Paulista Avenue"),
    "1968",
    text(
      "圣保罗艺术博物馆 MASP 于 1968 年迁入莉娜·博·巴尔迪设计的保利斯塔大道馆舍。保利斯塔大道的空中照片展示 MASP 周边；州立美术馆是另一个机构，不是 MASP 的馆舍或迁馆现场。",
      "MASP moved in 1968 to its Paulista Avenue building designed by Lina Bo Bardi. The avenue's aerial photograph shows MASP's urban context; the Pinacoteca is a different institution, not MASP's building or a record of its move.",
    ),
    ["https://masp.org.br/en/about"],
    [0],
  ],
  [
    "buenos-aires",
    text(
      "布宜诺斯艾利斯的科隆剧院把音乐演出与建筑设计联系起来，公共广场则展示另一种城市共享空间。",
      "Buenos Aires's Teatro Colon connects musical performance and architectural design, while public squares offer another form of shared urban space.",
    ),
    text("科隆剧院开幕", "Teatro Colon opens"),
    "1908-05-25",
    text(
      "今天的科隆剧院于 1908 年 5 月 25 日开幕。剧院的建筑与演出历史可以作为文化交流的学习线索；五月广场只是同城背景，不是剧院内部或开幕场地。2024 与 2025 年照片不冒充 1908 年现场。",
      "The present Teatro Colon opened on May 25, 1908. Its architecture and performance history provide a perspective on cultural exchange. Plaza de Mayo provides city context, not the theater interior or opening venue. The 2024 and 2025 photographs do not depict the 1908 event.",
    ),
    ["https://teatrocolon.org.ar/el-teatro/"],
    [0],
  ],
  [
    "canberra",
    text(
      "堪培拉的公共建筑把城市规划、建筑设计与历史教育联系起来。不同机构通过独立图注区分。",
      "Canberra's public buildings connect urban planning, architecture and historical education. Independent captions distinguish their different institutions.",
    ),
    text("永久国会大厦开放", "Permanent Parliament House opens"),
    "1988-05-09",
    text(
      "堪培拉今天的永久国会大厦于 1988 年 5 月 9 日开放，与 1927 年的临时国会大厦不是同一建筑。澳大利亚国家博物馆是另一个同城机构。后期地点照片不是开幕活动，也不把建筑图当作制度评价。",
      "Canberra's present permanent Parliament House opened on May 9, 1988; it is not the provisional building opened in 1927. National Museum of Australia is a separate institution. Later site photographs do not record the opening or imply an assessment of political institutions.",
    ),
    [
      "https://www.aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/parliament_house_chronology/The_official_opening",
    ],
    [0],
  ],
  [
    "sydney",
    text(
      "悉尼歌剧院把艺术活动与结构工程结合起来，港湾环境使建筑与交通地标形成可观察的联系。",
      "Sydney Opera House connects performing arts and structural engineering, with its harbor setting linking architecture to transport landmarks.",
    ),
    text("悉尼歌剧院落成", "Sydney Opera House inaugurated"),
    "1973",
    text(
      "悉尼歌剧院于 1973 年落成，其相互连接的壳体屋顶体现建筑师与工程师的合作。悉尼港大桥是另一个地标，不是歌剧院结构的一部分。现代港湾照片用于认识地点，不是落成活动现场。",
      "Sydney Opera House was inaugurated in 1973. Its interlocking shell roofs reflect cooperation between architects and engineers. Sydney Harbour Bridge is a separate landmark, not part of the opera-house structure. Modern harbor photographs illustrate places, not the inauguration.",
    ),
    [unesco("166")],
    [0],
  ],
  [
    "melbourne",
    text(
      "墨尔本皇家展览馆与卡尔顿花园保留了国际展览交流的历史，让建筑、园林和知识传播共同成为学习主题。",
      "Melbourne's Royal Exhibition Building and Carlton Gardens preserve a history of international exhibitions, connecting architecture, gardens and the exchange of knowledge.",
    ),
    text("展览馆与花园列名", "Exhibition Building and gardens inscription"),
    "2004",
    text(
      "皇家展览馆与卡尔顿花园于 2004 年列入《世界遗产名录》，它们为 1880 和 1888 年国际展览设计。正面与空中照片展示建筑及花园的不同关系，不是展览活动或列名决议现场。",
      "Royal Exhibition Building and Carlton Gardens entered the World Heritage List in 2004. They were designed for the international exhibitions of 1880 and 1888. Facade and aerial photographs show complementary views of building and gardens, not exhibition events or the inscription decision.",
    ),
    [unesco("1131")],
  ],
  [
    "wellington",
    text(
      "惠灵顿的 Te Papa 博物馆通过收藏与跨学科展示连接新西兰的自然、艺术和文化故事。",
      "Wellington's Te Papa museum connects New Zealand's natural, artistic and cultural stories through collections and interdisciplinary displays.",
    ),
    text("Te Papa 开馆", "Te Papa opens"),
    "1998-02-14",
    text(
      "新西兰国家博物馆 Te Papa 于 1998 年 2 月 14 日在惠灵顿 Cable Street 开放。其使命包括融合原国家博物馆与国家美术馆的收藏。旧圣保罗教堂是另一个城市地标，不是 Te Papa 的馆舍；照片不冒充开馆现场。",
      "Te Papa opened on Cable Street in Wellington on February 14, 1998. Its mission includes bringing together collections of the former National Museum and National Art Gallery. Old St Paul's is a separate landmark, not a Te Papa building; the photographs do not record the opening.",
    ),
    ["https://www.tepapa.govt.nz/about/what-we-do/our-history"],
    [0],
  ],
  [
    "auckland",
    text(
      "奥克兰博物馆的收藏与城市公共环境让自然史、文化和历史学习联系起来。",
      "Auckland Museum's collections and public setting connect learning about natural history, culture and the past.",
    ),
    text("现址博物馆开放", "Museum opens at its present site"),
    "1929-11-28",
    text(
      "奥克兰战争纪念博物馆现址建筑于 1929 年 11 月 28 日正式开放。它兼具博物馆与纪念功能；图库分别展示建筑的正面及后方环境，后方艺术品按照片来源记录，不冒充馆内展品或开放仪式。",
      "Auckland War Memorial Museum's present-site building officially opened on November 28, 1929. It combines museum and memorial functions. The gallery separately shows the front and rear setting; the artwork in the rear view is recorded through the photo source, not treated as an indoor exhibit or opening ceremony.",
    ),
    [
      "https://www.aucklandmuseum.com/your-museum/about/the-history-of-auckland-museum",
    ],
  ],
  [
    "cairo",
    text(
      "开罗历史区的清真寺与学校建筑让城市空间、工艺和知识传播的历史可以被一起认识。",
      "Historic Cairo's mosques and educational buildings connect urban space, craft and the history of sharing knowledge.",
    ),
    text("历史开罗列名", "Historic Cairo inscription"),
    "1979",
    text(
      "历史开罗于 1979 年列入《世界遗产名录》。历史区保存了清真寺、学校、浴室与喷泉等城市组成部分。图库展示苏丹哈桑清真寺学校与爱资哈尔清真寺，不是整个现代开罗或列名活动现场。",
      "Historic Cairo entered the World Heritage List in 1979. Its urban fabric includes mosques, schools, baths and fountains. The gallery shows the Sultan Hasan mosque-madrasa and Al-Azhar Mosque, not all modern Cairo or the inscription event.",
    ),
    [unesco("89")],
  ],
  [
    "abuja",
    text(
      "阿布贾城市入口把公共地标作为地域背景，并通过空间科学机构的历史引入科技应用主题。",
      "Abuja's city entry uses public landmarks for geographic context and introduces scientific applications through the history of its space-research institution.",
    ),
    text(
      "国家空间研究与发展机构设立",
      "National space-research agency established",
    ),
    "1999",
    text(
      "尼日利亚国家空间研究与发展机构 NASRDA 于 1999 年设立，其法定总部位于阿布贾联邦首都区。空间科学应用是这座城市的一个科技学习线索。两张国家清真寺照片只作同城文化背景，不是机构总部、航天设施或成立现场。",
      "Nigeria's National Space Research and Development Agency, NASRDA, was established in 1999; its statutory headquarters is in Abuja's Federal Capital Territory. Space-science applications provide a technology-learning perspective. The two National Mosque photographs offer cultural city context only, not the agency headquarters, a space facility or establishment event.",
    ),
    [
      "https://www.nasrda.gov.ng/faqs/",
      "https://spacereg.nasrda.gov.ng/wp-content/uploads/2025/04/Authentic-NASRDA-Act.pdf",
    ],
  ],
  [
    "nairobi",
    text(
      "内罗毕国家博物馆把自然标本、文化记录与公众学习连接起来，建筑照片与馆内实物分开说明。",
      "Nairobi National Museum connects natural specimens, cultural records and public learning; building photographs are distinguished from objects in its collections.",
    ),
    text("博物馆山馆舍开放", "Museum Hill building opens"),
    "1930-09-22",
    text(
      "今天内罗毕国家博物馆所在的博物馆山馆舍于 1930 年 9 月 22 日开放，机构历史可追溯至 1910 年。1930 年馆舍开放并不是机构起源的同一日期。图库的 2005 和 2025 年建筑照片不冒充历史仪式或馆内标本。",
      "The Museum Hill building now occupied by Nairobi National Museum opened on September 22, 1930; the institution traces its origins to 1910. Opening of the building and origin of the institution are distinct dates. The 2005 and 2025 building photographs do not depict the historic ceremony or specimens inside.",
    ),
    ["https://museums.or.ke/museum-story/"],
  ],
  [
    "addis-ababa",
    text(
      "亚的斯亚贝巴入口以国家博物馆和城市建筑为背景，引入埃塞俄比亚古人类研究的科学线索。",
      "The Addis Ababa entry uses its National Museum and city architecture as context for introducing scientific evidence from Ethiopian paleoanthropology.",
    ),
    text(
      "露西化石发现：研究人类演化",
      "Lucy discovery and human-evolution research",
    ),
    "1974",
    text(
      "露西化石 AL 288-1 于 1974 年发现于埃塞俄比亚哈达尔，约有 320 万年历史。其骨骼为研究身体形态与运动方式提供证据。发现地点不是亚的斯亚贝巴；馆舍与城市建筑照片仅作博物馆和地域背景，不冒充化石、发掘现场或发现仪式。",
      "Lucy, fossil AL 288-1, was discovered at Hadar, Ethiopia, in 1974 and is about 3.2 million years old. Its skeleton offers evidence about body form and locomotion. Hadar is not Addis Ababa; museum and city-building photographs provide institutional and geographic context, not views of the fossil, excavation or discovery ceremony.",
    ),
    ["https://humanorigins.si.edu/evidence/human-fossils/fossils/al-288-1"],
    [0],
  ],
  [
    "rabat",
    text(
      "拉巴特把历史城墙、宗教建筑与现代城市规划结合起来，可以观察不同城市阶段如何共存。",
      "Rabat combines historic walls and religious buildings with modern urban planning, inviting observation of how different urban periods coexist.",
    ),
    text("共享城市遗产列名", "Shared urban heritage inscription"),
    "2012",
    text(
      "“拉巴特：现代首都与历史城市，共享遗产”于 2012 年列入《世界遗产名录》。其特定范围连接现代城市规划与更早建筑，哈桑塔与乌达雅堡分别提供不同历史线索。地点照片不是列名决议现场，也不表示城市全部地块均在列名范围。",
      "Rabat, Modern Capital and Historic City: a Shared Heritage entered the World Heritage List in 2012. Its specific area connects modern planning with older buildings; Hassan Tower and the Udayas Kasbah offer different historical perspectives. Site photographs do not depict the inscription or imply that every city parcel is included.",
    ),
    [unesco("1401")],
  ],
  [
    "algiers",
    text(
      "阿尔及尔卡斯巴的巷道、古清真寺和传统居住空间保存了地中海城市生活的历史线索。",
      "Algiers's Kasbah preserves Mediterranean urban-history evidence in its lanes, older mosques and traditional living spaces.",
    ),
    text("卡斯巴列名", "Kasbah inscription"),
    "1992",
    text(
      "阿尔及尔卡斯巴于 1992 年列入《世界遗产名录》，其传统城市结构与社区生活共同构成文化意义。图库的卡斯巴巷道与具体清真寺分别标名，不把一座清真寺或整个现代阿尔及尔等同于该遗产；照片不是列名现场。",
      "The Kasbah of Algiers entered the World Heritage List in 1992, recognizing traditional urban form and community life. The Kasbah lane and specifically named mosque are captioned separately; neither one mosque nor all modern Algiers is equated with the property. The photographs do not depict the inscription event.",
    ),
    [unesco("565")],
  ],
  [
    "accra",
    text(
      "阿克拉的独立广场与纪念建筑为认识公共空间、集体记忆和文化活动提供具体地点。",
      "Accra's Independence Square and memorial architecture provide concrete settings for learning about public space, collective memory and cultural activities.",
    ),
    text("独立广场建成", "Independence Square completed"),
    "1961",
    text(
      "阿克拉独立广场于 1961 年建成，用于公共集会与文化活动。独立广场与恩克鲁玛纪念公园是不同地点；图库只提供地点背景，不冒充 1961 年落成活动。纪念公园照片原说明明确拍于 1995 年，2008 年元数据不作为其拍摄日期。",
      "Accra's Independence Square was completed in 1961 and serves public gatherings and cultural activities. The square and Kwame Nkrumah Memorial Park are distinct places; the gallery provides site context, not the 1961 opening. The memorial-park file description explicitly dates the photograph to 1995, so its 2008 metadata is not treated as the capture date.",
    ),
    ["https://visitghana.com/independence-square/"],
    [0],
  ],
];

const photosByCity = new Map<string, ImmersiveHotspotImage[]>();
for (const record of cityPhotoRecords.files as CheckedCityPhoto[]) {
  if (record.review !== "source-checked") continue;
  const gallery = photosByCity.get(record.cityId) ?? [];
  gallery.push(reviewedPhoto(record));
  photosByCity.set(record.cityId, gallery);
}
const preferredLandmarkIds: Record<string, string[]> = {
  "city-shenzhen": [
    "city-landmark-shenzhen-bay",
    "city-landmark-shenzhen-huaqiangbei",
  ],
  "city-hangzhou": [
    "city-landmark-hangzhou-west-lake",
    "city-landmark-hangzhou-lingyin",
  ],
  "city-hong-kong": ["city-landmark-hong-kong-convention-centre"],
  "city-taipei": ["city-landmark-taipei-palace-museum"],
  "city-kyoto": [
    "city-landmark-kyoto-kiyomizu",
    "city-landmark-kyoto-kinkakuji",
  ],
  "city-saint-petersburg": [
    "city-landmark-saint-petersburg-winter-palace",
    "city-landmark-saint-petersburg-peter-paul",
  ],
};
// Landmarks are reused only after the separate subject-and-rights source review.
for (const cityId of [
  "city-shenzhen",
  "city-hangzhou",
  "city-hong-kong",
  "city-taipei",
  "city-kyoto",
  "city-saint-petersburg",
]) {
  const landmarks = getCityLandmarks(cityId);
  const gallery = preferredLandmarkIds[cityId].flatMap((id) => {
    const images =
      landmarks.find((landmark) => landmark.id === id)?.gallery ?? [];
    return images
      .slice(0, preferredLandmarkIds[cityId].length === 1 ? 2 : 1)
      .map((image) => {
        const date =
          image.date.match(/^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/)?.[1] ?? image.date;
        const licenseUrl = new URL(image.licenseUrl);
        if (licenseUrl.hostname === "creativecommons.org")
          licenseUrl.protocol = "https:";
        return {
          ...image,
          date,
          licenseUrl: licenseUrl.href,
          credit: image.credit.replace("Godot13", "Andrew Shiva / Wikipedia"),
        };
      });
  });
  if (gallery.length >= 2) photosByCity.set(cityId, gallery);
}

const existingStories = new Map(cityStories.map((story) => [story.id, story]));
const newStories = new Map<string, GalleryStory>();
for (const [
  slug,
  introduction,
  title,
  date,
  description,
  sourceUrls,
  imageIndices,
] of factSpecs) {
  const city = firstBatchCities.find((entry) => entry.id === `city-${slug}`);
  const gallery = photosByCity.get(`city-${slug}`);
  if (!city || !gallery || gallery.length < 2) continue;
  const relation = text(
    "城市入口连接文化、科学或教育主题。各照片标明实际地标与拍摄日期，主题相关或同城背景不等于事件现场，也不把城市锚点当作照片机位。",
    "The city entry connects cultural, scientific or educational themes. Each photograph identifies its actual place and capture date. Topic-related or same-city context does not mean an event photograph; the city anchor is not a camera position.",
  );
  const event = {
    id: `${slug}-educational-milestone`,
    title,
    date,
    description,
    sourceUrls,
    imageIndices: imageIndices ?? [0, 1],
  };
  newStories.set(city.id, {
    id: city.id,
    name: city.label,
    latitude: city.latitude,
    longitude: city.longitude,
    coordinateAccuracy: "approximate",
    coordinateNote: text(
      "城市级示意锚点，来自来源目录或 Wikidata P625；不是地标、事件现场或照片机位的精确坐标。",
      "City-level orientation anchor from the source directory or Wikidata P625; not an exact landmark, event-venue or camera position.",
    ),
    introduction,
    summary: introduction,
    paragraphs: [description],
    date,
    relation,
    sourceUrls: [...new Set([...city.sourceUrls, ...sourceUrls])],
    image: gallery[0],
    gallery,
    events: [event],
    humanReview: "pending",
  });
}

export const firstBatchCityStories: GalleryStory[] = firstBatchCities.flatMap(
  (city) => {
    const story = existingStories.get(city.id) ?? newStories.get(city.id);
    return story ? [story] : [];
  },
);

export const firstBatchPendingCityIds = firstBatchCities
  .filter(
    (city) => !firstBatchCityStories.some((story) => story.id === city.id),
  )
  .map((city) => city.id);

export const firstBatchReview = {
  sourceCheckedAt: "2026-10-06",
  sourceCheckedBy: "Codex source review",
  humanReview: "pending",
  groupingNote: text(
    "按用户指定的大洲及国家／地区分组组织城市。中国组包含香港、台北，是编辑导航分组，不是行政或政治地位判断。俄罗斯两城按城市位置列入欧洲，不代表整个俄罗斯仅位于欧洲。首都标签沿用来源目录，不是现行法律身份核验。",
    "User-selected continent and country/territory navigation groups. The China group includes Hong Kong and Taipei as an editorial grouping, not an administrative or political determination. The two Russian cities are grouped by their European locations, not a claim that all Russia is in Europe. Capital labels follow source directory entries and are not a current legal-status verification.",
  ),
} as const;
