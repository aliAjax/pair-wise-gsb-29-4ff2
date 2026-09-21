// 数据层：领域模型。只描述结构，不含任何业务判断。

export type TempZone = "常温" | "冷藏" | "冷冻";

export type OrderStatus = "已登记" | "已签收" | "拒收返仓";

export type PayMethod = "现金" | "电子支付";

export const TEMP_ZONES: readonly TempZone[] = ["常温", "冷藏", "冷冻"];

export const PAY_METHODS: readonly PayMethod[] = ["现金", "电子支付"];

/** 温区默认上限（℃），登记时可手动覆盖 */
export const ZONE_DEFAULT_LIMIT: Record<TempZone, number> = {
  常温: 25,
  冷藏: 8,
  冷冻: -12
};

/** 一笔代收款快照：现金 + 电子支付，二者合计应等于应收 */
export interface PaymentSnapshot {
  receivable: number;
  cash: number;
  ePay: number;
}

/** 签收留痕；复签追加新版本，旧版本不可修改 */
export interface SignVersion {
  version: number;
  type: "签收" | "复签";
  time: string;
  operator: string;
  reason: string;
  actualTemp: number;
  payment: PaymentSnapshot;
}

/** 订单：登记应收、现金/电子支付、温区上限、返仓点 */
export interface Order {
  id: string;
  code: string;
  address: string;
  riderId: string;
  stationId: string;
  returnPointId: string;
  tempZone: TempZone;
  tempLimit: number;
  receivable: number;
  status: OrderStatus;
  createdAt: string;
  /** 拒收时间，已签收订单复拒收时写入 */
  rejectedAt?: string;
  versions: SignVersion[];
}

/** 返仓单：超温拒收自动生成，占用原骑手与站点容量，关闭后释放 */
export interface ReturnOrder {
  id: string;
  code: string;
  orderId: string;
  riderId: string;
  stationId: string;
  returnPointId: string;
  actualTemp: number;
  tempLimit: number;
  reason: string;
  createdAt: string;
  status: "待返仓" | "已关闭";
  closedAt?: string;
}

export interface Rider {
  id: string;
  name: string;
  capacity: number;
}

export interface Station {
  id: string;
  name: string;
  capacity: number;
}

export interface ReturnPoint {
  id: string;
  name: string;
}

/** 骑手交班：现金/电子支付必须对平；差额可挂账，未挂账不得交班签收 */
export interface HandoverRecord {
  id: string;
  code: string;
  riderId: string;
  shiftDate: string;
  time: string;
  expectedCash: number;
  expectedEPay: number;
  actualCash: number;
  actualEPay: number;
  diff: number;
  posted: boolean;
  note: string;
  /** 挂账后关联的订单签收版本 */
  coveredVersionKeys: string[];
}

export interface DeliveryState {
  version: number;
  seq: number;
  riders: Rider[];
  stations: Station[];
  returnPoints: ReturnPoint[];
  orders: Order[];
  returns: ReturnOrder[];
  handovers: HandoverRecord[];
}

/** 冲突台行：订单、骑手、差额、温度四要素齐备 */
export interface ConflictRow {
  type: "超温未处理" | "款项差额" | "容量超限" | "返仓待关闭";
  level: "danger" | "warning";
  orderId?: string;
  riderId?: string;
  stationId?: string;
  returnId?: string;
  diff?: number;
  actualTemp?: number;
  tempLimit?: number;
  detail: string;
}

export interface SignInput {
  operator: string;
  reason: string;
  actualTemp: number;
  cash: number;
  ePay: number;
}
