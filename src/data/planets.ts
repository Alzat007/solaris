export type PlanetId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";
export interface PlanetData {
  id: PlanetId;
  name: string;
  chineseName: string;
  radius: number;
  realRadius: number;
  visualRadius: number;
  visualScale: number;
  distance: number;
  orbitSpeed: number;
  rotationSpeed: number;
  color: string;
  particleColor: string;
  moons: string;
  diameter: string;
  distanceFromSun: string;
  orbitalPeriod: string;
  angle: number;
  kind: number;
  description: string;
}
export const planets: PlanetData[] = [
  {
    id: "mercury",
    name: "MERCURY",
    chineseName: "水星",
    radius: 2439.7,
    realRadius: 2439.7,
    visualRadius: 0.25,
    visualScale: 1,
    distance: 4.8,
    orbitSpeed: 0.065,
    rotationSpeed: 0.12,
    color: "#a29b90",
    particleColor: "#cfb99b",
    moons: "0 颗",
    diameter: "4,879 公里",
    distanceFromSun: "5,790 万公里",
    orbitalPeriod: "88 天",
    angle: 2.4,
    kind: 0,
    description: "逐日而行的世界",
  },
  {
    id: "venus",
    name: "VENUS",
    chineseName: "金星",
    radius: 6051.8,
    realRadius: 6051.8,
    visualRadius: 0.44,
    visualScale: 1,
    distance: 6.4,
    orbitSpeed: 0.048,
    rotationSpeed: -0.08,
    color: "#ddbc82",
    particleColor: "#e6c88e",
    moons: "0 颗",
    diameter: "12,104 公里",
    distanceFromSun: "1.082 亿公里",
    orbitalPeriod: "224.7 天",
    angle: 4,
    kind: 1,
    description: "金色云幕下的星球",
  },
  {
    id: "earth",
    name: "EARTH",
    chineseName: "地球",
    radius: 6371,
    realRadius: 6371,
    visualRadius: 0.53,
    visualScale: 1,
    distance: 8.2,
    orbitSpeed: 0.038,
    rotationSpeed: 0.14,
    color: "#669fb6",
    particleColor: "#83c9eb",
    moons: "1 颗",
    diameter: "12,742 公里",
    distanceFromSun: "1.496 亿公里",
    orbitalPeriod: "365.25 天",
    angle: 0.3,
    kind: 2,
    description: "我们的蓝色家园",
  },
  {
    id: "mars",
    name: "MARS",
    chineseName: "火星",
    radius: 3389.5,
    realRadius: 3389.5,
    visualRadius: 0.38,
    visualScale: 1,
    distance: 10.1,
    orbitSpeed: 0.03,
    rotationSpeed: 0.13,
    color: "#ba684b",
    particleColor: "#e99a74",
    moons: "2 颗",
    diameter: "6,779 公里",
    distanceFromSun: "2.279 亿公里",
    orbitalPeriod: "687 天",
    angle: 2.8,
    kind: 3,
    description: "红色星球",
  },
  {
    id: "jupiter",
    name: "JUPITER",
    chineseName: "木星",
    radius: 69911,
    realRadius: 69911,
    visualRadius: 1.12,
    visualScale: 1,
    distance: 12.5,
    orbitSpeed: 0.017,
    rotationSpeed: 0.23,
    color: "#c8ad90",
    particleColor: "#e4c5a0",
    moons: "多颗",
    diameter: "139,820 公里",
    distanceFromSun: "7.786 亿公里",
    orbitalPeriod: "11.86 年",
    angle: 5.9,
    kind: 4,
    description: "行星之王",
  },
  {
    id: "saturn",
    name: "SATURN",
    chineseName: "土星",
    radius: 58232,
    realRadius: 58232,
    visualRadius: 0.91,
    visualScale: 1,
    distance: 15,
    orbitSpeed: 0.013,
    rotationSpeed: 0.21,
    color: "#d3c29c",
    particleColor: "#e2cda8",
    moons: "多颗",
    diameter: "116,460 公里",
    distanceFromSun: "14.3 亿公里",
    orbitalPeriod: "29.45 年",
    angle: 3.9,
    kind: 5,
    description: "环绕万千星尘的世界",
  },
  {
    id: "uranus",
    name: "URANUS",
    chineseName: "天王星",
    radius: 25362,
    realRadius: 25362,
    visualRadius: 0.66,
    visualScale: 1,
    distance: 17.5,
    orbitSpeed: 0.009,
    rotationSpeed: -0.15,
    color: "#8bb8be",
    particleColor: "#a2d7dd",
    moons: "至少 28 颗",
    diameter: "50,724 公里",
    distanceFromSun: "28.7 亿公里",
    orbitalPeriod: "84 年",
    angle: 2.8,
    kind: 6,
    description: "寂静的冰巨星",
  },
  {
    id: "neptune",
    name: "NEPTUNE",
    chineseName: "海王星",
    radius: 24622,
    realRadius: 24622,
    visualRadius: 0.62,
    visualScale: 1,
    distance: 20,
    orbitSpeed: 0.007,
    rotationSpeed: 0.16,
    color: "#4c75bd",
    particleColor: "#699eee",
    moons: "至少 16 颗",
    diameter: "49,244 公里",
    distanceFromSun: "45 亿公里",
    orbitalPeriod: "164.8 年",
    angle: 5.3,
    kind: 7,
    description: "深蓝之境",
  },
];
export const planetById = (id: PlanetId | null) =>
  planets.find((p) => p.id === id);
