"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { OFFER_ID } from "../lib/interest";
import Link from 'next/link';

const options = [
  {
    id: "brief",
    label: "“今晚算了，我真的很累。”",
    feedback:
      "你已经清楚表达了需要休息。拒绝不需要额外解释或补偿；如果你愿意，也可以补充在意对方的感受，但不必勉强约定下一次。",
  },
  {
    id: "bridge",
    label:
      "“我今晚需要休息，但我很在意你。明晚留半小时只聊彼此，好吗？”",
    feedback:
      "你同时表达了状态、连接感和一个可执行的下一步。好的沟通不是勉强答应，而是让拒绝也保留靠近的可能。",
  },
  {
    id: "deflect",
    label: "“你怎么总在这种时候说这个？”",
    feedback:
      "这句话传递了压力，却把问题推回了对方。先说自己的状态，再谈彼此的需要，会更容易继续对话。",
  },
];

const lessonSlugs = ['expression','boundaries','differences','awkwardness','repair','together','rituals'];

const lessons = [
  ["01", "从猜测到表达", "把“你应该懂”换成对方能接住的话"],
  ["02", "边界不等于疏远", "在说不的时候，也保留连接感"],
  ["03", "需要不同时", "不争输赢，找到两个人都能接受的节奏"],
  ["04", "把尴尬说小一点", "用中性词汇开启难开口的话题"],
  ["05", "修复一次没说好的话", "冲突之后，重新建立安全感"],
  ["06", "十分钟双人练习", "不用开镜，也不用分享私密答案"],
  ["07", "建立你们的亲密语言", "把一次练习变成长期习惯"],
];

function getSource() {
  const value = new URLSearchParams(window.location.search).get("source");
  return ["organic", "partner", "research"].includes(value ?? "")
    ? value
    : "direct";
}

