export function Kof97Introduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">游戏简介</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>SNK 官方系列资料将《拳皇97》描述为大蛇篇的第三部和最终章。街机 MVS 版本于 1997 年 7 月推出，并延续三人队伍依次出战的系列结构。</p>
        <p>本作可在 ADVANCED 与 EXTRA 两种模式之间选择。两者分别承接《拳皇96》和《拳皇94》《拳皇95》的系统取向，适合按自己熟悉的移动和能量管理方式选择。</p>
      </div>

      <h3 className="mt-8 text-xl font-semibold">操作秘籍</h3>
      <ul className="mt-4 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <Secret title="选择经典草薙京">在选人画面把光标停在草薙京，按住 Start，再按任意攻击键，即可选择使用经典招式的草薙京。</Secret>
        <Secret title="选择暴走八神庵">在选人画面把光标停在八神庵并按住 Start；保持按住 Start，依次输入左、右、左、右、左、右，再同时按 A+C。</Secret>
        <Secret title="选择暴走莉安娜">先让暴走八神庵头像出现，再把光标停在莉安娜并按住 Start；依次输入上、下、上、下、上、下，最后在保持 Start 的同时按 B+D。</Secret>
        <Secret title="选择大蛇新面孔队">让暴走八神庵和暴走莉安娜头像都出现后，按住 Start，依次输入上、左、下、右、上、下，再同时按 B+C。</Secret>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">操作方式</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
        <Control keys="W / A / S / D">控制上、左、下、右方向</Control>
        <Control keys="J / K">使用播放器映射的 B / A 两个攻击键</Control>
        <Control keys="U / I">使用播放器映射的 Y / X 两个攻击键</Control>
        <Control keys="Shift">选择 / 投币</Control>
        <Control keys="Enter">开始游戏</Control>
      </dl>

      <h3 className="mt-8 text-xl font-semibold">开始前须知</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>先用 Shift 投币，再按 Enter 开始。四个攻击键为 J、K、U、I，建议先在第一场熟悉轻重攻击对应关系。</li>
        <li>新手先固定一支队伍，掌握每名角色的一两个稳定招式和防守距离，再逐步练习连续技。</li>
        <li>组队顺序会影响整场节奏：把最熟悉的角色放在后位，可以在前两名失利后保留更可靠的收尾选择。</li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">已知限制</h3>
      <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>角色必杀技指令因角色而异，因此本页操作区只记录已核对的播放器键位。</li>
      </ul>
    </section>
  )
}

function Secret({ children, title }: { children: string; title: string }) {
  return <li><strong className="text-base-content">街机／Neo Geo MVS 版：{title}：</strong>{children}</li>
}

function Control({ children, keys }: { children: string; keys: string }) {
  return (
    <div className="rounded-lg bg-base-200 px-4 py-3">
      <dt className="font-semibold text-base-content">{keys}</dt>
      <dd className="mt-1 text-base-content/70">{children}</dd>
    </div>
  )
}
