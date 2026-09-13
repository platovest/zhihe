"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const stages = ["开始", "学习", "情境练习", "试着改写", "知识检验", "完成"];
const responses = [
  {
    text: "你每天就知道玩手机，我说什么你都不在乎。",
    title: "你表达了不满，但对方还不知道可以怎么做。",
    feedback: "“每天”“都不在乎”把眼前的事变成了对一个人的判断。保留你的不满，试着只说刚刚发生的事，再提出一个能回答的小请求。",
  },
  {
    text: "刚才我说今天的事时，你一直看手机。我有些失落，想被认真听一会儿。现在能放下手机，听我说五分钟吗？",
    title: "这句开场把事情和需要说清楚了。",
    feedback: "它说的是“刚才”，而不是“你总是”；表达自己的失落，没有替对方判断动机；请求是五分钟的倾听。它创造了商量的空间，但不能保证对方一定答应。",
  },
  {
    text: "算了，没什么，你继续吧。",
    title: "暂停可以是选择，也可以再补一句真实的需要。",
    feedback: "你不必马上谈。如果其实希望稍后继续，可以说：“我现在有点失落，想先缓一缓。等我们都方便时，再找五分钟聊聊好吗？”不用靠对方猜出沉默的意思。",
  },
];

const questions = [
  {
    title: "哪一句更接近可以被观察到的事实？",
    answers: ["你从来不重视我的时间。", "这周我们约好的两次通话都晚了二十分钟。", "我觉得你就是不在乎我。"],
    correct: 1,
    explanation: "“两次通话晚了二十分钟”指向具体事件；另外两句是在判断对方的态度。以“我觉得”开头，也不一定是在表达感受。",
  },
  {
    title: "对方说“现在不想聊”，下一步可以怎么做？",
    answers: ["告诉对方：爱我就应该立刻听我说。", "继续重复请求，直到对方同意。", "先尊重拒绝，再询问是否愿意另约时间；也可以暂不约。"],
    correct: 2,
    explanation: "请求允许对方拒绝。你可以表达自己的失望和需要，也可以商量时间；但不应把爱当作必须同意的条件。没有约成，不代表你没有学会。",
  },
];

