export function ElectronicBoardIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩法指南</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>核心目标是在一对一日本立直麻将比赛中击败对手，组成由四组面子加一对将牌构成的十四张和牌。玩家使用经典街机布局进行互动，选择弃牌，喊出“碰”、“吃”或“杠”来获取对手的牌，并在听牌时宣告“立直”。赢得一局会根据役种的复杂度和稀有度奖励点数。</p>
        <p>游戏初期，专注于构建灵活的牌型，弃掉无用的幺九牌或风牌。随着对局推进，仔细观察对手的弃牌，避免放铳。在紧张时刻，利用特殊道具或作弊机制来换牌或偷看对手手牌，确保保持高点数以避免游戏结束。</p>
      </div>

      <h2 className="mt-9 text-2xl font-semibold">常见问题</h2>
      <div className="mt-5 divide-y divide-base-300">
        <Faq question="电子基盘可以在线玩吗？">可以。电子基盘可以直接在浏览器中在线游玩，打开页面后点击开始游戏即可，不需要先安装模拟器。</Faq>
        <Faq question="玩电子基盘需要下载文件吗？">不需要。电子基盘支持免下载游玩，游戏会在浏览器中启动，适合快速体验经典复古游戏。</Faq>
        <Faq question="电子基盘属于什么平台或类型？">电子基盘是 HTML5 平台游戏，类型包含 Casino。你也可以通过平台、类型和相关游戏继续查找类似作品。</Faq>
        <Faq question="电子基盘适合在哪些设备上游玩？">电子基盘通常可以在现代浏览器中运行，包括桌面电脑、平板和手机。为了获得更稳定的体验，建议使用 Chrome 或其他主流浏览器。</Faq>
        <Faq question="电子基盘的开发商是谁？">电子基盘的开发商信息为 NICHIBUTSU。如果你喜欢这款游戏，可以继续浏览同开发商或同类型的相关游戏。</Faq>
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
