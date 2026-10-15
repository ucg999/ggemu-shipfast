export function LuckyFullHouseIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩法指南</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>在这款经典街机麻将游戏中，你的主要目标是比对手先组成一副由 13 张牌加一张胡牌组成的有效牌型，形成有效的顺子、刻子和对子组合。玩家使用标准街机麻将面板控制进行操作，按钮对应从左到右弃掉特定牌，以及用于宣告杠、碰、吃、立直和荣和的动作按钮。</p>
        <p>要成功，分析你的起手牌并尽早决定策略。优先弃掉无用的风牌和箭牌，然后转向构建高分牌型。当你手握强牌时，利用下注系统来增加潜在收益。在紧张的中后期，仔细观察对手的弃牌，如果他们看起来接近获胜，就采取防守打法，弃出安全牌以避免点炮。</p>
      </div>

      <h2 className="mt-9 text-2xl font-semibold">常见问题</h2>
      <div className="mt-5 divide-y divide-base-300">
        <Faq question="幸运满贯可以在线玩吗？">可以。幸运满贯可以直接在浏览器中在线游玩，打开页面后点击开始游戏即可，不需要先安装模拟器。</Faq>
        <Faq question="玩幸运满贯需要下载文件吗？">不需要。幸运满贯支持免下载游玩，游戏会在浏览器中启动，适合快速体验经典复古游戏。</Faq>
        <Faq question="幸运满贯属于什么平台或类型？">幸运满贯是 HTML5 平台游戏，类型包含 Casino。你也可以通过平台、类型和相关游戏继续查找类似作品。</Faq>
        <Faq question="幸运满贯适合在哪些设备上游玩？">幸运满贯通常可以在现代浏览器中运行，包括桌面电脑、平板和手机。为了获得更稳定的体验，建议使用 Chrome 或其他主流浏览器。</Faq>
        <Faq question="幸运满贯的开发商是谁？">幸运满贯的开发商信息为 IGS。如果你喜欢这款游戏，可以继续浏览同开发商或同类型的相关游戏。</Faq>
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
