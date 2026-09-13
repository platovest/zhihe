"use client";

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  const [token, setToken] = useState('');
  const [state, setState] = useState('');
  async function withdraw(event: FormEvent) {
    event.preventDefault();
    setState('处理中…');
    try {
      const response = await fetch('/api/interest', {method:'DELETE', headers:{'content-type':'application/json'}, body:JSON.stringify({token:token.trim().toLowerCase()})});
      setState(response.ok ? '已处理撤回请求。如果凭证对应有效登记，该登记已删除。' : '未能处理，请检查凭证后重试。');
    } catch { setState('暂时无法连接，请稍后重试。'); }
  }
  return <main className="privacy-page">
    <Link href="/">← 返回知合</Link>
    <h1>隐私与撤回登记</h1>
    <p>第 1 课无需注册即可免费学习，其余 6 课为付费课程，当前尚未开放购买。更新日期：2026-09-13。</p>
    <h2>我们保存什么</h2>
    <p>只有你主动提交意向时，才保存邮箱、报价版本、粗粒度来源、同意版本、登记时间和人工跟进状态。练习选择和自查内容不上传。没有广告追踪或 AI 对话服务。</p>
    <p>匿名统计需你单独勾选同意；统计的是使用次数，不关联邮箱或练习答案。首页和课程页分别征求同意，刷新后重置。未同意不会影响学习或登记。</p>
    <h2>本机完成记录</h2>
    <p>可选的学习记录仅在这台浏览器保存已完成课号，不含答案或身份；取消“记住完成课号”即可清除，刷新保留但不跨设备同步。共用电脑时请在离开前关闭这个选项。</p>
    <p>免费学习不需要订单或登录 Cookie，不收集银行卡。未来接入支付时，会在购买前更新订单、身份和个人信息处理说明。</p>
    <p>如果你参加过此前的内部交易测试：旧测试 Cookie 和记录不代表已购买，不会授予付费课程权益。可在浏览器清除本站 Cookie，服务器旧测试记录由运营人员定向清理；备份也须同步处理。</p>
    <h2>保存在哪里、用于什么</h2>
    <p>本地运行时数据保存在运行本网站的电脑中，仅授权运营人员可查看或导出意向。联系用途仅为未来课程开放时的一次人工联系。当前版本不自动发送邮件，导出文件也必须按这个用途保管。</p>
    <p>我们不承诺自动定时删除。运营流程要求定期清理超过 90 天的登记，并同步清理导出与备份。备份恢复后须重新执行撤回与过期清理记录。正式公开前还需明确运营主体和可用联系渠道。</p>
    <h2>撤回你的登记</h2>
    <p>填写首次成功登记时保存的撤回凭证。重复登记不替换原凭证；为保护邮箱隐私，页面不提示该邮箱是否已登记。若遗失凭证，请联系主持本次内测的运营人员核对处理。</p>
    <form onSubmit={withdraw}>
      <label htmlFor="withdraw-token">撤回凭证</label>
      <input id="withdraw-token" value={token} onChange={event => setToken(event.target.value)} required pattern="[a-fA-F0-9]{64}" maxLength={64} autoComplete="off" spellCheck={false} placeholder="粘贴 64 位撤回凭证" />
      <button className="primary-button" disabled={state === '处理中…'}>撤回并删除登记</button>
      <p role="status">{state}</p>
    </form>
  </main>;
}
