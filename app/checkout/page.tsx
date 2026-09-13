"use client";

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import './checkout.css';

type Order = {id:string;amount:number;currency:string;status:'pending'|'cancelled'|'simulated_paid'|'refund_requested'|'simulated_refunded';createdAt:string;updatedAt:string};
type Account = {orders:Order[];access:boolean};
const labels = {pending:'待演练支付',cancelled:'已取消',simulated_paid:'模拟支付完成',refund_requested:'退款申请待处理',simulated_refunded:'模拟退款完成'};
const errors:Record<string,string> = {simulated_decline:'已模拟支付失败：订单仍待支付，未开通权益，可以重试。',invalid_transition:'当前订单状态不支持此操作，请查看刷新后的状态。',not_found:'未找到属于当前浏览器身份的订单。',invalid_input:'请检查输入并确认演练说明。',rate_limited:'请求过于频繁，请稍后重试。',local_only:'交易演练只能在本机运行。',idempotency_conflict:'该请求已使用。请刷新订单列表检查，不要把重复请求当作新订单。'};

export default function Checkout() {
  const [account,setAccount] = useState<Account | null>(null);
  const [busy,setBusy] = useState(false);
  const [consent,setConsent] = useState(false);
  const [message,setMessage] = useState('');
  const [loaded,setLoaded] = useState(false);
  const createKey = useRef<string | null>(null);
  async function load() {
    const response = await fetch('/api/commerce/me',{cache:'no-store'});
    if (!response.ok) throw new Error('订单暂时无法读取，请确认本地服务仍在运行。');
    const result = await response.json();
    setAccount(result);setLoaded(true);
  }
  useEffect(() => {
    let active=true;
    void fetch('/api/commerce/me',{cache:'no-store'}).then(async response => {if (!response.ok) throw new Error();return response.json();}).then(result => {if(active){setAccount(result);setLoaded(true);}}).catch(() => {if(active){setLoaded(true);setMessage('订单暂时无法读取，请重试。');}});
    return () => {active=false;};
  },[]);
  async function send(path:string,body:unknown={}) {
    const response = await fetch(`/api/commerce/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(errors[result.error] ?? '本次操作未完成，请刷新订单状态后重试。');
    return result;
  }
  async function run(action:()=>Promise<void>) {
    setBusy(true);setMessage('');
    try {await action();} catch(error) {setMessage(error instanceof Error?error.message:'暂时无法连接，请检查订单状态后重试。');}
    finally {try {await load();} catch {setAccount(null);setMessage('无法确认最新订单状态，请重试；不要将网络错误理解为已支付。');}setBusy(false);}
  }
  function create(event:FormEvent) {
    event.preventDefault();if (!consent || busy) return;
    createKey.current ??= crypto.randomUUID();
    void run(async () => {await send('orders',{consent:true,idempotencyKey:createKey.current});createKey.current=null;setConsent(false);setMessage('演练订单已创建。你可以测试成功、失败或取消，不涉及真实资金。');});
  }
  function action(order:Order,kind:'pay'|'cancel'|'refund',outcome?:'success'|'failure') {
    if (kind==='refund' && !window.confirm('提交本地模拟退款申请？这不会退回任何真实资金，需运营台确认后撤销演练权益。')) return;
    void run(async () => {await send(`orders/${order.id}/${kind}`,outcome?{outcome}:{});setMessage(kind==='pay'?'模拟支付已完成，演练权益已开通，没有扣款。':kind==='cancel'?'演练订单已取消。':'模拟退款申请已提交。运营处理期间仍可学习；完成后将撤销对应权益。');});
  }
  const pending = account?.orders.some(order => order.status==='pending');
  return <div className="checkout-page"><header className="checkout-nav"><Link className="brand" href="/"><span className="brand-mark">知合</span><span className="brand-latin">ZHIHE</span></Link><Link href="/learn">回到课程目录 ↗</Link></header>
    <main className="checkout-main"><p className="eyebrow">LOCAL SIMULATION / 本地演练</p><h1>把交付走通，<br />不用真的付款。</h1><p className="checkout-lead">这个页面用于验收订单、课程权益与退款流程。没有接入支付机构，不收集银行卡，不扣款，也没有真实收入或退款。</p>
      <div className="checkout-grid"><section className="checkout-product"><span className="checkout-tag">七课完整内容草稿 · 待独立审阅</span><h2>首季关系练习室</h2><p>从表达需要到建立共同习惯，七节课程、情境练习、知识解析与各课练习卡。</p><ul><li>第 1 课免费，无需订单。</li><li>第 2–7 课经服务端检查演练权益后可读。</li><li>模拟支付失败或取消不会开通权益。</li><li>模拟退款完成后撤销对应权益。</li></ul><div className="checkout-price"><strong>¥199</strong><span>仅为演练金额<br />实际扣款 ¥0</span></div><p className="checkout-small">这不是正式商品销售、预约名额或永久服务承诺。正式销售规则需在上线前另行确定。</p><Link href="/terms">查看内测与演练规则 →</Link></section>
      <section className="checkout-control"><h2>当前浏览器的演练身份</h2><p>{!account?(loaded?'暂时无法确认权益，请重试。':'正在确认本机权益…'):account.access?'演练权益已开通：可以学习七课。':'暂无后六课权益；仍可免费学习第 1 课。'}</p>{account?.access && <Link className="checkout-primary" href="/learn">开始学习七课 →</Link>}
        {!loaded && <p role="status">正在读取订单…</p>}
        {loaded && !account && <button disabled={busy} className="checkout-secondary" onClick={() => void run(async () => {})}>重新读取订单</button>}
        {account && !account.access && !pending && <form onSubmit={create}><label className="checkout-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>我理解这是本地模拟交易、不扣款；同意用本机必要 Cookie 识别本次演练订单，并已阅读<Link href="/privacy">隐私说明</Link>与<Link href="/terms">演练规则</Link>。</span></label><button className="checkout-primary" disabled={busy || !consent}>创建 ¥199 演练订单（不扣款）</button></form>}
        {pending && <p className="checkout-callout">已有待支付演练订单，请在下方测试成功、失败或取消。</p>}
        <div className="checkout-tools"><button disabled={busy} onClick={() => void run(async () => {})}>刷新状态</button>{account && account.orders.length>0 && <button disabled={busy} onClick={() => {if(window.confirm('退出会清除当前浏览器的演练身份，无法在此恢复原订单。服务器演练记录仍保留，由运营台清理。确定退出？')) void run(async () => {await send('logout');createKey.current=null;setConsent(false);setMessage('已退出本浏览器演练身份，不代表删除服务器订单。');});}}>退出演练身份</button>}</div><p className="checkout-small">不需要邮箱或账户。身份只存在这台浏览器；更换浏览器或退出后无法自行找回原演练订单。与真实联络意向名单分开保存。</p>
      </section></div>
      <p className="checkout-message" role="status" aria-live="polite">{busy?'正在处理，请勿重复点击…':message}</p>
      <section className="checkout-orders"><div className="checkout-section-title"><h2>我的演练订单</h2><span>所有金额均为模拟</span></div>{loaded && account?.orders.length===0 && <p className="checkout-empty">还没有演练订单。可以先学免费课，再回来检查交易流程。</p>}{account?.orders.map(order => <article className="order-card" key={order.id}><div className="order-heading"><strong>{labels[order.status]}</strong><span>¥{(order.amount/100).toFixed(2)} · {order.currency} · 演练</span></div><p className="order-id">订单号：{order.id}</p><p className="checkout-small">创建于 {new Date(order.createdAt).toLocaleString('zh-CN')}</p><div className="order-actions">{order.status==='pending' && <><button className="checkout-primary" disabled={busy} onClick={() => action(order,'pay','success')}>模拟支付成功（不扣款）</button><button className="checkout-secondary" disabled={busy} onClick={() => action(order,'pay','failure')}>测试支付失败</button><button className="checkout-text" disabled={busy} onClick={() => action(order,'cancel')}>取消演练订单</button></>}{order.status==='simulated_paid' && <><Link className="checkout-primary" href="/learn">进入课程</Link><button className="checkout-secondary" disabled={busy} onClick={() => action(order,'refund')}>申请模拟退款</button></>}{order.status==='refund_requested' && <p>已提交申请，需本地运营人员在运营台确认；尚未完成模拟退款，当前仍可学习。</p>}{order.status==='simulated_refunded' && <p>这笔订单的演练权益已撤销，没有发生真实退款。此前已下载的练习卡不会被远程删除。</p>}{order.status==='cancelled' && <p>订单已取消，不会授予课程权益，也没有扣款。</p>}</div></article>)}</section>
      <div className="checkout-support"><h2>遇到问题怎么办？</h2><p>先刷新订单状态。仍无法解决时，把演练订单号交给主持本次内测的运营人员；不要提交银行卡或私密经历。模拟退款由运营台处理，不是自动退还资金。</p><Link href="/#offer">不做演练，只登记未来正式课程联络意向 →</Link></div>
    </main>
  </div>;
}
