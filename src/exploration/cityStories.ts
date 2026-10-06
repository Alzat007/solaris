import type { LocalizedText } from "./contentTypes";
import { assets } from "./content";
import { getEarthCity } from "./earthDirectory";
import { immersiveSites, type ImmersiveHotspotImage } from "./immersiveCatalog";
import type { GalleryStory } from "./galleryStory";

export type CityStory = GalleryStory;

const text = (zh: string, en: string): LocalizedText => ({ zh, en });
const unesco = (id: string) => `https://whc.unesco.org/en/list/${id}/`;
const commons = (filename: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(" ", "_"))}`;

function photo(
  path: string,
  filename: string,
  author: string,
  date: string,
  license: string,
  licenseUrl: string,
  caption: LocalizedText,
): ImmersiveHotspotImage {
  return {
    path: `exploration/cities/${path}`,
    sourceUrl: commons(filename),
    credit: `${author} / Wikimedia Commons / ${license}`,
    date,
    license,
    licenseUrl,
    caption,
    processing: text(
      "使用 Wikimedia 提供的尺寸版本；未本地裁剪、调色或合成。保留原图许可，原作者处理记录见来源页。",
      "Wikimedia size variant; no local crop, recoloring or compositing. Original license retained; see the file record for the author's processing history.",
    ),
  };
}

interface StorySpec {
  id: string;
  name: LocalizedText;
  introduction: LocalizedText;
  gallery: ImmersiveHotspotImage[];
  events: CityStory["events"];
}

function cityStory(spec: StorySpec): CityStory {
  const position = getEarthCity(spec.id)?.coordinates;
  if (!position && spec.id !== "city-shanghai")
    throw new Error(
      `City story needs an existing directory position: ${spec.id}`,
    );
  const shanghai = spec.id === "city-shanghai";
  const sourceUrls = [
    ...new Set(spec.events.flatMap((event) => event.sourceUrls)),
  ];
  if (shanghai) sourceUrls.push("https://www.wikidata.org/wiki/Q8686");
  return {
    ...spec,
    latitude: position?.latitude ?? 31.2325,
    longitude: position?.longitude ?? 121.469167,
    coordinateAccuracy: "approximate",
    coordinateNote: text(
      shanghai
        ? "上海城市示意锚点采用 Wikidata Q8686 的 31°13′57″N、121°28′9″E；不是世博中国馆、事件会场或照片机位的坐标。"
        : "采用已有地球目录的城市示意位置；不是下述每个地标、历史事件或照片机位的精确坐标。",
      shanghai
        ? "City-level anchor from Wikidata Q8686, 31°13′57″N / 121°28′9″E; not the China Pavilion, event venue or camera position."
        : "City-level location from the existing Earth Directory; not the precise position of every landmark, event or photograph below.",
    ),
    summary: spec.introduction,
    paragraphs: spec.events.map((event) => event.description),
    date: spec.events[0].date,
    relation: text(
      "城市入口关联其代表地标与教育事件；每张照片独立注明日期和关系。遗产列名决议不等于照片拍摄现场，后期地标照片不冒充历史现场。",
      "A city entry connects representative places and educational milestones. Each photograph has its own date and relationship; later landmark photographs do not represent the historical event or an inscription meeting.",
    ),
    sourceUrls,
    image: spec.gallery[0],
    humanReview: "pending",
  };
}

const beijing = immersiveSites.find((site) => site.id === "beijing");
const axis = assets.find((asset) => asset.id === "asset-beijing-axis");
if (!beijing || !axis)
  throw new Error("Beijing requires existing reviewed records");
const beijingGallery = beijing.hotspots.flatMap((hotspot) =>
  hotspot.image ? [hotspot.image] : [],
);
beijingGallery.push({
  path: axis.path,
  caption: axis.caption,
  credit: axis.credit,
  date: axis.date,
  sourceUrl: axis.sourceUrl,
  license: axis.license,
  licenseUrl: axis.rightsUrl,
  processing: axis.processing,
});

export const cityStories: CityStory[] = [
  cityStory({
    id: "city-beijing",
    name: text("北京", "Beijing"),
    introduction: text(
      "北京是中国首都。老城的中轴线把宫苑、公共建筑和道路连接起来，是理解传统城市规划与文化保护的一条线索；鸟巢展示了现代体育建筑的另一面。",
      "Beijing is China's capital. Its Central Axis connects palaces, public buildings and roads, offering a perspective on traditional urban planning and conservation; the Bird's Nest introduces modern sports architecture.",
    ),
    gallery: beijingGallery,
    events: [
      {
        id: "beijing-axis-inscription",
        title: text(
          "中轴线列入世界遗产",
          "Central Axis World Heritage inscription",
        ),
        date: "2024-07-27",
        description: text(
          "北京中轴线于 2024 年 7 月 27 日列入《世界遗产名录》，文化保护让城市规划与历史建筑被共同认识。天安门与中轴线照片是较早拍摄的地点配图，不记录列名决议现场。",
          "Beijing's Central Axis entered the World Heritage List on July 27, 2024, recognizing an ensemble of historic buildings and urban planning. The earlier Tiananmen and Central Axis photographs illustrate places, not the inscription decision.",
        ),
        sourceUrls: [
          unesco("1714"),
          "https://whc.unesco.org/en/decisions/8607/",
        ],
        imageIndices: [0, 3],
      },
      {
        id: "beijing-2008-sport",
        title: text(
          "2008 奥运会：体育与国际交流",
          "Beijing 2008: sport and international exchange",
        ),
        date: "2008",
        description: text(
          "国家体育场举办了 2008 年北京奥运会开幕式和闭幕式，体育与文化展示为国际交流搭建舞台。图库中的鸟巢外观拍于 2020 年，不是 2008 年赛事现场；八达岭照片另用于认识北京的文化遗产。",
          "The National Stadium hosted the opening and closing ceremonies of Beijing 2008, bringing sport and cultural exchange into one venue. Its exterior photograph dates from 2020, not the ceremonies; the Badaling photograph separately illustrates Beijing's cultural heritage.",
        ),
        sourceUrls: beijing.hotspots[2].sourceUrls,
        imageIndices: [2],
      },
    ],
  }),
  cityStory({
    id: "city-paris",
    name: text("法国·巴黎", "France · Paris"),
    introduction: text(
      "巴黎沿塞纳河发展，桥梁、河岸与历史建筑共同形成城市景观。从河边认识城市，可以观察建筑、公共空间与文化保护之间的联系。",
      "Paris developed along the Seine. Bridges, quays and historic buildings form a layered cityscape in which architecture, public spaces and conservation can be explored together.",
    ),
    gallery: [
      photo(
        "paris-1.jpg",
        "Seine River, Paris.jpg",
        "Nadiantara",
        "2018-11-18",
        "CC BY-SA 3.0",
        "https://creativecommons.org/licenses/by-sa/3.0/",
        text(
          "2018 年塞纳河与远处巴黎圣母院；1991 年遗产主题的后期地点配图，不是列名现场，也不是当前实时景观。",
          "The Seine with Notre-Dame in the distance, 2018; a later site illustration for the 1991 heritage theme, not the inscription event or a current live view.",
        ),
      ),
      photo(
        "paris-2.jpg",
        "River Seine, Paris.jpg",
        "Kabusa16",
        "2018-04-15",
        "CC BY-SA 4.0",
        "https://creativecommons.org/licenses/by-sa/4.0/",
        text(
          "2018 年巴黎塞纳河景观；用于观察城市与河流的关系，不是 1991 年列名活动照片。",
          "A Paris Seine river view from 2018, illustrating the relationship between city and river; not a photograph of the 1991 inscription.",
        ),
      ),
    ],
    events: [
      {
        id: "paris-seine-heritage",
        title: text(
          "塞纳河畔列入世界遗产",
          "Banks of the Seine World Heritage inscription",
        ),
        date: "1991",
        description: text(
          "巴黎塞纳河畔于 1991 年列入《世界遗产名录》。这份遗产连接河岸、桥梁和多个时代的建筑，展示城市历史如何在公共空间中延续。列名范围不是整个巴黎，图中的 2018 年河景也不是列名决议现场。",
          "The Banks of the Seine entered the World Heritage List in 1991. Riverbanks, bridges and buildings from different periods reveal continuity in urban public space. The listed property is not all of Paris, and these 2018 river views do not depict the inscription decision.",
        ),
        sourceUrls: [unesco("600")],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-shanghai",
    name: text("上海", "Shanghai"),
    introduction: text(
      "上海通过 2010 年世界博览会讨论城市生活、可持续发展与国际交流。世博园区与中国馆为认识城市更新提供了一组具体建筑线索。",
      "Shanghai's 2010 World Expo explored urban life, sustainability and international exchange. Its grounds and China Pavilion offer concrete architectural perspectives on urban renewal.",
    ),
    gallery: [
      photo(
        "shanghai-1.jpg",
        "2010 Shanghai Expo World's Fair - China Pavilion 03.jpg",
        "Gary Lee Todd, Ph.D.",
        "2010-09-17",
        "CC0 1.0",
        "https://creativecommons.org/publicdomain/zero/1.0/",
        text(
          "2010 年 9 月 17 日上海世博会中国馆，拍于展期；是场馆记录，不是 5 月 1 日开幕式照片。",
          "China Pavilion on September 17, 2010, during the Shanghai Expo; a venue record, not the May 1 opening ceremony.",
        ),
      ),
      photo(
        "shanghai-2.jpg",
        "China Pavilion at Expo 2010.jpg",
        "Windtrain",
        "2010-12-25",
        "CC BY-SA 3.0",
        "https://creativecommons.org/licenses/by-sa/3.0/",
        text(
          "2010 年 12 月 25 日中国馆外观，拍于世博闭幕后；用于认识场馆，不冒充展期或开幕式现场。",
          "China Pavilion exterior on December 25, 2010, after the Expo closed; an illustration of the building, not the Expo or opening ceremony.",
        ),
      ),
    ],
    events: [
      {
        id: "shanghai-expo-2010",
        title: text(
          "2010 世博会：城市，让生活更美好",
          "Expo 2010: Better City, Better Life",
        ),
        date: "2010",
        description: text(
          "上海世博会于 2010 年 5 月 1 日至 10 月 31 日举行，以“城市，让生活更美好”为主题。各地围绕城市发展和可持续生活交流经验。中国馆照片分别记录展期场馆与闭幕后外观，不将建筑照片当作开幕式现场。",
          "Shanghai hosted Expo 2010 from May 1 to October 31 under the theme Better City, Better Life, encouraging exchanges on urban development and sustainable living. The gallery separately shows a venue during the Expo and its exterior after closure, not the opening ceremony.",
        ),
        sourceUrls: ["https://www.bie-paris.org/site/en/2010-shanghai"],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-new-york",
    name: text("纽约", "New York City"),
    introduction: text(
      "纽约港的自由女神像把雕塑、工程和国际友谊连接起来。城市入口围绕这一代表地标，认识文化交流与历史遗产，而不是把港口当成整座城市。",
      "The Statue of Liberty in New York Harbor connects sculpture, engineering and international friendship. This representative landmark introduces cultural exchange and heritage without standing in for the whole city.",
    ),
    gallery: [
      photo(
        "new-york-1.jpg",
        "Statue of Liberty frontal 2.jpg",
        "Daniel Schwen",
        "2008-05-28",
        "Public domain (author release)",
        "https://commons.wikimedia.org/wiki/File:Statue_of_Liberty_frontal_2.jpg",
        text(
          "2008 年自由女神像正面；1886 年落成主题的后期地标配图，不是落成典礼现场。",
          "Statue of Liberty photographed in 2008; a later landmark illustration of its 1886 dedication, not the ceremony.",
        ),
      ),
      photo(
        "new-york-2.jpg",
        "Liberty Island photo Don Ramey Logan.jpg",
        "Don Ramey Logan",
        "2014-12-14",
        "CC BY 4.0",
        "https://creativecommons.org/licenses/by/4.0/",
        text(
          "2014 年自由岛与雕像的空中照片；展示地标与港口关系，不是 1886 年现场照片。",
          "Liberty Island and its statue from the air in 2014, illustrating the harbor setting; not an 1886 event photograph.",
        ),
      ),
    ],
    events: [
      {
        id: "new-york-liberty-dedication",
        title: text(
          "1886：艺术、工程与国际友谊",
          "1886: art, engineering and international friendship",
        ),
        date: "1886",
        description: text(
          "自由女神像于 1886 年落成，是法国赠送的礼物，凝聚雕塑家巴托迪与工程师埃菲尔等人的合作。它把艺术与结构工程结合，并成为纽约港的重要文化地标；后期照片帮助观察雕像，不代表当年的典礼。",
          "Dedicated in 1886, the Statue of Liberty was a gift from France, joining the work of sculptor Bartholdi and engineer Eiffel. It connects art and structural engineering as a New York Harbor landmark. Later photographs illustrate the monument, not its dedication ceremony.",
        ),
        sourceUrls: [unesco("307")],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-washington-dc",
    name: text("美国·华盛顿", "United States · Washington, D.C."),
    introduction: text(
      "华盛顿特区是美国首都，史密森学会把博物馆、教育与科学研究连接起来。这里从“城堡”建筑认识知识收藏与公共教育，不与华盛顿州混淆。",
      "Washington, D.C., the U.S. capital, is home to the Smithsonian's museum, education and research work. Its Castle introduces collections and public learning; this is not Washington State.",
    ),
    gallery: [
      photo(
        "washington-dc-1.jpg",
        "Smithsonian Institution Building (The Castle).JPG",
        "Jorgebellatin",
        "2012-09-04",
        "CC BY-SA 3.0",
        "https://creativecommons.org/licenses/by-sa/3.0/",
        text(
          "2012 年史密森城堡建筑照片；1846 年机构成立主题的后期地点配图，不是成立现场。",
          "Smithsonian Castle in 2012, a later site illustration for the institution's 1846 founding; not the founding event.",
        ),
      ),
      photo(
        "washington-dc-2.jpg",
        "Washington October 2016-13.jpg",
        "Alvesgaspar",
        "2016-10-05",
        "CC BY-SA 4.0",
        "https://creativecommons.org/licenses/by-sa/4.0/",
        text(
          "2016 年史密森城堡景观；机构成立于 1846 年，城堡建筑不等于同年已建成。",
          "Smithsonian Castle in 2016. The institution was founded in 1846; that does not mean this building was completed that year.",
        ),
      ),
    ],
    events: [
      {
        id: "washington-smithsonian-founding",
        title: text(
          "1846：建立知识传播机构",
          "1846: founding an institution for knowledge",
        ),
        date: "1846-08-10",
        description: text(
          "1846 年 8 月 10 日，设立史密森学会的法案签署生效，目标是增进和传播知识。捐赠、研究与公共收藏推动科学教育。图库展示的是后期城堡建筑，不是签署现场，也不把机构成立日期写成建筑竣工日期。",
          "On August 10, 1846, legislation established the Smithsonian to increase and spread knowledge. A bequest, research and public collections supported scientific education. The gallery shows its later Castle building, not the signing or a claim that the building was completed in 1846.",
        ),
        sourceUrls: [
          "https://siarchives.si.edu/history/general-history",
          "https://www.si.edu/about/history",
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-london",
    name: text("英国·伦敦", "United Kingdom · London"),
    introduction: text(
      "伦敦的泰晤士河岸保存着不同年代的建筑。伦敦塔与白塔提供认识历史建筑、档案传统与长期保护的窗口；它们不是旁边的伦敦塔桥。",
      "London's Thames riverfront preserves buildings from different periods. The Tower of London and its White Tower offer a perspective on historic architecture and conservation; they are not nearby Tower Bridge.",
    ),
    gallery: [
      photo(
        "london-1.jpg",
        "Tower of London viewed from the River Thames.jpg",
        "Bob Collowan",
        "2013-07-22",
        "CC BY-SA 3.0",
        "https://creativecommons.org/licenses/by-sa/3.0/",
        text(
          "2013 年从泰晤士河看伦敦塔；1988 年世界遗产主题的后期地标照片，不是列名现场。",
          "Tower of London viewed from the Thames in 2013, a later landmark photograph for its 1988 heritage inscription; not the inscription event.",
        ),
      ),
      photo(
        "london-2.jpg",
        "London, Tower of London, White Tower -- 2016 -- 4679.jpg",
        "Dietmar Rabich",
        "2016-10-09",
        "CC BY-SA 4.0",
        "https://creativecommons.org/licenses/by-sa/4.0/",
        text(
          "2016 年伦敦塔内的白塔；地点配图，不是 1988 年保护决议照片。",
          "The White Tower within the Tower of London in 2016, a site illustration rather than a photograph of the 1988 inscription decision.",
        ),
      ),
    ],
    events: [
      {
        id: "london-tower-heritage",
        title: text(
          "1988：认识与保护历史建筑",
          "1988: recognizing and conserving historic architecture",
        ),
        date: "1988",
        description: text(
          "伦敦塔于 1988 年列入《世界遗产名录》。它的白塔与后期建筑展示了延续数百年的建筑变化，保护工作关注建筑本体与河岸环境。这里选择建筑保护与教育主题，后期照片不记录列名活动。",
          "The Tower of London entered the World Heritage List in 1988. Its White Tower and later buildings show centuries of architectural change; conservation concerns both buildings and their riverfront setting. Later photographs illustrate this architectural education theme, not the inscription meeting.",
        ),
        sourceUrls: [unesco("488")],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-tokyo",
    name: text("日本·东京", "Japan · Tokyo"),
    introduction: text(
      "东京的代代木体育馆把建筑设计与体育公共空间结合。它为 1964 年奥运会建设，弯曲的悬吊屋顶成为观察结构工程的一条线索。",
      "Tokyo's Yoyogi National Gymnasium connects architectural design with public sporting space. Built for the 1964 Olympics, its suspended roof offers a distinctive perspective on structural engineering.",
    ),
    gallery: [
      photo(
        "tokyo-1.jpg",
        "Yoyogi-National-First-Gymnasium-01.jpg",
        "Rs1421",
        "2010-05-22",
        "CC BY-SA 3.0",
        "https://creativecommons.org/licenses/by-sa/3.0/",
        text(
          "2010 年代代木第一体育馆外观；1964 年赛事主题的后期场馆配图，不是当年比赛现场。",
          "Yoyogi First Gymnasium exterior in 2010, a later venue illustration for the 1964 Games; not an event photograph.",
        ),
      ),
      photo(
        "tokyo-2.jpg",
        "Yoyogi-National-Gymnasium-01.jpg",
        "Rs1421",
        "2012-11",
        "CC BY-SA 3.0",
        "https://creativecommons.org/licenses/by-sa/3.0/",
        text(
          "2012 年 11 月代代木体育馆涩谷侧入口；原记录仅精确到月份，不虚构拍摄日。",
          "Yoyogi Gymnasium's Shibuya-side entrance in November 2012; the source specifies only a month, not an exact day.",
        ),
      ),
    ],
    events: [
      {
        id: "tokyo-yoyogi-1964",
        title: text(
          "1964：体育与结构设计的相遇",
          "1964: sport meets structural design",
        ),
        date: "1964",
        description: text(
          "代代木体育馆为 1964 年东京奥运会建设。第一体育馆举办游泳与跳水，第二体育馆举办篮球；这组场馆把建筑与国际体育交流联系起来。2010 年和 2012 年照片展示后期建筑，不冒充 1964 年赛事。",
          "Yoyogi National Gymnasium was built for Tokyo 1964. The First Gymnasium hosted swimming and diving, and the Second hosted basketball, connecting architecture and international sport. Photographs from 2010 and 2012 illustrate the later buildings, not the 1964 events.",
        ),
        sourceUrls: [
          "https://www.jpnsport.go.jp/yoyogi/sisetu/tabid/104/Default.aspx",
          "https://www.jpnsport.go.jp/corp/english/activities/tabid/391/default.aspx",
        ],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-seoul",
    name: text("韩国·首尔", "Republic of Korea · Seoul"),
    introduction: text(
      "首尔的昌德宫以宫殿、庭院和周边自然地形之间的关系著称。仁政殿与庭院让我们观察传统建筑空间与文化遗产保护。",
      "Seoul's Changdeokgung is known for the relationship between palace buildings, courtyards and natural terrain. Injeongjeon Hall and its court introduce traditional spatial design and heritage conservation.",
    ),
    gallery: [
      photo(
        "seoul-1.jpg",
        "Injeongjeon Hall 01.jpg",
        "Bernard Gagnon",
        "2022-09-27",
        "CC0 1.0",
        "https://creativecommons.org/publicdomain/zero/1.0/",
        text(
          "2022 年昌德宫仁政殿；1997 年世界遗产主题的后期地点配图，不是列名现场。",
          "Changdeokgung's Injeongjeon Hall in 2022, a later site illustration for its 1997 inscription; not the inscription event.",
        ),
      ),
      photo(
        "seoul-2.jpg",
        "Injeongjeon Hall 04.jpg",
        "Bernard Gagnon",
        "2022-09-27",
        "CC0 1.0",
        "https://creativecommons.org/publicdomain/zero/1.0/",
        text(
          "2022 年仁政殿庭院与品阶石；用于观察宫殿空间，不是 1997 年活动现场。",
          "Injeongjeon's court and rank markers in 2022, illustrating palace space; not a 1997 event photograph.",
        ),
      ),
    ],
    events: [
      {
        id: "seoul-changdeokgung-heritage",
        title: text(
          "1997：宫殿与自然的共同保护",
          "1997: conserving palace and landscape together",
        ),
        date: "1997",
        description: text(
          "昌德宫建筑群于 1997 年列入《世界遗产名录》。建筑布局顺应自然地形，展示传统设计与环境之间的联系。保护这份遗产也意味着关注周边景观，图库中的 2022 年照片不是列名决议现场。",
          "Changdeokgung Palace Complex entered the World Heritage List in 1997. Its layout responds to natural terrain, linking traditional design with landscape. Conservation includes the surrounding setting; the 2022 photographs do not depict the inscription decision.",
        ),
        sourceUrls: [unesco("816")],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-moscow",
    name: text("俄罗斯·莫斯科", "Russia · Moscow"),
    introduction: text(
      "莫斯科的克里姆林宫与红场保存了多个时代的建筑。红场的开放空间与周边轮廓，为认识城市公共景观和建筑遗产提供线索。",
      "Moscow's Kremlin and Red Square preserve architecture from multiple periods. The square's open space and surrounding silhouettes offer perspectives on public cityscape and built heritage.",
    ),
    gallery: [
      photo(
        "moscow-1.jpg",
        "Moscow's Red Square, Moscow, Russia.jpg",
        "Vyacheslav Argenberg",
        "2012-05-25",
        "CC BY 4.0",
        "https://creativecommons.org/licenses/by/4.0/",
        text(
          "2012 年红场照片，可见当时活动布置；用于展示地点，不代表 1990 年列名活动。",
          "Red Square in 2012 with contemporary event installations visible; a site illustration, not the 1990 inscription.",
        ),
      ),
      photo(
        "moscow-2.jpg",
        "Red Square in Moscow (general view in 2025).jpg",
        "Юрий Д.К.",
        "2025-09-15",
        "CC BY 4.0",
        "https://creativecommons.org/licenses/by/4.0/",
        text(
          "2025 年红场全景；1990 年遗产保护主题的后期地点配图，不是列名决议现场。",
          "Red Square overview in 2025, a later site illustration for the 1990 conservation theme; not the inscription decision.",
        ),
      ),
    ],
    events: [
      {
        id: "moscow-kremlin-heritage",
        title: text(
          "1990：城市建筑遗产的保护",
          "1990: protecting urban architectural heritage",
        ),
        date: "1990",
        description: text(
          "“莫斯科克里姆林宫和红场”于 1990 年列入《世界遗产名录》。这里选择建筑与公共空间的保护主题，关注它们作为城市整体的关系，不把全城都称为遗产地，也不把后期照片写成 1990 年现场。",
          "Kremlin and Red Square, Moscow entered the World Heritage List in 1990. This exhibit focuses on conserving architecture and public space as a connected ensemble, not on claiming that the whole city is listed or that later photographs record the 1990 inscription.",
        ),
        sourceUrls: [unesco("545")],
        imageIndices: [0, 1],
      },
    ],
  }),
  cityStory({
    id: "city-singapore",
    name: text("新加坡", "Singapore"),
    introduction: text(
      "新加坡植物园把热带植物、景观与公共教育结合起来。在城市中的绿地里，可以认识植物研究、保护与休闲空间如何相互支持。",
      "Singapore Botanic Gardens connects tropical plants, landscape and public education. This urban green space offers a perspective on botanical research, conservation and recreation working together.",
    ),
    gallery: [
      photo(
        "singapore-1.jpg",
        "Bandstand and green trees a sunny afternoon with blue sky at Singapore Botanic Gardens.jpg",
        "Basile Morin",
        "2018-06-11",
        "CC BY-SA 4.0",
        "https://creativecommons.org/licenses/by-sa/4.0/",
        text(
          "2018 年植物园音乐亭与树木；2015 年世界遗产主题的后期景观配图，不是列名现场。",
          "The Botanic Gardens' Bandstand and trees in 2018, a later landscape illustration for the 2015 inscription; not the event.",
        ),
      ),
      photo(
        "singapore-2.jpg",
        "Branches of a Ficus kurzii reflecting in the water at Singapore Botanic Gardens.jpg",
        "Basile Morin",
        "2018-06-11",
        "CC BY-SA 4.0",
        "https://creativecommons.org/licenses/by-sa/4.0/",
        text(
          "2018 年植物园天鹅湖旁树枝与倒影；帮助观察植物及景观，不代表 2015 年活动。",
          "Tree branches and reflections beside Swan Lake in 2018, illustrating plants and landscape; not a 2015 event photograph.",
        ),
      ),
    ],
    events: [
      {
        id: "singapore-gardens-heritage",
        title: text(
          "2015：植物研究与公共教育",
          "2015: botanical research and public education",
        ),
        date: "2015",
        description: text(
          "新加坡植物园于 2015 年列入《世界遗产名录》。它从历史园林发展为兼具植物研究、保护、教育与休闲功能的场所。2018 年照片展示园内景观，不是列名活动，植物园也不是整个新加坡的边界。",
          "Singapore Botanic Gardens entered the World Heritage List in 2015. It developed into a place for botanical research, conservation, education and recreation. The 2018 photographs show garden landscapes, not the inscription event; the garden is not the entire city-state.",
        ),
        sourceUrls: [unesco("1483")],
        imageIndices: [0, 1],
      },
    ],
  }),
];
