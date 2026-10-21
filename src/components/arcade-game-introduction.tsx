import type { PublicGame } from '#/lib/ggemu'

type GenreCopy = {
  label: string
  overview: string
  recommendation: string
  strategy: Array<{ title: string; text: string }>
}

export function ArcadeGameIntroduction({ game }: { game: PublicGame }) {
  const name = game.name?.trim() || '这款游戏'
  const genre = getGenreCopy(game)
  const developer = game.developer?.trim()
  const year = game.released_year?.trim()
  const players = game.players && game.players > 1 ? `支持最多 ${game.players} 名玩家` : '适合单人挑战'

  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">游戏简介</h2>
      <div className="mt-5 space-y-3 text-sm leading-7 text-base-content/80 sm:text-base">
        <p>《{name}》是一款{genre.label}街机游戏{year ? `，于 ${year} 年推出` : ''}{developer ? `，开发商为 ${developer}` : ''}。本页提供浏览器在线游玩入口，无需另外安装模拟器。</p>
        <p>{genre.overview}</p>
        <p>{players}。进入游戏后先熟悉投币、开始与主要动作键，再根据关卡节奏逐步掌握移动、进攻和资源管理。</p>
      </div>

      <h3 className="mt-8 text-xl font-semibold">小编推荐</h3>
      <p className="mt-4 text-sm leading-7 text-base-content/80 sm:text-base">{genre.recommendation}《{name}》保留了街机游戏快速上手、反复挑战和追求高分的乐趣，适合想重温街机厅体验的玩家。</p>

      <h3 className="mt-8 text-xl font-semibold">操作方式</h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 sm:text-base">
        <Control keys="W / A / S / D">控制上、左、下、右方向</Control>
        <Control keys="J / K">使用播放器映射的 B / A 两个主要动作键</Control>
        <Control keys="U / I">使用播放器映射的 Y / X 两个辅助动作键</Control>
        <Control keys="Shift">选择 / 投币</Control>
        <Control keys="Enter">开始游戏</Control>
      </dl>

      <h3 className="mt-8 text-xl font-semibold">游戏攻略</h3>
      <div className="mt-4 space-y-4 text-sm leading-7 text-base-content/80 sm:text-base">
        {genre.strategy.map((item) => <Guide key={item.title} title={item.title}>{item.text}</Guide>)}
      </div>

      <h3 className="mt-8 text-xl font-semibold">开始前须知</h3>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/80 sm:text-base">
        <li>先按 Shift 投币，再按 Enter 开始。不同游戏的动作键数量可能不同，建议开局先测试 J、K、U、I。</li>
        <li>第一次游玩先以熟悉规则和关卡为主，掌握敌人、障碍或对手的行动规律后再追求高分。</li>
        <li>移动端使用屏幕按键；电脑端建议保持游戏窗口处于焦点状态，以免键盘输入被浏览器拦截。</li>
      </ul>
    </section>
  )
}

function getGenreCopy(game: PublicGame): GenreCopy {
  const text = `${game.name || ''} ${(game.categories || []).join(' ')} ${game.keywords || ''}`.toLowerCase()
  if (/mahjong|麻将|麻雀|casino|poker/.test(text)) return MAHJONG_COPY
  if (/fight|格斗|拳皇|street fighter|samurai|wrestl/.test(text)) return FIGHTING_COPY
  if (/shoot|shmup|飞机|战机|raiden|gun|slug|contra/.test(text)) return SHOOTING_COPY
  if (/soccer|football|baseball|basketball|golf|sports|boxing|volley|rally|racing/.test(text)) return SPORTS_COPY
  if (/puzzle|quiz|bubble|益智|pac-man/.test(text)) return PUZZLE_COPY
  return ACTION_COPY
}

const ACTION_COPY: GenreCopy = {
  label: '动作闯关类',
  overview: '玩家需要在连续关卡中移动、攻击并避开敌人的包围，合理利用场景、道具和特殊攻击突破难点。',
  recommendation: '关卡节奏紧凑，敌人配置与头目战都强调观察和走位。',
  strategy: [
    { title: '核心玩法', text: '优先清理威胁最大的敌人，不要长时间停在画面边缘；拾取武器和补给前先确认周围安全。' },
    { title: '进阶技巧', text: '熟悉攻击范围和无敌时间，利用移动把敌人聚在同一方向，再用范围攻击提高效率。' },
    { title: '头目战', text: '先观察一轮攻击规律，保留强力道具和特殊攻击，在头目收招后的空档集中输出。' },
  ],
}

