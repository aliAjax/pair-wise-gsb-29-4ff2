// 数据层：初始种子数据。仅作演示，实际使用后以 localStorage 为准。
import type { DeliveryState } from "./types";
import { ZONE_DEFAULT_LIMIT } from "./types";

const now = Date.now();
const iso = (offsetMin: number) => new Date(now - offsetMin * 60000).toISOString();

export const STORAGE_KEY = "hxwlfront-15-last-mile-v2";

export function createSeedState(): DeliveryState {
  return {
    version: 2,
    seq: 6,
    riders: [
      { id: "r1", name: "骑手A", capacity: 3 },
      { id: "r2", name: "骑手B", capacity: 3 },
      { id: "r3", name: "骑手C", capacity: 2 }
    ],
    stations: [
      { id: "s1", name: "世纪大道站", capacity: 6 },
      { id: "s2", name: "陆家嘴站", capacity: 5 }
    ],
    returnPoints: [
      { id: "p1", name: "世纪大道站返仓口" },
      { id: "p2", name: "陆家嘴站冷库" }
    ],
    orders: [
      {
        id: "o1",
        code: "DD20260921001",
        address: "世纪大道 100 号",
        riderId: "r1",
        stationId: "s1",
        returnPointId: "p1",
        tempZone: "冷藏",
        tempLimit: ZONE_DEFAULT_LIMIT["冷藏"],
        receivable: 86.5,
        status: "已登记",
        createdAt: iso(120),
        versions: []
      },
      {
        id: "o2",
        code: "DD20260921002",
        address: "陆家嘴环路 200 号",
        riderId: "r2",
        stationId: "s2",
        returnPointId: "p2",
        tempZone: "冷冻",
        tempLimit: ZONE_DEFAULT_LIMIT["冷冻"],
        receivable: 120,
        status: "已登记",
        createdAt: iso(100),
        versions: []
      },
      {
        id: "o3",
        code: "DD20260921003",
        address: "张杨路 88 号",
        riderId: "r1",
        stationId: "s1",
        returnPointId: "p1",
        tempZone: "常温",
        tempLimit: ZONE_DEFAULT_LIMIT["常温"],
        receivable: 45,
        status: "已登记",
        createdAt: iso(60),
        versions: []
      },
      {
        id: "o4",
        code: "DD20260921004",
        address: "东昌路 12 号",
        riderId: "r3",
        stationId: "s2",
        returnPointId: "p2",
        tempZone: "冷藏",
        tempLimit: ZONE_DEFAULT_LIMIT["冷藏"],
        receivable: 60,
        status: "已签收",
        createdAt: iso(50),
        versions: [
          {
            version: 1,
            type: "签收",
            time: iso(30),
            operator: "站务甲",
            reason: "正常签收",
            actualTemp: 6,
            payment: { receivable: 60, cash: 20, ePay: 40 }
          }
        ]
      }
    ],
    returns: [],
    handovers: []
  };
}
