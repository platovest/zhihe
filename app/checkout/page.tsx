import Link from 'next/link';
import './checkout.css';

export default function Checkout() {
  return <div className="checkout-page"><header className="checkout-nav"><Link className="brand" href="/"><span className="brand-mark">知合</span><span className="brand-latin">ZHIHE</span></Link><Link href="/learn">回到课程目录 ↗</Link></header>
    <main className="checkout-main"><p className="eyebrow">SEASON 01 / 首季课程</p><h1>先学一课，<br />再决定是否继续。</h1><p className="checkout-lead">第 1 课完整免费，包含情境练习、知识解析与练习卡。第 2–7 课为付费课程，购买后继续学习。</p>
      <div className="checkout-grid"><section className="checkout-product"><span className="checkout-tag">1 节免费课 + 6 节付费课</span><h2>首季关系练习室</h2><p>从表达需要到建立共同习惯，按自己的节奏，一次练好一件事。</p><ul><li>第 1 课：从猜测到表达，免费学习。</li><li>付费部分：边界、需要差异、难开口的话题。</li><li>继续练习：关系修复、双人倾听、共同约定。</li><li>每课都有情境反馈、知识解析与独立练习卡。</li></ul><div className="checkout-price"><strong>6</strong><span>节付费课程<br />价格与币种待公布</span></div><p className="checkout-small">第 1 课无需购买；付费方案对应其余 6 节课程。课程目前为待独立专业审阅的教育草稿。</p><Link href="/terms">查看课程说明 →</Link></section>
      <section className="checkout-control"><h2>购买后，继续学习。</h2><p>付费课程不会因点击按钮或登记邮箱而解锁。第 1 课始终免费，无需注册或付款。</p><div className="checkout-callout"><strong>购买暂未开放</strong><p>收款渠道尚未接通，现在不能下单或付款。开放购买后，将展示价格、币种、完整订单与售后规则。</p></div><button className="checkout-primary" disabled>暂未开放购买</button><div className="checkout-tools"><Link className="checkout-secondary" href="/learn/expression">免费学习第 1 课 →</Link><Link className="checkout-secondary" href="/learn">查看七课目录</Link></div><p className="checkout-small">如愿意接收课程开放通知，可自愿登记联络意向。登记不是购买，不产生付费课程权益。</p><Link href="/#offer">登记课程开放通知 →</Link></section></div>
      <div className="checkout-support"><h2>先感受一节完整的课。</h2><p>免费不是删减版。你可以完成第 1 课的全部练习，并下载练习卡，再判断这套方法是否适合自己。</p><Link href="/privacy">隐私与撤回登记 →</Link></div>
    </main>
  </div>;
}
