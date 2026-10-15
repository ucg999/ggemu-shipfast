export function CelebrityMahjongIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩法指南</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>在这款台湾 16 张麻将游戏中，主要目标是组成一副由五组顺子或刻子以及一对将牌组成的和牌牌型。玩家轮流从牌墙摸牌并打出一张手牌。你可以吃上家打出的牌组成顺子，碰任何玩家打出的牌组成刻子，或杠四张相同的牌。密切关注独特的牌型组合和风向，在宣布和牌前最大化手牌的番数。</p>
        <p>初学者应专注于保持灵活的手牌，并观察对手的弃牌以避免打出放炮牌。利用名人角色的独特反应和语音提示来判断对局走势。在紧张的后期阶段，优先采取防守打法，打出已经出现过的安全牌，将喂给其他玩家和牌的风险降到最低。</p>
      </div>

      <h2 className="mt-9 text-2xl font-semibold">常见问题</h2>
      <div className="mt-5 divide-y divide-base-300">
        <Faq question="明星三缺一可以在线玩吗？">可以。明星三缺一可以直接在浏览器中在线游玩，打开页面后点击开始游戏即可，不需要先安装模拟器。</Faq>
        <Faq question="玩明星三缺一需要下载文件吗？">不需要。明星三缺一支持免下载游玩，游戏会在浏览器中启动，适合快速体验经典复古游戏。</Faq>
        <Faq question="明星三缺一属于什么平台或类型？">明星三缺一是 HTML5 平台游戏，类型包含 Casino。你也可以通过平台、类型和相关游戏继续查找类似作品。</Faq>
        <Faq question="明星三缺一适合在哪些设备上游玩？">明星三缺一通常可以在现代浏览器中运行，包括桌面电脑、平板和手机。为了获得更稳定的体验，建议使用 Chrome 或其他主流浏览器。</Faq>
        <Faq question="明星三缺一的开发商是谁？">明星三缺一的开发商信息为 INTERNATIONAL GAMES SYSTEM。如果你喜欢这款游戏，可以继续浏览同开发商或同类型的相关游戏。</Faq>
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
