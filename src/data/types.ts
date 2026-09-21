// 领域类型：订单、款项快照、返仓单、交班结算

export type OrderStatus = "待签收" | "已签收" | "已拒收";
export type ReturnStatus = "待返仓" | "已关闭";
export type SettlementStatus = "已对平" | "已挂账";

export interface Station {
  id: string;
  name: string;
  capacity: number; // 站点容量（在途订单 + 未关闭返仓单占用）
}

export interface Rider {
  id: string;
  name: string;
  stationId: string;
  capacity: number; // 骑手容量
}

export interface ReturnPoint {
  id: string;
  name: string;
  stationId: string;
}

export interface Order {
  id: string;
  code: string; // 订单号
  address: string;
  riderId: string;
  stationId: string;
  returnPointId: string; // 返仓点
  receivable: number; // 应收款
  cash: number; // 现金
  epay: number; // 电子支付
  tempLimit: number; // 温区上限 ℃
  tempNow: number; // 实测温度 ℃
  status: OrderStatus;
  settled: boolean; // 是否已纳入交班结算
  createdAt: string;
}

// 签收版本：每次签收/复签留下付款快照
export interface SignoffVersion {
  id: string;
  orderId: string;
  version: number;
  receivable: number;
  cash: number;
  epay: number;
  reason: string; // 复签原因，首签为「首次签收」
  signedAt: string;
}

// 返仓单：超温拒收生成，未关闭前占用原骑手与站点容量
export interface ReturnOrder {
  id: string;
  orderId: string;
  orderCode: string;
  riderId: string;
  stationId: string;
  returnPointId: string;
  reason: string;
  tempNow: number;
  tempLimit: number;
  status: ReturnStatus;
  createdAt: string;
  closedAt: string | null;
}

// 交班结算：支付必须对平，差额挂账后才允许签收交班
export interface Settlement {
  id: string;
  riderId: string;
  expectedCash: number;
  expectedEpay: number;
  actualCash: number;
  actualEpay: number;
  cashDiff: number;
  epayDiff: number;
  suspense: number; // 挂账金额
  status: SettlementStatus;
  orderIds: string[];
  createdAt: string;
}

export interface LogisticsState {
  orders: Order[];
  riders: Rider[];
  stations: Station[];
  returnPoints: ReturnPoint[];
  versions: SignoffVersion[];
  returns: ReturnOrder[];
  settlements: Settlement[];
}
