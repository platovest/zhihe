"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CourseLesson } from '../../lib/course-types';
import { markComplete, readProgress, rememberProgress } from '../../lib/learning-progress';

const stages = ['开始','学习','情境练习','试着改写','知识检验','完成'];
type Result = {slug:string;lesson?:CourseLesson;error?:string};

export default function Lesson({slug}:{slug:string}) {
  const [result,setResult] = useState<Result | null>(null);
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/lessons/${encodeURIComponent(slug)}`, {cache:'no-store',signal:controller.signal});
        if (!response.ok) {setResult({slug,error:response.status === 403 ? 'locked' : response.status === 404 ? 'missing' : 'network'});return;}
        const body = await response.json();
        setResult({slug,lesson:body.lesson});
      } catch {if (!controller.signal.aborted) setResult({slug,error:'network'});}
    }
    void load();
    const recheck = () => {if (document.visibilityState === 'visible') void load();};
    window.addEventListener('focus',recheck); document.addEventListener('visibilitychange',recheck);
    return () => {controller.abort();window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',recheck);};
  },[slug,retry]);
  const current = result?.slug === slug ? result : null;
  return <div className="learn-page"><header className="learn-nav"><Link className="brand" href="/" aria-label="知合首页"><span className="brand-mark">知合</span><span className="brand-latin">ZHIHE</span></Link><div className="learn-nav-actions"><Link href="/learn">课程目录</Link><Link href="/checkout">购买课程</Link></div></header>
    {!current && <main className="learn-main"><p role="status">正在加载课程…</p></main>}
    {current?.error && <main className="learn-main"><section className="learn-panel"><p className="eyebrow">关系练习室</p><h1>{current.error === 'locked' ? '这节课是付费课程。' : current.error === 'missing' ? '没有找到这节课。' : '课程暂时无法加载。'}</h1><p>{current.error === 'locked' ? '第 1 课完整免费，第 2–7 课需要购买后学习。目前暂未开放购买，不能解锁后六课；你可以先完成免费课，再了解课程方案。' : current.error === 'missing' ? '请回课程目录选择已开放的课程。' : '请检查本地服务是否仍在运行，网络恢复后可以重试。'}</p><div className="learn-end-links">{current.error === 'locked' && <Link className="learn-primary" href="/checkout">查看付费课程方案 →</Link>}{current.error === 'network' && <button className="learn-primary" onClick={() => setRetry(value => value+1)}>重新加载</button>}<Link href="/learn">返回课程目录</Link><Link href="/learn/expression">先学免费第 1 课</Link></div></section></main>}
    {current?.lesson && <LessonFlow key={slug} lesson={current.lesson} />}
  </div>;
}

function LessonFlow({lesson}:{lesson:CourseLesson}) {
  const [stage,setStage] = useState(0);
  const [choice,setChoice] = useState<number | null>(null);
  const [checks,setChecks] = useState<boolean[]>(lesson.rewrite.checks.map(() => false));
  const [answers,setAnswers] = useState<(number|null)[]>(lesson.quiz.map(() => null));
  const [reviewed,setReviewed] = useState(false);
  const [accepted,setAccepted] = useState(false);
  const [analytics,setAnalytics] = useState(false);
  const [remember,setRemember] = useState(false);
  const [note,setNote] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {if (stage > 0) heading.current?.focus();},[stage]);
  useEffect(() => {
    const update = () => setRemember(readProgress().remember);
    update();window.addEventListener('zhihe-progress',update);window.addEventListener('storage',update);
    return () => {window.removeEventListener('zhihe-progress',update);window.removeEventListener('storage',update);};
  },[]);
  function record(event:'lesson_start'|'lesson_complete') {
    if (analytics) void fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,consent:true}),keepalive:true}).catch(() => {});
  }
  function complete() {record('lesson_complete');if (remember && !markComplete(lesson.slug)) setNote('本机记录未能保存，不影响本次完成与下载。');setStage(5);}
  function downloadCard() {
    const text = [`知合 ZHIHE · ${lesson.title} · 练习卡`,'原创教育草稿，待独立专业审阅。非诊疗服务。','',...lesson.card,'','资料来源',...lesson.sources.map(source => `${source.title}: ${source.url}`)].join('\n');
    const url = URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');link.href=url;link.download=`知合-${lesson.title}-练习卡.txt`;link.click();setTimeout(() => URL.revokeObjectURL(url),1000);
    setNote('已发起练习卡下载。请在浏览器下载列表中查看。');
  }
  const allAnswered = answers.every(answer => answer !== null);
  const allCorrect = answers.every((answer,index) => answer === lesson.quiz[index].correct);
  return <main className="learn-main"><div className="learn-intro"><p className="eyebrow">第 {String(lesson.number).padStart(2,'0')} 课 / {lesson.number === 1 ? '免费学习' : '付费课程'}</p><h1>{lesson.title}</h1><p>{lesson.subtitle} · 约 {lesson.duration} 分钟</p></div>
    <ol className="learn-progress" aria-label="课程进度">{stages.map((label,index) => <li key={label} aria-current={index===stage?'step':undefined} className={index<=stage?'is-reached':''}><span>{index+1}</span>{label}</li>)}</ol>
    <section className="learn-panel" aria-labelledby="lesson-heading">
      {stage===0 && <><p className="learn-kicker">今天只练一件事</p><h2 ref={heading} id="lesson-heading" tabIndex={-1}>{lesson.goal}</h2><p>{lesson.subtitle}</p><div className="learn-note">先学习本课方法，再做一个情境练习；在心里或自己的纸上改写，最后用知识检验核对理解。练习不要求输入私密经历，也没有“人格评分”。</div><p className="learn-small">18+ 一般关系沟通教育草稿，尚未经独立专业审阅。不是诊断或治疗；若表达意见会引来威胁、控制或伤害，请先考虑自身安全。你随时可以退出。</p><button className="learn-primary" onClick={() => {record('lesson_start');setStage(1);}}>开始学习 →</button></>}
      {stage===1 && <><p className="learn-kicker">01 / 学习</p><h2 ref={heading} id="lesson-heading" tabIndex={-1}>先看方法，再试着用。</h2><div className="learn-steps">{lesson.learn.map((item,index) => <article key={item.title}><span>{String(index+1).padStart(2,'0')}</span><h3>{item.title}</h3><p>{item.body}</p><blockquote>{item.example}</blockquote></article>)}</div><button className="learn-primary" onClick={() => setStage(2)}>读完了，试一个情境 →</button></>}
      {stage===2 && <><p className="learn-kicker">02 / 情境练习</p><h2 ref={heading} id="lesson-heading" tabIndex={-1}>同一个情境，不同的回应。</h2><div className="learn-scene"><span>{lesson.scenario.setting}</span><p>{lesson.scenario.prompt}</p></div><fieldset className="learn-choices"><legend>选一句，看看它给对话留下了什么空间：</legend>{lesson.scenario.options.map((option,index) => <label key={option.text} className={choice===index?'is-selected':''}><input type="radio" name="scenario" checked={choice===index} onChange={() => setChoice(index)} /><span>{option.text}</span></label>)}</fieldset><div aria-live="polite">{choice!==null && <div className="learn-feedback"><h3>这句话可能带来的影响</h3><p>{lesson.scenario.options[choice].feedback}</p><p className="learn-small">可以切换选项比较。这是在解释表达方式，不是在评判你。</p></div>}</div><button className="learn-primary" disabled={choice===null} onClick={() => setStage(3)}>带着反馈，改写一句 →</button></>}
      {stage===3 && <><p className="learn-kicker">03 / 自己试试</p><h2 ref={heading} id="lesson-heading" tabIndex={-1}>现在，换成你的话。</h2><p>{lesson.rewrite.prompt}</p><blockquote className="learn-template">{lesson.rewrite.template}</blockquote><p className="learn-small">在心里或自己的纸上完成，不用填写或上传答案。</p><fieldset className="learn-checks"><legend>逐项检查，必要时再调整：</legend>{lesson.rewrite.checks.map((item,index) => <label key={item}><input type="checkbox" checked={checks[index]} onChange={event => setChecks(checks.map((value,i) => i===index?event.target.checked:value))} /><span>{item}</span></label>)}</fieldset><button className="learn-primary" disabled={!checks.every(Boolean)} onClick={() => setStage(4)}>已检查，进入知识检验 →</button></>}
      {stage===4 && <><p className="learn-kicker">04 / 知识检验</p><h2 ref={heading} id="lesson-heading" tabIndex={-1}>理解方法，不是背出台词。</h2>{lesson.quiz.map((question,index) => <fieldset className="learn-choices" key={question.question}><legend>{index+1}. {question.question}</legend>{question.options.map((option,i) => <label key={option} className={answers[index]===i?'is-selected':''}><input type="radio" name={`quiz-${index}`} checked={answers[index]===i} onChange={() => {setAnswers(answers.map((value,n) => n===index?i:value));setReviewed(false);setAccepted(false);}} /><span>{option}</span></label>)}</fieldset>)}{!reviewed && <button className="learn-primary" disabled={!allAnswered} onClick={() => setReviewed(true)}>查看解析</button>}<div aria-live="polite">{reviewed && <div className="learn-feedback"><h3>{allCorrect?'关键点，你都理解了。':'再看一眼这几个关键点。'}</h3>{lesson.quiz.map((question,index) => <p key={question.question}><strong>第 {index+1} 题：{answers[index]===question.correct?'理解正确':'可以调整'}。</strong>{question.explanation}</p>)}</div>}</div>{reviewed && <><label className="learn-review"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />我已读完解析，愿意带着这个方法继续练习。</label><button className="learn-primary" disabled={!accepted} onClick={complete}>完成课程，领取练习卡 →</button></>}</>}
      {stage===5 && <><p className="learn-kicker">05 / 课程完成</p><span className="learn-done" aria-hidden="true">✓</span><h2 ref={heading} id="lesson-heading" tabIndex={-1}>你已完成第 {lesson.number} 课。</h2><p>完成练习不等于已经解决现实中的问题。允许自己慢一点，也给对方选择的空间。</p><div className="learn-note"><strong>{lesson.practice.title}</strong><p>{lesson.practice.body}</p></div><button className="learn-primary" onClick={downloadCard}>下载本课练习卡 ↓</button><p className="learn-small">纯文本卡片，不含你的选择或个人信息。下载后可以离线使用。</p><div className="learn-end-links"><Link href="/learn">回到七课目录，继续学习 →</Link><Link className="learn-primary" href="/checkout">继续学习其余 6 节付费课 →</Link></div></>}
      {stage>0 && stage<5 && <button className="learn-back" onClick={() => setStage(stage-1)}>← 返回上一步</button>}
      <p role="status" className="learn-small">{note}</p>
    </section>
    <label className="learn-privacy"><input type="checkbox" checked={remember} onChange={event => {const enabled=event.target.checked;if (!rememberProgress(enabled)) setNote('浏览器未允许保存，不影响学习。');else if (enabled&&stage===5) markComplete(lesson.slug);}} /><span>可选：在这台浏览器记住已完成的课号。只保存在本机，不含答案；取消会清除完成标记。</span></label>
    <label className="learn-privacy"><input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} /><span>可选：发送本页后续的“开始 / 完成”次数统计。不发送答案、课号或用户标识，不与订单关联。取消可停止后续统计，不勾选也能完整学习。</span></label>
    <p className="learn-small learn-memory">选择与自查仅保留在当前页面内存，刷新后重置。本机完成记录是可选的独立功能。</p>
    <details className="learn-sources"><summary>资料来源与内容说明</summary><p>原创中文教学情境，参考下列公开教育资料，未获这些机构背书。目前全部为待独立专业审阅的内容草稿，不提供疗效保证、关系诊断或个人建议。</p><ul>{lesson.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul></details>
  </main>;
}
