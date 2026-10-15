export function Kof97PlusIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">游戏简介</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>这不是 SNK 正式发行的新版本，而是基于《拳皇97》的非官方改版。具体改版作者与首次流传时间未有定论。SNK 开发的是 1997 年原作，Plus 改版作者不明。</p>
        <p>底层玩法仍是三名角色依次出战的大蛇篇终章。ADVANCED 延续《拳皇96》的移动与能量槽思路，EXTRA 则承接《拳皇94》《拳皇95》，冲刺、闪避和蓄气方式并不相同。</p>
        <p>本版的改动很集中：选人表额外显示暴走八神、暴走莉安娜、干枯大地之七枷社、荒狂电光之夏尔美与炎之克里斯，ADVANCED 对战以 3 格 POW 开局。这不等于无限能量、蓄气加速或全角色平衡重做。</p>
      </div>

      <h3 className="mt-8 text-xl font-semibold">操作方式</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
        <Control keys="W / A / S / D">控制上、左、下、右方向</Control>
        <Control keys="J / K">使用播放器映射的 B / A 两个动作键</Control>
        <Control keys="U / I">使用播放器映射的 Y / X 两个动作键</Control>
        <Control keys="Shift">投币</Control>
        <Control keys="Enter">开始游戏</Control>
      </dl>

      <h3 className="mt-8 text-xl font-semibold">开始前须知</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>五名觉醒角色已经列在选人表底部，直接移动光标选择即可，不需要再输入原版的隐藏角色指令。</li>
        <li>本版 ADVANCED 开局自带 3 格 POW。第一回合不要急着清空能量，优先把一格留给能确认命中的超必杀或安全的 MAX 启动。</li>
        <li>练防守前先选定模式。ADVANCED 中 A+B 前滚、后方向+A+B 后滚，EXTRA 中 A+B 原地闪避，脱身结果并不相同。</li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">已知限制</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>民间流传着多种同名《拳皇97》改版。本页只对应 kof97pls，不是重出江湖 Plus 2003；其他改版的大蛇可选、无限能量或角色调整不能直接套用。</li>
        <li>具体改版作者和时间没有可靠记录。页面的 1997 年沿用原作街机年代，而保存下来的 Plus 标题画面带有 2003 年版权字样。</li>
      </ul>
    </section>
  )
}

function Control({ children, keys }: { children: string; keys: string }) {
  return (
    <div className="rounded-lg bg-base-200 px-4 py-3">
      <dt className="font-semibold text-base-content">{keys}</dt>
      <dd className="mt-1 text-base-content/70">{children}</dd>
    </div>
  )
}
