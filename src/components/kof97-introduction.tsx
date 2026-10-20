export function Kof97Introduction() {
  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">游戏简介</h2>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>大蛇篇最终章，剧情围绕草薙京、八神庵与大蛇力量的终极对决展开。</li>
        <li>引入“双模式”系统：<strong className="text-base-content">Advanced Mode</strong>（进阶模式）与 <strong className="text-base-content">Extra Mode</strong>（传统模式），满足不同操作习惯。</li>
        <li>多位隐藏角色登场，包括暴走八神、暴走莉安娜，以及最终 Boss：大蛇（Orochi）。</li>
        <li>系统更流畅，能量条机制、超必杀释放更具策略性。</li>
        <li>场景、音乐、配音全面升级，营造出浓厚战斗氛围。</li>
      </ul>

      <h3 className="mt-8 text-xl font-semibold">小编推荐</h3>
      <p className="mt-4 text-sm leading-7 text-base-content/80 sm:text-base">作为拳皇大蛇篇的高潮之作，《拳皇'97》不仅承载了无数玩家的青春回忆，更通过双模式玩法和隐藏角色的设计让对战更具策略性和趣味性。剧情、音乐、操作全面进化，是街机格斗游戏中的不朽经典。</p>

      <h3 className="mt-8 text-xl font-semibold">操作方式</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
        <Control keys="W / A / S / D">控制上、左、下、右方向</Control>
        <Control keys="J / K">使用播放器映射的 B / A 两个攻击键</Control>
        <Control keys="U / I">使用播放器映射的 Y / X 两个攻击键</Control>
        <Control keys="Shift">选择 / 投币</Control>
        <Control keys="Enter">开始游戏</Control>
      </dl>

      <h3 className="mt-8 text-xl font-semibold">游戏攻略</h3>
      <div className="mt-4 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        <Guide title="核心玩法解析">本作分为追求进攻的进阶模式（集气爆发）和经典的传统模式（主动蓄气／红血无限超必杀）。高手进阶需掌握“影跳”控制距离及“取消”连段。</Guide>
        <Guide title="常用角色解析">八神庵是绝对核心，凭借强大的屑风（→↘↓↙←→+A/C）抓取后接重拳接葵花三段可输出极高伤害；神乐千鹤的祝词可封锁对手行动，压制力极强。</Guide>
        <Guide title="进阶技巧">利用 AB 闪避穿过飞行道具，或通过防御取消（消耗一格能量）瞬间反击。</Guide>
        <Guide title="隐藏角色开启">在选人界面按住 Start 键，输入 ↑↓↑↓↑↓+B/D 可呼出觉醒大蛇队。</Guide>
        <Guide title="最终 BOSS 大蛇攻略">其全屏超必杀伤害极大，建议使用八神或草薙京贴身短打，利用大蛇收招后的硬直进行强力连携。注意控制节奏，避免盲目跳跃，以免被其高判定招式拦截。</Guide>
      </div>

      <h3 className="mt-8 text-xl font-semibold">开始前须知</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>先用 Shift 投币，再按 Enter 开始。四个攻击键为 J、K、U、I，建议先在第一场熟悉轻重攻击对应关系。</li>
        <li>新手先固定一支队伍，掌握每名角色的一两个稳定招式和防守距离，再逐步练习连续技。</li>
        <li>组队顺序会影响整场节奏：把最熟悉的角色放在后位，可以在前两名失利后保留更可靠的收尾选择。</li>
      </ul>
    </section>
  )
}

function Guide({ children, title }: { children: string; title: string }) {
  return <p><strong className="text-base-content">{title}：</strong>{children}</p>
}

function Control({ children, keys }: { children: string; keys: string }) {
  return (
    <div className="rounded-lg bg-base-200 px-4 py-3">
      <dt className="font-semibold text-base-content">{keys}</dt>
      <dd className="mt-1 text-base-content/70">{children}</dd>
    </div>
  )
}
