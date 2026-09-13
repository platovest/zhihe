"use client";

import { useState } from "react";
import type { Order } from "../../db/commerce";

const labels: Record<Order["status"], string> = {
  pending: "待演练支付", cancelled: "已取消", simulated_paid: "演练支付成功",
  refund_requested: "待演练退款", simulated_refunded: "演练退款完成",
};
const buttonStyle = { padding: "9px 14px", border: "1px solid #aaa", borderRadius: 6, margin: "4px", background: "white", color: "#252b24" };

export default function CommercePanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function request(path = "", method = "GET") {
    const response = await fetch(`/api/admin/commerce${path}`, {
      method, cache: "no-store", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error === "local_only" ? "订单演练仅允许在本机访问。" : response.status === 401 ? "管理口令不正确。" : response.status === 409 ? "订单状态已变化，请刷新后重试。" : "操作未完成，请检查配置或稍后重试。");
    }
    return response.json();
  }
  async function act(action?: { id: string; operation: "refund" | "delete" }) {
    setBusy(true); setMessage("");
    try {
      if (action) await request(`/${action.id}/${action.operation}`, "POST");
      setOrders((await request()).orders);
      if (action) setMessage(action.operation === "refund" ? "演练退款已完成，该订单不再授予课程访问。没有发生资金转账。" : "已删除这条已结束的演练订单。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "请求失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <section style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #aaa" }}>
    <h2>订单与退款 · 本地演练</h2>
    <p>所有订单均为 local_simulation。金额 ¥199 仅用于演练，不收款、不转账。最多展示最近 500 条。</p>
    <button style={buttonStyle} disabled={busy} onClick={() => void act()}>{busy ? "处理中…" : "加载 / 刷新演练订单"}</button>
    {orders && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
      <thead><tr>{["订单", "创建时间", "演练金额", "状态", "操作"].map((text) => <th key={text} style={{ padding: 10 }}>{text}</th>)}</tr></thead>
      <tbody>{orders.map((order) => <tr key={order.id}>
        <td style={{ padding: 10, maxWidth:220, overflowWrap:'anywhere' }}><code>{order.id}</code></td>
        <td style={{ padding: 10 }}>{new Date(order.createdAt).toLocaleString("zh-CN")}</td>
        <td style={{ padding: 10 }}>¥{(order.amount / 100).toFixed(2)}</td>
        <td style={{ padding: 10 }}>{labels[order.status]}</td>
        <td style={{ padding: 10 }}>
          {order.status === "refund_requested" && <button style={buttonStyle} disabled={busy} onClick={() => {
            if (window.confirm("确认完成演练退款？该订单将不再授予课程访问。不会发生真实资金退款。")) void act({ id: order.id, operation: "refund" });
          }}>完成演练退款</button>}
          {["cancelled", "simulated_refunded"].includes(order.status) && <button style={buttonStyle} disabled={busy} onClick={() => {
            if (window.confirm("永久删除这条已结束的演练订单？")) void act({ id: order.id, operation: "delete" });
          }}>删除演练订单</button>}
        </td>
      </tr>)}</tbody>
    </table>{orders.length === 0 && <p>暂无演练订单。</p>}</div>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
