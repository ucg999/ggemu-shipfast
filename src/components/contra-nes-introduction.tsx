export function ContraNesIntroduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">游戏简介</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>KONAMI 在 1988 年分别推出北美 NES 版和日版 Famicom 版。本页游戏进入英文 Contra 标题画面，底部带有 Nintendo of America 授权字样，因此实际运行的是北美 NES 版，并非日版 Famicom。</p>
        <p>NES 版把街机内容扩展为八个防御区域，横向卷轴、纵向攀登和背后视角基地关卡交替出现。单人或双人需要一边移动、跳跃和多方向瞄准，一边取得武器强化并突破 Red Falcon 的防线。</p>
        <p>日版 Famicom 另有加强演出和地区限定指令，并不属于本页北美 NES 游戏。下面的秘籍会明确标出适用版本，避免把不同地区输入混在一起。</p>
      </div>

      <h3 className="mt-8 text-xl font-semibold">操作秘籍</h3>
      <ul className="mt-4 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <Secret title="北美 NES 版：30 条命">在标题画面、演示开始前依次按上、上、下、下、左、右、左、右、B、A，再按 Start。双人模式在 Start 前按 Select。</Secret>
        <Secret title="仅限日版 Famicom：选关">标题音乐开始后，按住上 + 左 + A，按 Start，随后立刻再按住 Select。此指令不适用于本页北美 NES 版。</Secret>
        <Secret title="仅限日版 Famicom：声音测试">在标题画面按住 A + B，再按 Start。此指令不适用于本页北美 NES 版。</Secret>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">操作方式</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
        <Control keys="NES 十字键">向左右移动、蹲下，并配合方向瞄准</Control>
        <Control keys="B 键">射击；配合十字键可向不同方向开火</Control>
        <Control keys="A 键">跳跃；配合左右方向控制跳跃方向</Control>
        <Control keys="Select 键">选择单人或双人，游戏结束后选择继续或结束</Control>
        <Control keys="Start 键">开始已选模式，或暂停和继续游戏</Control>
      </dl>

      <h3 className="mt-8 text-xl font-semibold">开始前须知</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>碰到敌人或子弹就会损失一条命。先记住敌人出现位置，跳跃前清掉落点附近的威胁，不要只顾向前赶路。</li>
        <li>射击飞行胶囊和固定传感器可以取得武器。散弹能覆盖多个角度，Rapid Fire 则会提高当前武器的射速。</li>
        <li>两段基地关卡采用向屏幕深处推进的视角，要在计时结束前逐个清除传感器；跳跃主要用于横向和纵向卷轴关卡。</li>
        <li>NES 版每次任务最多可以继续三次。前几次尝试优先熟悉安全路线，不要为了追逐高风险武器胶囊连续损失生命。</li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">已知限制</h3>
      <ul className="mt-4 list-disc pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>本页北美 NES 版不包含日版 Famicom 的额外过场、动态背景、选关指令和声音测试指令。</li>
      </ul>
    </section>
  )
}

function Secret({ children, title }: { children: string; title: string }) {
  return <li><strong className="text-base-content">{title}：</strong>{children}</li>
}

function Control({ children, keys }: { children: string; keys: string }) {
  return (
    <div className="rounded-lg bg-base-200 px-4 py-3">
      <dt className="font-semibold text-base-content">{keys}</dt>
      <dd className="mt-1 text-base-content/70">{children}</dd>
    </div>
  )
}
