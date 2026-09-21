import type { LogisticsState } from "./types";

// 种子数据：覆盖超温拒收、款项差额、返仓占用等演示场景
export function seedState(): LogisticsState {
  const now = Date.now();
  const iso = (offsetMinutes: number) => new Date(now - offsetMinutes * 60000).toISOString();

  return {
    stations: [
      { id: "S1", name: "张江站", capacity: 6 },
      { id: "S2", name: "金桥站", capacity: 5 }
    ],
    riders: [
      { id: "R1", name: "骑手A·李雷", stationId: "S1", capacity: 4 },
      { id: "R2", name: "骑手B·韩梅", stationId: "S1", capacity: 4 },
      { id: "R3", name: "骑手C·王芳", stationId: "S2", capacity: 3 }
    ],
    returnPoints: [
      { id: "RP1", name: "张江冷链返仓点", stationId: "S1" },
      { id: "RP2", name: "金桥返仓点", stationId: "S2" },
      { id: "RP3", name: "张江常温返仓点", stationId: "S1" }
    ],
    orders: [
      {
        id: "O1",
        code: "DD-1001",
        address: "世纪大道 88 号",
        riderId: "R1",
        stationId: "S1",
        returnPointId: "RP3",
        receivable: 128,
        cash: 100,
        epay: 28,
        tempLimit: 8,
        tempNow: 5,
        status: "待签收",
        settled: false,
        createdAt: iso(300)
      },
      {
        id: "O2",
        code: "DD-1002",
        address: "陆家嘴环路 1000 号",
        riderId: "R1",
        stationId: "S1",
        returnPointId: "RP1",
        receivable: 256,
        cash: 0,
        epay: 256,
        tempLimit: 4,
        tempNow: 9, // 超温：只能拒收
        status: "待签收",
        settled: false,
        createdAt: iso(260)
      },
      {
        id: "O3",
        code: "DD-1003",
        address: "祖冲之路 555 号",
        riderId: "R2",
        stationId: "S1",
        returnPointId: "RP3",
        receivable: 96,
        cash: 96,
        epay: 0,
        tempLimit: 10,
        tempNow: 6,
        status: "已签收",
        settled: false,
        createdAt: iso(200)
      },
      {
        id: "O4",
        code: "DD-1004",
        address: "金科路 2889 弄",
        riderId: "R2",
        stationId: "S1",
        returnPointId: "RP1",
        receivable: 150,
        cash: 100,
        epay: 30, // 差额 -20：挂账演示
        tempLimit: 6,
        tempNow: 4,
        status: "已签收",
        settled: false,
        createdAt: iso(160)
      },
      {
        id: "O5",
        code: "DD-1005",
        address: "金海路 1200 号",
        riderId: "R3",
        stationId: "S2",
        returnPointId: "RP2",
        receivable: 210,
        cash: 0,
        epay: 0,
        tempLimit: 4,
        tempNow: 11,
        status: "已拒收",
        settled: false,
        createdAt: iso(120)
      },
      {
        id: "O6",
        code: "DD-1006",
        address: "川沙路 66 号",
        riderId: "R3",
        stationId: "S2",
        returnPointId: "RP2",
        receivable: 75,
        cash: 75,
        epay: 0,
        tempLimit: 12,
        tempNow: 7,
        status: "待签收",
        settled: false,
        createdAt: iso(60)
      }
    ],
    versions: [
      {
        id: "V1",
        orderId: "O3",
        version: 1,
        receivable: 96,
        cash: 96,
        epay: 0,
        reason: "首次签收",
        signedAt: iso(180)
      },
      {
        id: "V2",
        orderId: "O4",
        version: 1,
        receivable: 150,
        cash: 100,
        epay: 30,
        reason: "首次签收",
        signedAt: iso(140)
      }
    ],
    returns: [
      {
        id: "RO1",
        orderId: "O5",
        orderCode: "DD-1005",
        riderId: "R3",
        stationId: "S2",
        returnPointId: "RP2",
        reason: "超温拒收：实测 11℃ 高于上限 4℃",
        tempNow: 11,
        tempLimit: 4,
        status: "待返仓", // 未关闭：持续占用 R3 与 S2 容量
        createdAt: iso(100),
        closedAt: null
      }
    ],
    settlements: []
  };
}
