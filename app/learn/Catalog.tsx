"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CourseSummary } from '../../lib/course-types';
import { readProgress, rememberProgress, type LearningProgress } from '../../lib/learning-progress';

export default function Catalog() {
  const [lessons, setLessons] = useState<CourseSummary[]>([]);
  const [state, setState] = useState('loading');
  const [progress, setProgress] = useState<LearningProgress>({remember:false,completed:[]});
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/catalog', {signal:controller.signal,cache:'no-store'}).then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(catalog => {setLessons(catalog.lessons);setState('ready');}).catch(() => {if (!controller.signal.aborted) setState('error');});
    const update = () => setProgress(readProgress());
    update(); window.addEventListener('zhihe-progress', update); window.addEventListener('storage', update);
    return () => {controller.abort();window.removeEventListener('zhihe-progress', update);window.removeEventListener('storage', update);};
  }, []);
  const completed = lessons.filter(lesson => progress.completed.includes(lesson.slug)).length;
  return <div className="learn-page">
    <header className="learn-nav"><Link className="brand" href="/" aria-label="知合首页"><span className="brand-mark">知合</span><span className="brand-latin">ZHIHE</span></Link><Link href="/checkout">购买课程 ↗</Link></header>
    <main className="library-main">
      <div className="library-heading"><div><p className="eyebrow">关系练习室 / SEASON 01</p><h1>把亲密，<br />练成日常。</h1><p>七节有方法、有情境、有练习卡的中文沟通课。<br />独自开始也可以，不必分享任何私密经历。</p></div><div className="library-stamp"><strong>07</strong><span>节完整内容草稿</span><small>18+ · 非露骨 · 待独立审阅</small></div></div>
      <aside className="simulation-note"><strong>第 1 课免费 · 第 2–7 课付费</strong><p>先完整学一课，做练习、看解析、领取练习卡。想继续时，再购买其余六课。目前暂未开放购买，正式价格与币种将在开放时公布。</p><Link href="/learn/expression">免费学习第 1 课 →</Link><p><Link href="/checkout">查看付费课程方案 →</Link></p></aside>
      <section className="library-progress" aria-label="本机学习记录"><div><strong>{progress.remember ? `本机已完成 ${completed} / 7 课` : '按自己的节奏，一次练一件事。'}</strong><p>只记课号，不记答案；换浏览器不会同步。取消后删除本机完成标记。</p></div><label><input type="checkbox" checked={progress.remember} onChange={event => {if (!rememberProgress(event.target.checked)) setMessage('浏览器未允许保存，仍可完整学习。');else setMessage('');}} />在这台浏览器记住完成课号</label></section>
      <p role="status">{message}</p>
      {state === 'loading' && <p role="status">正在加载课程…</p>}
      {state === 'error' && <div className="learn-note" role="alert">课程暂时无法加载，请确认本地服务仍在运行。<button className="learn-back" onClick={() => window.location.reload()}>重新加载</button></div>}
      <div className="course-grid">{lessons.map(lesson => <article className="course-card" key={lesson.slug}>
        <div className="course-card-top"><span>{String(lesson.number).padStart(2,'0')}</span><small>{lesson.number === 1 ? (progress.completed.includes(lesson.slug) ? '免费课 · 已完成' : '免费学习') : '付费课程 · 未解锁'}</small></div>
        <h2>{lesson.title}</h2><p>{lesson.subtitle}</p><div className="course-goal">这一课，练会：{lesson.goal}</div><div className="course-card-bottom"><span>约 {lesson.duration} 分钟</span><Link href={lesson.number === 1 ? `/learn/${lesson.slug}` : '/checkout'}>{lesson.number === 1 ? '免费学习' : '查看购买方案'} →</Link></div>
      </article>)}</div>
      <section className="library-bottom"><h2>学习不是把对方说服。</h2><p>你可以暂停、拒绝、改变主意。若表达意见会引来威胁、控制或伤害，请先考虑安全，而非尝试用更好的措辞解决一切。</p><Link href="/privacy">隐私、撤回与本机数据说明 →</Link></section>
    </main>
  </div>;
}
