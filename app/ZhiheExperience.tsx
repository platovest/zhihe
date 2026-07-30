"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { OFFER_ID } from "../lib/interest";

const options = [
  {
    id: "brief",
    label: "“今晚算了，我真的很累。”",
    feedback:
      "你清楚表达了自己的状态，但对方可能只听见“拒绝”。补上一句连接和下一步，会让边界更温柔。",
    signals: ["表达自己", "保留连接", "提出下一步"],
    levels: [3, 1, 0],
  },
  {
    id: "bridge",
    label:
      "“我今晚需要休息，但我很在意你。明晚留半小时只聊彼此，好吗？”",
    feedback:
      "你同时表达了状态、连接感和一个可执行的下一步。好的沟通不是勉强答应，而是让拒绝也保留靠近的可能。",
    signals: ["表达自己", "保留连接", "提出下一步"],
    levels: [3, 3, 3],
  },
  {
    id: "deflect",
    label: "“你怎么总在这种时候说这个？”",
    feedback:
      "这句话传递了压力，却把问题推回了对方。先说自己的状态，再谈彼此的需要，会更容易继续对话。",
    signals: ["表达自己", "保留连接", "提出下一步"],
    levels: [1, 0, 0],
  },
];

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
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [modalOpen]);

  const scrollToPreview = () =>
    document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" });

  const openOffer = () => {
    setModalOpen(true);
    setShowEmail(false);
    setStatus("idle");
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
      setStatus(response.ok ? "success" : "error");
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
            <button className="primary-button" onClick={scrollToPreview}>
              免费试听 3 分钟 <span aria-hidden="true">↘</span>
            </button>
            <span className="quiet-note">非露骨内容 · 不记录练习答案</span>
          </div>
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
                onClick={() => setChoice(option.id)}
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
              <div className="signal-list">
                {selected.signals.map((signal, index) => (
                  <div className="signal" key={signal}>
                    <span>{signal}</span>
                    <span className="signal-dots" aria-label={`${signal} ${selected.levels[index]} 格`}>
                      {[1, 2, 3].map((level) => (
                        <i
                          key={level}
                          className={
                            level <= selected.levels[index] ? "active" : ""
                          }
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="preview-complete">
                <span aria-hidden="true">✓</span>
                你刚完成了第 1 个关系练习
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
            7 节核心短课，每节 5–8 分钟。可以独自学习，也可以把练习卡分享给伴侣。
          </p>
        </div>
        <ol className="lesson-list">
          {lessons.map(([number, title, description]) => (
            <li key={number}>
              <span className="lesson-number">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <span className="lesson-duration">5–8 MIN</span>
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
            <p>区分研究发现、专业共识与个人建议；正式课程上线前完成专业审阅。</p>
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
            <p>首季 7 节短课 + 练习卡 · 一次购买 · 永久访问</p>
            <ul>
              <li>可独自学习，也可与一位伴侣共用</li>
              <li>开放购买后 14 天内可申请退款</li>
              <li>无订阅、无自动续费、无隐藏收费</li>
            </ul>
          </div>
          <div className="price-block">
            <span className="price-label">首轮内测价</span>
            <div className="price">
              <sup>¥</sup>
              <strong>199</strong>
            </div>
            <span className="price-anchor">正式版计划价 ¥399</span>
            <button className="offer-button" onClick={openOffer}>
              登记购买意向 <span aria-hidden="true">→</span>
            </button>
            <small>现在不会扣款。开放购买时只提醒一次。</small>
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
            <p>不是。知合专注成年人的关系沟通与亲密健康教育，采用文字、音频和非写实图示。</p>
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
            <p>这只是购买意向，不会扣款。正式开放时我们向你发送一次通知；未开放的意向将在 90 天后删除。</p>
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
          <a href="mailto:hello@zhihe.example">隐私与删除请求</a>
          <span>仅面向 18 岁以上成年人</span>
        </div>
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
                <h2 id="intent-title">谢谢你认真对待这段关系。</h2>
                <p>开放购买时，我们只发送一次提醒。</p>
                <button onClick={() => setModalOpen(false)}>回到课程</button>
              </div>
            ) : (
              <>
                <p className="section-number">一个真实的问题</p>
                <h2 id="intent-title">如果今天开放，你愿意用 ¥199 永久解锁首季吗？</h2>
                <p className="modal-copy">
                  这是内测意向登记，不会扣款。你的回答将决定我们是否继续制作完整课程。
                </p>

                {!showEmail ? (
                  <div className="intent-actions">
                    <button
                      className="primary-button"
                      onClick={() => setShowEmail(true)}
                    >
                      愿意，开放时通知我
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
                    <label htmlFor="email">接收一次开放提醒</label>
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
                      <span>我同意仅将邮箱用于一次开放提醒；可随时申请删除。</span>
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