export default function Lesson() {
  const [stage, setStage] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null]);
  const [reviewed, setReviewed] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [acceptedFeedback, setAcceptedFeedback] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (stage > 0) heading.current?.focus();
  }, [stage]);

  function record(event: "lesson_start" | "lesson_complete") {
    if (!analytics) return;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, consent: true }),
      keepalive: true,
    }).catch(() => { /* Learning remains available when optional statistics fail. */ });
  }

  const allAnswered = answers.every((answer) => answer !== null);
  const allCorrect = answers.every((answer, index) => answer === questions[index].correct);

  return (
    <div className="learn-page">
      <header className="learn-nav">
        <Link className="brand" href="/" aria-label="知合首页"><span className="brand-mark">知合</span><span className="brand-latin">ZHIHE</span></Link>
        <Link href="/">返回首页 <span aria-hidden="true">↗</span></Link>
      </header>
      <main className="learn-main">
        <div className="learn-intro">
          <p className="eyebrow">免费体验课 / 01</p>
          <h1>把需要说清楚，<br />让对话有个好开头。</h1>
          <p>约 6 分钟 · 一个人也能练习 · 无需注册</p>
        </div>
        <ol className="learn-progress" aria-label="课程进度">
          {stages.map((label, index) => <li key={label} aria-current={index === stage ? "step" : undefined} className={index <= stage ? "is-reached" : ""}><span>{index + 1}</span>{label}</li>)}
        </ol>
        <section className="learn-panel" aria-labelledby="lesson-heading">
          {stage === 0 && <>
            <p className="learn-kicker">今天只练一件事</p>
            <h2 ref={heading} id="lesson-heading" tabIndex={-1}>从“你怎么总是……”<br />到一个可以商量的请求。</h2>
            <p>你想被认真听见，话到嘴边却成了责备。这节课不要求你压下情绪，而是帮你把一件小事讲具体，让对方知道你有什么感受、希望发生什么。</p>
            <div className="learn-note">学完后，你会带走一句自己的开场白和一张练习卡。练习对象是日常、可以安全表达不同意见的对话；你不需要在这里输入任何私密经历。</div>
            <ul className="learn-outline"><li>2 分钟：读懂三个步骤</li><li>2 分钟：看情境，试着改写</li><li>2 分钟：检验理解，带走练习卡</li></ul>
            <p className="learn-small">本课是一般关系沟通教育，不是诊断或治疗。若表达意见会引来威胁、控制或伤害，请先考虑自身安全，而非尝试用更好的措辞说服对方。</p>
            <button className="learn-primary" onClick={() => { record("lesson_start"); setStage(1); }}>开始免费学习 <span aria-hidden="true">→</span></button>
          </>}
          {stage === 1 && <>
            <p className="learn-kicker">01 / 学习 · 约 2 分钟</p>
            <h2 ref={heading} id="lesson-heading" tabIndex={-1}>事实、感受、请求。</h2>
            <p>先选一件最近发生的小事，不要一次解决所有矛盾。开始前可以问：“现在方便聊五分钟吗？”对方不方便，就先商量时间。</p>
            <div className="learn-steps">
              <article><span>01</span><h3>说一件具体的事</h3><p>像回放一个片段：什么时候，发生了什么。把“你从来不关心我”换成“刚才我说话时，你看了几次手机”。观察可以核对，动机通常只能猜。</p><blockquote>“刚才我说今天的事时，你一直看手机。”</blockquote></article>
              <article><span>02</span><h3>说自己的感受和需要</h3><p>“我有些失落，想被认真听一会儿。”感受不需要辩赢，也不等于对方必须负责。“我觉得你很自私”仍是在评价对方，不是描述自己的感受。</p><blockquote>“我有些失落，想被认真听一会儿。”</blockquote></article>
              <article><span>03</span><h3>提一个可以拒绝的请求</h3><p>把“你能不能对我好一点”缩小为一个具体动作和时长。说完停下来听回应。如果对方不愿意，可以谈另一个时间或方式，不以指责或惩罚换取同意。</p><blockquote>“现在能放下手机，听我说五分钟吗？”</blockquote></article>
            </div>
            <div className="learn-note">换你倾听时：先复述“你是想让我专心听一会儿，对吗？”理解不等于同意。情绪太满时可以先暂停，并在双方愿意的前提下再约时间。</div>
            <button className="learn-primary" onClick={() => setStage(2)}>读完了，试一个情境 <span aria-hidden="true">→</span></button>
          </>}
          {stage === 2 && <>
            <p className="learn-kicker">02 / 情境练习 · 约 1 分钟</p>
            <h2 ref={heading} id="lesson-heading" tabIndex={-1}>同一个需要，三种开场。</h2>
            <div className="learn-scene"><span>晚饭后的客厅</span><p>你正分享今天发生的事，对方一直看手机。你希望有一小段专心相处的时间。</p></div>
            <fieldset className="learn-choices"><legend>哪一句更接近你此刻会说的话？</legend>{responses.map((response, index) => <label key={response.text} className={choice === index ? "is-selected" : ""}><input type="radio" name="scenario" value={index} checked={choice === index} onChange={() => setChoice(index)} /><span>{response.text}</span></label>)}</fieldset>
            <div aria-live="polite">{choice !== null && <div className="learn-feedback"><h3>{responses[choice].title}</h3><p>{responses[choice].feedback}</p><p className="learn-small">可以切换选项比较反馈。这里不评判你是什么样的人。</p></div>}</div>
            <button className="learn-primary" disabled={choice === null} onClick={() => setStage(3)}>带着反馈，改写一句 <span aria-hidden="true">→</span></button>
          </>}
          {stage === 3 && <>
            <p className="learn-kicker">03 / 自己试试 · 约 1 分钟</p>
            <h2 ref={heading} id="lesson-heading" tabIndex={-1}>现在，换成你的话。</h2>
            <p>继续用“晚饭后看手机”这个虚构情境，或者在心里选一件小事。不用填写或上传答案。慢慢读下面的句式，在心里或自己的纸上说一次。</p>
            <blockquote className="learn-template">“当 ______ 发生时，<br />我感到 ______，想要 ______。<br />你愿意 ______ 吗？”</blockquote>
            <p>如果对方说“我现在很累”，试着补一句：“好，我们可以先不聊。你愿意明天再找个时间吗？”也接受对方暂时无法约定。</p>
            <fieldset className="learn-checks"><legend>用三个问题检查你的开场白：</legend>{["我说的是一件具体的事，没有“总是”“从来”或猜测动机。", "我表达了自己的感受和需要，没有把评价藏在“我觉得”后面。", "我的请求能被听懂，也允许对方拒绝或提出其他方式。"].map((label, index) => <label key={label}><input type="checkbox" checked={checks[index]} onChange={(event) => setChecks(checks.map((value, item) => item === index ? event.target.checked : value))} /><span>{label}</span></label>)}</fieldset>
            <p className="learn-small">勾选表示你已经逐项检查；如果发现没做到，就在心里调整一下。无需追求一句“完美台词”。</p>
            <button className="learn-primary" disabled={!checks.every(Boolean)} onClick={() => setStage(4)}>已检查，进入知识检验 <span aria-hidden="true">→</span></button>
          </>}
          {stage === 4 && <>
            <p className="learn-kicker">04 / 知识检验 · 约 1 分钟</p>
            <h2 ref={heading} id="lesson-heading" tabIndex={-1}>记住方法，不是背出台词。</h2>
            {questions.map((question, index) => <fieldset className="learn-choices" key={question.title}><legend>{index + 1}. {question.title}</legend>{question.answers.map((answer, option) => <label key={answer} className={answers[index] === option ? "is-selected" : ""}><input type="radio" name={`question-${index}`} value={option} checked={answers[index] === option} onChange={() => { setAnswers(answers.map((value, item) => item === index ? option : value)); setReviewed(false); setAcceptedFeedback(false); }} /><span>{answer}</span></label>)}</fieldset>)}
            {!reviewed && <button className="learn-primary" disabled={!allAnswered} onClick={() => setReviewed(true)}>查看解析</button>}
            <div aria-live="polite">{reviewed && <div className="learn-feedback"><h3>{allCorrect ? "两个关键点，你都理解了。" : "再看一眼这两个关键点。"}</h3>{questions.map((question, index) => <p key={question.title}><strong>第 {index + 1} 题：{answers[index] === question.correct ? "理解正确" : "可以调整"}。</strong>{question.explanation}</p>)}</div>}</div>
            {reviewed && <><label className="learn-review"><input type="checkbox" checked={acceptedFeedback} onChange={(event) => setAcceptedFeedback(event.target.checked)} />我已读完解析，理解请求可以被拒绝。</label><button className="learn-primary" disabled={!acceptedFeedback} onClick={() => { record("lesson_complete"); setStage(5); }}>完成课程，领取练习卡 <span aria-hidden="true">→</span></button></>}
          </>}
          {stage === 5 && <>
            <p className="learn-kicker">05 / 课程完成</p>
            <span className="learn-done" aria-hidden="true">✓</span>
            <h2 ref={heading} id="lesson-heading" tabIndex={-1}>你已走完一次完整练习。</h2>
            <p>下一次不必把整段话说得漂亮。先把一件事说具体，再给彼此一个选择的空间，就可以开始。</p>
            <div className="learn-note"><strong>今天的一个小行动</strong><p>选一个双方都方便的时刻，先问是否愿意聊五分钟；说出你的开场白，再听对方的回答。结束后只回顾：我表达清楚了吗？我有没有给对方选择？</p></div>
            <a className="learn-primary" href="/communication-card.txt" download="知合-沟通练习卡.txt">下载沟通练习卡 <span aria-hidden="true">↓</span></a>
            <p className="learn-small">纯文本，可离线保存。卡片不包含你的选择或任何个人信息。</p>
            <div className="learn-end-links"><Link href="/#offer">体验有帮助？了解未来 7 课计划与意向登记 →</Link><Link href="/">返回首页</Link></div>
          </>}
          {stage > 0 && stage < 5 && <button className="learn-back" onClick={() => setStage(stage - 1)}>← 返回上一步</button>}
        </section>
        <label className="learn-privacy"><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /><span>可选：同意发送本页后续的“开始 / 完成”次数统计，用于改进课程。不发送答案或用户标识，不与首页关联。随时取消可停止后续统计；不勾选也能完整学习。</span></label>
        <p className="learn-small learn-memory">本课选择仅保留在当前页面内存中，刷新后重置；不会写入浏览器存储或提交到服务端。</p>
        <details className="learn-sources"><summary>资料来源与内容说明</summary><p>本课由知合整理为原创中文教学情境，参考以下公开教育资料，不是对原文的逐字翻译，也未获以下机构背书。</p><ul><li><a href="https://www.gottman.com/blog/softening-startup/" target="_blank" rel="noreferrer">The Gottman Institute：温和开场（英文）</a> — 关于具体描述、表达感受与需要的教学参考。</li><li><a href="https://www.loveisrespect.org/resources/boundaries-expectations/" target="_blank" rel="noreferrer">love is respect：边界与期待（英文）</a> — 关于尊重个人边界、共同沟通期待的教学参考。</li></ul><p>当前为内测教育稿，尚未经独立心理或医学专业人士审阅。不提供关系诊断、疗效保证或针对个人的建议。选择题反馈只解释表达方式，不评估人格或关系质量。</p></details>
      </main>
    </div>
  );
}