const FIGHTING_COPY: GenreCopy = {
  label: '格斗对战类',
  overview: '玩家通过方向输入与攻击键组合进行普通技、必杀技和防守反击，在限定时间内击败对手。',
  recommendation: '角色差异、攻防距离和连招节奏构成了主要乐趣。',
  strategy: [
    { title: '基础攻防', text: '先掌握防守、跳跃和两三个稳定招式，不要连续盲目出招，把握对手攻击落空后的反击机会。' },
    { title: '距离控制', text: '保持在自己招式有效、对手难以反击的位置，用轻攻击试探，再确认命中后接后续招式。' },
    { title: '能量管理', text: '不要一有能量就使用超必杀，优先留给确认命中的连段、解围或关键回合。' },
  ],
}

const SHOOTING_COPY: GenreCopy = {
  label: '射击类',
  overview: '玩家需要持续射击、躲避弹幕并收集强化道具，在不断推进的版面中击破敌军和大型头目。',
  recommendation: '火力成长、弹幕路线与紧急资源的取舍让每次挑战都很有节奏。',
  strategy: [
    { title: '火力成长', text: '前期优先收集强化道具，尽快形成稳定火力；死亡后先确保生存，不要冒险追逐远处道具。' },
    { title: '躲避技巧', text: '视线尽量放在角色附近和弹幕缺口，不要只盯着敌人；小幅移动通常比大范围乱跑更安全。' },
    { title: '紧急资源', text: '炸弹或特殊攻击应留给密集弹幕和头目危险阶段，避免在普通敌群中浪费。' },
  ],
}

const SPORTS_COPY: GenreCopy = {
  label: '体育竞技类',
  overview: '玩家需要掌握移动、传球或击球时机，在短时间比赛中创造得分机会并限制对手。',
  recommendation: '规则直观、比赛紧凑，既适合快速体验，也适合反复练习刷新成绩。',
  strategy: [
    { title: '比赛节奏', text: '开局先观察电脑对手的移动习惯，避免无意义地持续加速或强攻。' },
    { title: '得分机会', text: '通过移动拉开空间，在对手失位时再完成射门、击球或关键动作。' },
    { title: '领先策略', text: '取得领先后减少高风险操作，优先保持阵型和稳定控场，迫使对手主动犯错。' },
  ],
}

const PUZZLE_COPY: GenreCopy = {
  label: '益智休闲类',
  overview: '玩家需要观察版面、规划移动顺序，并在压力逐渐增加前完成消除、收集或解谜目标。',
  recommendation: '规则容易理解，但高分需要预判、连锁规划和稳定操作。',
  strategy: [
    { title: '版面观察', text: '每次操作前先看下一步可能产生的空间，不要只处理眼前最明显的目标。' },
    { title: '连锁规划', text: '尽量保留可以连续触发的组合，在版面接近危险状态时再集中释放。' },
    { title: '稳定高分', text: '优先避免无效操作，保持版面整洁；速度提升后缩小观察范围，专注最危险区域。' },
  ],
}

const MAHJONG_COPY: GenreCopy = {
  label: '麻将棋牌类',
  overview: '玩家通过摸牌、弃牌和组合牌型争取先完成和牌，同时根据牌河与对手动作调整进攻和防守。',
  recommendation: '牌型判断、风险控制和局势观察是持续游玩的核心。',
  strategy: [
    { title: '整理手牌', text: '前期优先处理孤张和价值较低的牌，保留容易延伸的连续牌与对子。' },
    { title: '观察牌河', text: '中后期留意对手舍牌和副露，判断其可能需要的牌，避免轻易打出高风险牌。' },
    { title: '攻守选择', text: '手牌进度领先时积极推进；对手明显接近和牌时及时转入防守，优先打安全牌。' },
  ],
}

function Guide({ children, title }: { children: string; title: string }) {
  return <p><strong className="text-base-content">{title}：</strong>{children}</p>
}

function Control({ children, keys }: { children: string; keys: string }) {
  return <div className="rounded-lg bg-base-200 px-4 py-3"><dt className="font-semibold text-base-content">{keys}</dt><dd className="mt-1 text-base-content/70">{children}</dd></div>
}
