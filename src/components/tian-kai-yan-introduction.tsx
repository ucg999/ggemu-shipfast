export function TianKaiYanIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩法指南</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>游戏遵循标准麻将规则，目标是通过收集牌组（如碰、杠或顺子）来组成获胜手牌并宣布胜利。玩家通过点击界面来摸牌、弃牌或根据对手打出的牌进行吃碰杠。专注于观察牌桌走势并管理手牌以完成牌型，同时留意特殊能力槽。</p>
        <p>在早期阶段，优先弃掉孤张牌以构建稳固的结构。随着回合推进和紧张感上升，策略性地使用特殊“开眼”功能来窥视即将到来的牌或揭示对手信息，这有助于做出更安全的弃牌选择。始终留意其他玩家形成的副露，避免打出会让他们完成获胜手牌的牌，确保在寻找自己胜利条件的同时保持防守姿态。</p>
      </div>

      <h2 className="mt-9 text-2xl font-semibold">常见问题</h2>
      <div className="mt-5 divide-y divide-base-300">
        <Faq question="天开眼可以在线玩吗？">可以。天开眼可以直接在浏览器中在线游玩，打开页面后点击开始游戏即可，不需要先安装模拟器。</Faq>
        <Faq question="玩天开眼需要下载文件吗？">不需要。天开眼支持免下载游玩，游戏会在浏览器中启动，适合快速体验经典复古游戏。</Faq>
        <Faq question="天开眼属于什么平台或类型？">天开眼是 HTML5 平台游戏，类型包含 Casino。你也可以通过平台、类型和相关游戏继续查找类似作品。</Faq>
        <Faq question="天开眼适合在哪些设备上游玩？">天开眼通常可以在现代浏览器中运行，包括桌面电脑、平板和手机。为了获得更稳定的体验，建议使用 Chrome 或其他主流浏览器。</Faq>
        <Faq question="天开眼的开发商是谁？">天开眼的开发商信息为 UNKNOW。如果你喜欢这款游戏，可以继续浏览同开发商或同类型的相关游戏。</Faq>
      </div>
    </section>
  )
}

function Faq({ children, question }: { children: string; question: string }) {
  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <h3 className="text-lg font-semibold">{question}</h3>
      <p className="mt-2 text-sm leading-7 text-base-content/75 sm:text-base">{children}</p>
    </article>
  )
}
