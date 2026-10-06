import type { LocalizedText } from "./contentTypes";

export interface ImageNote {
  caption?: LocalizedText;
  credit?: string;
  date?: string;
  processing?: LocalizedText;
}
const text = (zh: string, en: string): LocalizedText => ({ zh, en });

export const cityLandmarkImageNotes: Record<string, ImageNote> = {
  "Yu Garden Shanghai November 2017 006.jpg": {
    caption: text(
      "2017-11-20 豫园内部的池水、假山与亭廊，展示古典园林空间；不是毗邻园区的湖心亭茶楼。",
      "Pool, rockwork and pavilions inside Yu Garden on November 20, 2017; classical garden spaces, not the neighboring Huxinting tea house.",
    ),
  },
  "Yu Garden Shanghai November 2017 010.jpg": {
    caption: text(
      "2017-11-20 豫园内园古戏台及两侧看廊；是建筑配图，不冒充某次历史演出现场。",
      "The historic stage and side galleries in Yu Garden's Inner Garden on November 20, 2017; an architectural illustration, not a historical-performance photograph.",
    ),
  },
  "PING AN FINANCE CENTER, SHENZHEN.jpg": {
    caption: text(
      "2023-03-24 从福田街区仰望平安金融中心塔楼外立面，建筑观察配图，不是历史事件现场。",
      "The Ping An Finance Centre exterior from Futian on March 24, 2023; an architectural illustration, not a historical-event photograph.",
    ),
  },
  "Tokyo Shibuya Scramble Crossing 2018-10-09.jpg": {
    processing: text(
      "原作者采用约 2.5 秒长曝光；使用来源页面的 CC BY-SA 2.0 许可，未本地裁剪、调色或合成。",
      "Approximately 2.5-second exposure by the source author; CC BY-SA 2.0 as offered on the source page, with no local crop, recoloring or compositing.",
    ),
  },
  "Louvre Cour Carrée June 2010.jpg": {
    caption: text(
      "2010-06-21 白昼的卢浮宫方庭与历史宫殿立面，不是贝聿铭金字塔或开馆现场。",
      "The Louvre's Cour Carree and historic palace facade in daylight on June 21, 2010; not the Pei pyramid or a museum-opening photograph.",
    ),
    processing: text(
      "原文件历史记录含 Paris 16 于 2018 年作透视修正；使用官方等比例版本，未再本地改图。",
      "The original file history records perspective correction by Paris 16 in 2018; official proportional variant, with no further local edits.",
    ),
  },
  "Mt. Namsan viewed from Seonbawi Rock on Mt. Inwangsan, Seoul.jpg": {
    date: "2015-03-02; source clock time not verified",
    caption: text(
      "从首尔仁王山禅岩看城市与远处南山，南山塔在远景中出现；这是山地与城市关系的背景配图，不是塔楼近景。",
      "City and distant Namsan viewed from Seonbawi Rock on Inwangsan, Seoul; the tower appears incidentally in the background, not as a close-up architectural subject.",
    ),
  },
  "Seoul City Core from N-Seoul Tower (5464351080).jpg": {
    caption: text(
      "2008-09-26 从南山塔方向观察首尔城市核心；照片拍的是城市，不是塔楼本体或建成现场。",
      "Seoul's urban core viewed from N Seoul Tower on September 26, 2008; the city is the subject, not the tower's structure or its construction.",
    ),
  },
  "GreatWall Badaling.jpg": {
    date: "Photo circa 2002; uploaded 2004-10-30",
    caption: text(
      "八达岭长城地点配图，来源说明图像约拍于 2002 年；2004-10-30 是原上传日期，不是 1987 年世界遗产列名现场。",
      "Badaling site illustration, described as a circa-2002 image; October 30, 2004 is the original upload date, not the 1987 World Heritage inscription.",
    ),
  },
  "The Forbidden City - View from Coal Hill.jpg": {
    processing: text(
      "来源作者采用 HDR 处理；使用 Wikimedia 等比例版本，未本地裁剪、调色或合成。",
      "HDR processing by the source author; official Wikimedia proportional variant, with no local crop, recoloring or compositing.",
    ),
  },
  "Temple of Heaven, Beijing, China - 010 edit.jpg": {
    credit: "Maros Mraz (Maros); edited by Thegreenj",
  },
  "Oriental Pearl Tower 20251126.jpg": { credit: "Supanut Arunoprayote" },
  "Marina Bay Sands (I).jpg": { credit: "Supanut Arunoprayote" },
  "WhiteHouseSouthFacade.JPG": {
    credit: "Matt H. Wade",
    caption: text(
      "2006 年白宫南立面；建筑地点配图，不是典礼或历史事件现场。",
      "The White House's south facade in 2006; an architectural illustration, not a ceremony or historical-event photograph.",
    ),
  },
  "Tokyo Tower during daytime.jpg": {
    processing: text(
      "来源作者以五帧竖向拼接制成全景；本地未再次拼接、裁剪或调色。",
      "A five-frame vertical panorama assembled by the source author; no additional local stitching, crop or color processing.",
    ),
  },
  "Shanghai Tower construction Jan 2011.jpg": {
    caption: text(
      "2011 年 1 月上海中心施工阶段；建筑工程历程配图，不代表已建成外观或实时工地。",
      "Shanghai Tower under construction in January 2011; an engineering-history illustration, not a completed-building or live construction view.",
    ),
  },
  "Hangzhou Olympic Sports Expo Center under construction2021.jpg": {
    caption: text(
      "2021 年杭州奥体中心建筑群工程背景，来源说明体育场和网球中心当时已完成；不是 2023 年亚运会现场。",
      "The Hangzhou Olympic complex in 2021, with the stadium and tennis centre described as completed by the source; not a photograph of the 2023 Asian Games.",
    ),
  },
  "Hangzhou Olympic Sports Expo Center 3.JPG": {
    caption: text(
      "2012-10-03 杭州奥体中心主体育场施工阶段。杭州亚运会保留 Hangzhou 2022 名称，实际举办于 2023 年，照片不冒充赛事现场。",
      "The main stadium under construction on October 3, 2012. The Hangzhou Games retained the Hangzhou 2022 name but took place in 2023; this is not event-site documentation.",
    ),
  },
  "QianHaiDepotResidence.jpg": {
    caption: text(
      "前海车辆段上盖居住建筑，是前海区域基础设施与城市建设的关联配图，不是整个前海的鸟瞰。",
      "Residential buildings above the Qianhai depot; an infrastructure and urban-development illustration, not an aerial view of the entire Qianhai area.",
    ),
  },
  "Tokyo-Station-2005-7-21 4.jpg": {
    caption: text(
      "2005-07-21 东京站新干线 16、17 号站台；介绍铁路枢纽，不是丸之内红砖站房立面。",
      "Tokyo Station Shinkansen platforms 16 and 17 on July 21, 2005; a railway-hub illustration, not the Marunouchi brick facade.",
    ),
  },
  "Antoine Étex, Der Friede von 1815, Halbrelief, Arc de Triomphe, Paris.jpg": {
    caption: text(
      "凯旋门的《1815 年和平》雕刻组，作者 Antoine Étex；依据纪念碑官方说明纠正来源描述中的 1813 年笔误。",
      "Antoine Etex's Peace of 1815 sculptural group on the Arc de Triomphe; the monument's official record corrects the source description's erroneous 1813 date.",
    ),
  },
};