export function ZhiheExperience() {
  const [choice, setChoice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [withdrawalToken, setWithdrawalToken] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const modalRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === choice);

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
      if (event.key === "Tab") {
        const nodes = modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not([tabindex="-1"]):not(:disabled)');
        if (!nodes?.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!modalRef.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modalRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (status === 'success') document.getElementById('intent-title')?.focus();
    else if (showEmail && status === 'idle') document.getElementById('email')?.focus();
  }, [modalOpen, showEmail, status]);

  function track(event: string) {
    if (analytics) void fetch('/api/events', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({event,consent:true})}).catch(() => {});
  }
  const scrollToPreview = () => {
    track('trial_start');
    document.getElementById("preview")?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const openOffer = () => {
    setModalOpen(true);
    setShowEmail(false);
    setEmail("");
    setConsent(false);
    setWithdrawalToken("");
    setStatus("idle");
    track('price_view');
  };

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    setStatus("sending");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          offerId: OFFER_ID,
          source: getSource(),
          consent: true,
          website: form.get("website") ?? "",
        }),
      });
      if (response.ok) {
        const result = await response.json();
        setWithdrawalToken(result.withdrawalToken ?? '');
        setStatus('success');
        track('interest_confirmed');
      } else setStatus('error');
    } catch {
      setStatus("error");
    }
  }

  return (
    <main>
      <nav className="nav" aria-label="主导航">
        <a className="brand" href="#top" aria-label="知合首页">
          <span className="brand-mark">知合</span>
          <span className="brand-latin">ZHIHE</span>
        </a>
        <div className="nav-links">
          <Link href="/learn">七课练习室</Link>
          <a href="#curriculum">首季课程</a>
          <a href="#method">我们的方法</a>
          <button className="nav-cta" onClick={scrollToPreview}>
            免费试听
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span>18+</span> 为成年人的关系练习室
          </p>
          <h1>
            不用猜，
            <br />
            也不必尴尬。
          </h1>
          <p className="hero-lead">
            用研究启发的短课和 10 分钟练习，
            <br className="desktop-break" />
            把亲密需求说清楚。
          </p>
          <div className="hero-actions">
            <Link className="primary-button action-link" href="/learn/expression">开始免费完整课 <span aria-hidden="true">→</span></Link>
            <span className="quiet-note">非露骨内容 · 不记录练习答案</span>
          </div>
          <p className="beta-note">七课内容草稿已备齐 · 第 1 课直接免费 · 后六课通过本地演练开通</p>
        </div>

        <div className="hero-art" aria-label="两个人靠近时形成的交叠圆形">
          <div className="orbit orbit-one">
            <span>表达</span>
          </div>
          <div className="orbit orbit-two">
            <span>倾听</span>
          </div>
          <div className="orbit-center">
            <span>靠近</span>
          </div>
          <p>亲密不是天赋，是可以一起练习的能力。</p>
        </div>
      </section>

      <section className="trust-strip" aria-label="产品原则">
        <span>01 原创中文课程</span>
        <span>02 资料来源可查</span>
        <span>03 无需开镜</span>
        <span>04 隐私优先</span>
      </section>

      <section className="preview-section" id="preview">
        <div className="section-heading">
          <p className="section-number">试听练习 / 01</p>
          <h2>
            一句“我累了”，
            <br />
            为什么常常被听成“我不在意你”？
          </h2>
          <p>
            这不是标准答案测试。我们只看一句话有没有同时照顾三件事：
            表达自己、保留连接、提出下一步。
          </p>
        </div>

        <div className="exercise-card">
          <div className="scenario">
            <span className="scenario-label">今晚的情境</span>
            <p>你很疲惫，又不想让伴侣觉得被拒绝。你会怎么说？</p>
          </div>

          <div className="choice-list" role="group" aria-label="沟通方式选项">
            {options.map((option) => (
              <button
                key={option.id}
                className={`choice ${choice === option.id ? "selected" : ""}`}
                onClick={() => { if (!choice) track('trial_complete'); setChoice(option.id); }}
                aria-pressed={choice === option.id}
              >
                <span className="choice-dot" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="feedback" aria-live="polite">
              <div>
                <span className="feedback-label">看看这句话传递了什么</span>
                <p>{selected.feedback}</p>
              </div>
              <p className="beta-note">拒绝本身已经有效。解释、安慰或另约时间都是可选的，不是让拒绝成立的条件。</p>
              <div className="preview-complete">
                <span aria-hidden="true">✓</span>
                你刚完成了第 1 个关系练习
                <p><Link href="/learn/expression">继续完整课程：学会表达、练习与自查 →</Link></p>
              </div>
            </div>
          ) : (
            <p className="choice-hint">选一个最接近你真实反应的说法</p>
          )}
        </div>
      </section>

      <section className="curriculum" id="curriculum">
        <div className="curriculum-intro">
          <p className="section-number">首季课程 / SEASON 01</p>
          <h2>从难开口，<br />到说得清。</h2>
          <p>
            七节完整内容草稿均可学习，尚待独立专业审阅。第 1 课直接免费；后六课通过本地模拟订单体验开通，不扣款。可以独自学习，不必分享私密答案。
          </p>
        </div>
        <ol className="lesson-list">
          {lessons.map(([number, title, description]) => (
            <li key={number}>
              <span className="lesson-number">{number}</span>
              <div>
                <h3><Link href={`/learn/${lessonSlugs[Number(number)-1]}`}>{title} →</Link></h3>
                <p>{description}</p>
              </div>
              <span className="lesson-duration">{number === '01' ? '免费开放' : '演练开通'}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="method" id="method">
        <div className="method-heading">
          <p className="section-number">知合的方法</p>
          <h2>温柔，不代表含糊。<br />专业，也不该让人有压力。</h2>
        </div>
        <div className="method-grid">
          <article>
            <span className="method-index">A</span>
            <h3>证据有出处</h3>
            <p>课程附参考来源；目前为原创教育草稿，尚未经独立专业审阅，不宣称已验证的改善效果。</p>
          </article>
          <article>
            <span className="method-index">B</span>
            <h3>练习能落地</h3>
            <p>不用背术语。每节课只解决一个真实情境，给出今天就能使用的话和动作。</p>
          </article>
          <article>
            <span className="method-index">C</span>
            <h3>隐私是默认项</h3>
            <p>无需开镜，不保存练习选择，不建立敏感画像，只收取你主动留下的信息。</p>
          </article>
        </div>
        <p className="method-disclaimer">
          当前为产品内测样本，不构成医疗或心理诊断建议。如有疼痛、创伤或持续困扰，请寻求有资质的专业支持。
        </p>
      </section>

      <section className="offer" id="offer">
        <div className="offer-card">
          <div className="offer-copy">
            <p className="section-number">创始会员 / FOUNDING ACCESS</p>
            <h2>把猜测，换成一次好好说话。</h2>
            <p>首季 7 节内容草稿 + 各课练习卡 · 正式课程购买意向调研</p>
            <ul>
              <li>可独自学习，也可与一位伴侣共用</li>
              <li>已可本地模拟开通，未开放真实购买</li>
              <li>无订阅、无自动续费、无隐藏收费</li>
            </ul>
            <p><Link className="primary-button action-link" href="/checkout">体验本地订单与权益演练 →</Link></p>
          </div>
          <div className="price-block">
            <span className="price-label">首轮内测价</span>
            <div className="price">
              <sup>¥</sup>
              <strong>199</strong>
            </div>
            <span className="price-anchor">未来课程意向价 · 当前免费内测</span>
            <button className="offer-button" onClick={openOffer}>
              登记购买意向 <span aria-hidden="true">→</span>
            </button>
            <small>现在不会扣款。可自愿留下联系方式供人工跟进。</small>
          </div>
        </div>
      </section>

      <section className="faq">
        <div>
          <p className="section-number">常见问题</p>
          <h2>开始前，<br />你可能还想知道。</h2>
        </div>
        <div className="faq-list">
          <details>
            <summary>这是成人视频或露骨内容吗？</summary>
            <p>不是。当前免费课采用文字和互动练习，专注成年人的关系沟通。</p>
          </details>
          <details>
            <summary>一定要和伴侣一起学吗？</summary>
            <p>不需要。你可以完全独自学习，再自行决定是否分享某一张练习卡。</p>
          </details>
          <details>
            <summary>你们会保存我的练习答案吗？</summary>
            <p>不会。当前试听选择只在本页临时显示，不会发送到服务器或建立个人画像。</p>
          </details>
          <details>
            <summary>登记后会发生什么？</summary>
            <p>这只是购买意向，不会扣款。你可授权团队在未来课程开放时人工联系一次。当前没有自动邮件；登记成功后请保存撤回凭证。详见隐私说明。</p>
          </details>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark">知合</span>
          <span className="brand-latin">ZHIHE</span>
        </a>
        <p>把亲密，讲清楚。</p>
        <div className="footer-meta">
          <span>© 2026 知合产品内测</span>
          <a href="/privacy">隐私与撤回登记</a>
          <span>仅面向 18 岁以上成年人</span>
        </div>
        <label className="analytics-choice"><input type="checkbox" checked={analytics} onChange={event => { const enabled = event.target.checked; setAnalytics(enabled); if(enabled) void fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event:'visit',consent:true})}).catch(()=>{}); }} />自愿允许本页匿名使用计数（不含答案、邮箱或个人标识，刷新后重置）</label>
      </footer>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setModalOpen(false)}>
          <div
            className="intent-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intent-title"
            tabIndex={-1}
            ref={modalRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="关闭"
              onClick={() => setModalOpen(false)}
            >
              ×
            </button>

            {status === "success" ? (
              <div className="success-state" aria-live="polite">
                <span className="success-mark" aria-hidden="true">✓</span>
                <p className="section-number">意向已登记</p>
                <h2 id="intent-title" tabIndex={-1}>谢谢你认真对待这段关系。</h2>
                <p>已收到本次请求，不会扣款。首次登记请保存下方撤回凭证；重复提交不会新增记录，请继续保留最初的凭证。</p>
                <label htmlFor="receipt">本次撤回凭证</label>
                <input id="receipt" className="receipt" readOnly value={withdrawalToken} onFocus={event => event.target.select()} />
                <p><a href="/privacy">使用凭证撤回登记</a> · 凭证遗失时可由本地运营人员协助核对删除</p>
                <button onClick={() => setModalOpen(false)}>回到课程</button>
              </div>
            ) : (
              <>
                <p className="section-number">一个真实的问题</p>
                <h2 id="intent-title">如果正式开放，你愿意用 ¥199 购买首季七课吗？</h2>
                <p className="modal-copy">
                  这是正式课程的联络意向登记，不会扣款，也不会开通演练权益。你的反馈帮助我们决定下一步是否投入专业审阅与正式交付。
                </p>

                {!showEmail ? (
                  <div className="intent-actions">
                    <button
                      className="primary-button"
                      onClick={() => setShowEmail(true)}
                    >
                      愿意，留下联系意向
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => setModalOpen(false)}
                    >
                      暂时不会
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitInterest} className="intent-form">
                    <label htmlFor="email">用于一次人工跟进的邮箱</label>
                    <div className="email-row">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="你的邮箱"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                      <button type="submit" disabled={status === "sending"}>
                        {status === "sending" ? "登记中…" : "确认意向"}
                      </button>
                    </div>
                    <div className="honeypot" aria-hidden="true">
                      <label htmlFor="website">网站</label>
                      <input id="website" name="website" tabIndex={-1} autoComplete="off" />
                    </div>
                    <label className="consent-row">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(event) => setConsent(event.target.checked)}
                        required
                      />
                      <span>我同意将邮箱用于未来课程开放时的一次人工联系，并已阅读<a href="/privacy" target="_blank" rel="noreferrer">隐私说明</a>；可通过撤回凭证删除。</span>
                    </label>
                    {status === "error" && (
                      <p className="form-error" role="alert">
                        暂时无法登记，请稍后再试。
                      </p>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
