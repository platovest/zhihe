"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type Summary = {
  total: number;
  byStatus: { status: string; count: number }[];
  events: { event: string; count: number }[];
  interests: { id: string; email: string; createdAt: string; status: string; source: string }[];
};
const statusLabels: Record<string, string> = { new: "待跟进", contacted: "已人工联系", closed: "已结束" };
const eventLabels: Record<string, string> = { visit: "访问", trial_start: "开始试听", trial_complete: "完成试听", lesson_start: "开始课程", lesson_complete: "完成课程", price_view: "打开意向登记", interest_confirmed: "确认意向" };
const fieldStyle = { padding: "0.65rem", border: "1px solid #b7b1a7", borderRadius: 6, background: "white", color: "#252b24" };

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`/api/admin/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 503 ? "后台尚未配置或数据库暂不可用，请检查本地 ADMIN_TOKEN 和服务日志。" : response.status === 401 ? "管理口令不正确。" : response.status === 429 ? "请求过于频繁，请一分钟后重试。" : "操作失败，请重试。");
    return response;
  }
  async function load() { setSummary(await (await request("summary")).json()); }
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "连接失败，请检查本地服务。"); }
    finally { setBusy(false); }
  }
  function login(event: FormEvent) { event.preventDefault(); void run(load); }
  async function download() {
    const blob = await (await request("export")).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "zhihe-interests.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  return <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px", color: "#252b24" }}>
    <Link href="/">← 返回知合</Link>
    <h1 style={{ marginTop: 24 }}>内测运营台</h1>
    <p>查看登记、导出 CSV、记录人工跟进。这里不会自动发送邮件。</p>
    {!summary ? <form onSubmit={login} style={{ display: "grid", gap: 12, maxWidth: 480, marginTop: 24 }}>
      <label htmlFor="admin-token">管理口令</label>
      <input id="admin-token" type="password" autoComplete="off" required minLength={32} value={token} onChange={(event) => setToken(event.target.value)} style={fieldStyle} />
      <button type="submit" disabled={busy} style={fieldStyle}>{busy ? "连接中…" : "进入运营台"}</button>
      <small>口令只保存在当前页面内存，刷新后需要重新输入。</small>
    </form> : <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "24px 0" }}>
        <button disabled={busy} onClick={() => void run(load)} style={fieldStyle}>刷新数据</button>
        <button disabled={busy} onClick={() => void run(download)} style={fieldStyle}>导出全部登记 CSV</button>
        <button disabled={busy} style={fieldStyle} onClick={() => {
          if (window.confirm("永久删除登记超过 90 天的邮箱与跟进状态？请同时处理已导出的副本。")) void run(async () => { await request("purge", { method: "POST" }); await load(); setMessage("已清理超过 90 天的登记。请同步删除导出文件和备份中的过期个人信息。"); });
        }}>清理过期登记</button>
        <button disabled={busy} style={fieldStyle} onClick={() => { setToken(""); setSummary(null); setMessage(""); }}>退出</button>
      </div>
      <h2>当前有效登记：{summary.total}</h2>
      <p>{summary.byStatus.map((item) => `${statusLabels[item.status] ?? item.status} ${item.count}`).join(" · ") || "暂无登记"}</p>
      <h2 style={{ marginTop: 24 }}>匿名事件次数</h2>
      <p>仅统计主动同意分析的用户操作。不是独立人数，也不能据此计算精确的个人转化率。</p>
      <ul>{summary.events.map((item) => <li key={item.event}>{eventLabels[item.event] ?? item.event}：{item.count}</li>)}</ul>
      <h2 style={{ marginTop: 24 }}>最近 500 条登记</h2>
      <p>仅在用户同意的内测联络范围内人工联系；完成实际联系后再标记状态。</p>
      <div style={{ overflowX: "auto", marginTop: 16 }}><table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
        <thead><tr>{["邮箱", "登记时间", "来源", "跟进状态"].map((label) => <th key={label} style={{ padding: 12, borderBottom: "1px solid #aaa" }}>{label}</th>)}</tr></thead>
        <tbody>{summary.interests.map((item) => <tr key={item.id}>
          <td style={{ padding: 12 }}>{item.email}</td><td style={{ padding: 12 }}>{new Date(item.createdAt).toLocaleString("zh-CN")}</td><td style={{ padding: 12 }}>{item.source}</td>
          <td style={{ padding: 12 }}><select aria-label={`${item.email} 的跟进状态`} disabled={busy} value={item.status} style={fieldStyle} onChange={(event) => {
            const status = event.target.value;
            void run(async () => { await request("interest", { method: "PATCH", body: JSON.stringify({ id: item.id, status }) }); await load(); });
          }}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <button disabled={busy} style={{ ...fieldStyle, marginTop: 8 }} onClick={() => {
              if (window.confirm(`确认已核实撤回请求，并永久删除 ${item.email} 的登记？`)) void run(async () => { await request("interest", { method: "DELETE", body: JSON.stringify({ id: item.id }) }); await load(); setMessage("已删除登记。请同步处理导出文件和备份中的副本。"); });
            }}>删除登记</button>
          </td>
        </tr>)}</tbody>
      </table></div>
    </>}
    <p role="status" aria-live="polite" style={{ marginTop: 16 }}>{message}</p>
  </main>;
}
