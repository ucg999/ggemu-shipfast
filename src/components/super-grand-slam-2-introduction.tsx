export function SuperGrandSlam2Introduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩法指南</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>玩家在传统麻将对局中与电脑对手竞技，目标是组成有效的牌型来获胜。核心目标是通过高效地摸牌和打牌来完成和牌，同时留意牌局布局，识别顺子、刻子或杠等潜在牌型。玩家使用基本操作从手牌中选择并打出牌，努力构建高分牌型，同时阻止对手抢先和牌。</p>
        <p>在早期阶段，专注于打出孤张牌，为手牌打下坚实基础。随着游戏推进，如果对手接近和牌，优先采取防守打法，打出对手不太可能需要的牌。掌握特殊和牌牌型对于获得更高分数和推进游戏难度至关重要，因此要仔细观察牌池，在每场对局中管理好风险与机会。</p>
      </div>

      <h2 className="mt-9 text-2xl font-semibold">常见问题</h2>
      <div className="mt-5 divide-y divide-base-300">
        <Faq question="超级大满贯 2 可以在线玩吗？">可以。超级大满贯 2 可以直接在浏览器中在线游玩，打开页面后点击开始游戏即可，不需要先安装模拟器。</Faq>
        <Faq question="玩超级大满贯 2 需要下载文件吗？">不需要。超级大满贯 2 支持免下载游玩，游戏会在浏览器中启动，适合快速体验经典复古游戏。</Faq>
        <Faq question="超级大满贯 2 属于什么平台或类型？">超级大满贯 2 是 HTML5 平台游戏，类型包含 Casino。你也可以通过平台、类型和相关游戏继续查找类似作品。</Faq>
        <Faq question="超级大满贯 2 适合在哪些设备上游玩？">超级大满贯 2 通常可以在现代浏览器中运行，包括桌面电脑、平板和手机。为了获得更稳定的体验，建议使用 Chrome 或其他主流浏览器。</Faq>
        <Faq question="超级大满贯 2 的开发商是谁？">超级大满贯 2 的开发商信息为 IGS。如果你喜欢这款游戏，可以继续浏览同开发商或同类型的相关游戏。</Faq>
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
