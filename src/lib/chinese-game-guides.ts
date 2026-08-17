import type { PublicGame } from './ggemu'

export type ChineseGameGuide = {
  aliases: Array<string>
  controls: string
  gameplay: string
  moves: string
  multiplayer: string
  name: string
  save: string
  summary: string
}

type GuideSeed = Pick<ChineseGameGuide, 'aliases' | 'gameplay' | 'name' | 'summary'> &
  Partial<Pick<ChineseGameGuide, 'controls' | 'moves' | 'multiplayer' | 'save'>>

const arcadeControls =
  '使用方向键或摇杆移动；攻击、跳跃和特殊功能对应页面当前显示的按键映射。进入游戏后可在设置中查看或重新绑定键位。'
const gbaControls =
  '方向键控制移动，A/B 为主要动作，L/R 为肩键，Start 打开暂停或菜单；网页端实际键位以模拟器设置页为准，可按习惯重新绑定。'
const html5Controls =
  '电脑端使用方向键、WASD 与页面提示键操作，手机端使用屏幕触控按钮；不同版本可能略有差异，请以游戏开始界面的提示为准。'
const arcadeSave =
  '街机原版通常不提供流程存档；可使用本站模拟器的即时存档功能保存进度，换设备前建议确认存档是否已保存在当前浏览器。'
const gbaSave =
  '优先使用游戏菜单内的正式存档；也可以使用模拟器即时存档作为临时备份。关闭页面前请等待游戏内保存完成，不要只依赖自动记录。'

function arcadeGuide(seed: GuideSeed): ChineseGameGuide {
  return {
    controls: arcadeControls,
    moves: seed.moves ?? '本作为动作游戏，没有统一必杀技表；优先掌握跳跃攻击、下蹲攻击、拾取武器与保险技，具体组合以游戏内角色动作为准。',
    multiplayer: seed.multiplayer ?? '支持街机同屏双人时，先为 1P、2P 分别设置方向和动作键，再由第二位玩家按开始键加入。',
    save: seed.save ?? arcadeSave,
    ...seed,
  }
}

function gbaGuide(seed: GuideSeed): ChineseGameGuide {
  return {
    controls: gbaControls,
    moves: seed.moves ?? '常用动作由 A/B 与方向键组合完成；特殊能力、冲刺或切换功能通常会用到 L/R，建议先在暂停菜单确认操作说明。',
    multiplayer: seed.multiplayer ?? '此版本以单人流程为主；原版若依赖 GBA 联机线，网页模拟器通常无法直接复现多人联机。',
    save: seed.save ?? gbaSave,
    ...seed,
  }
}

function html5Guide(seed: GuideSeed): ChineseGameGuide {
  return {
    controls: html5Controls,
    moves: seed.moves ?? '本作没有传统格斗出招表，按页面提示完成移动、确认和功能操作即可。',
    multiplayer: seed.multiplayer ?? '是否支持双人取决于当前网页版本；开始界面没有“双人”或“2P”入口时即为单人模式。',
    save: seed.save ?? '进度通常保存在当前浏览器；清理浏览器数据、使用无痕模式或更换设备可能导致记录消失。',
    ...seed,
  }
}

const guides: Record<string, ChineseGameGuide> = {
  'dyna-gear-arcade-1993': arcadeGuide({
    aliases: ['Dyna Gear', '动力齿轮'],
    gameplay: '选择战士后横向推进，在原始世界中击败兽人、恐龙和大型首领；注意利用上下走位把敌人引到同一侧。',
    name: '动力齿轮',
    summary: '世嘉 1993 年推出的奇幻横版清版动作街机，特色是原始世界题材、夸张角色动作和双人合作。',
  }),
  'armored-warriors-arcade-1994': arcadeGuide({
    aliases: ['Armored Warriors', 'Powered Gear', '机甲战士'],
    gameplay: '驾驶机甲清版闯关，击落敌方零件后可以更换手臂、腿部和副武器；根据首领弱点及时换装比一直保留高攻击零件更实用。',
    moves: '攻击键连续输入可形成连击；跳跃配合攻击可突进，部分机体可用方向与攻击组合发动冲刺技。紧急保险技会消耗耐久，不要在安全场面浪费。',
    name: '装甲战士',
    summary: '卡普空机甲题材清版动作游戏，以战场拾取零件、即时改装和多人协力著称。',
  }),
  'flowline-an-endless-mountain-html5': html5Guide({
    aliases: ['FLOWLINE', '无尽山脉'],
    gameplay: '控制角色沿山地路线持续前进，观察坡度、速度与落点，尽量维持连贯移动并刷新距离纪录。',
    name: 'FLOWLINE：无尽山脉',
    summary: '一款强调节奏、路线判断与持续挑战的轻量网页运动游戏。',
  }),
  'san-guo-qun-ying-zhuan-2-html5-1998': html5Guide({
    aliases: ['三国群英传Ⅱ', '三国群英传2网页版'],
    gameplay: '在大地图经营城池、招募武将和调配兵力，进入战斗后根据兵种克制、武将技与士气决定进攻时机。前期优先稳住相邻城池和高忠诚武将。',
    moves: '本作为策略游戏，没有格斗出招；战斗重点是选择全军前进、待命、上下移动与武将技释放时机。',
    multiplayer: '当前网页版本以单人战役为主，不支持两名玩家实时同屏对战。',
    name: '三国群英传2',
    summary: '以三国势力经营、大地图行军和即时百人战斗为核心的经典策略游戏。',
  }),
  'pretty-soldier-sailor-moon-arcade-1995': arcadeGuide({
    aliases: ['Pretty Soldier Sailor Moon', '美少女战士街机版'],
    gameplay: '选择水手战士横向清版，利用普通连击、投技和范围必杀处理包围；双人时一人控场、一人集中攻击首领更稳定。',
    name: '美少女战士',
    summary: '根据同名作品改编的街机清版动作游戏，可操作多位水手战士进行同屏合作。',
  }),
  'demon-front-arcade-2002': arcadeGuide({
    aliases: ['Demon Front', '魔域战线', '恶魔前线'],
    gameplay: '横版跑射中可以携带宠物精灵，精灵既能攻击也能形成护盾；面对密集弹幕时先保命，再利用蓄力和重武器清场。',
    name: '魔域战线',
    summary: 'IGS 推出的奇幻题材横版射击街机，常被玩家视作具有独特宠物系统的合金弹头式作品。',
  }),
  'top-hunter-roddy-and-cathy-arcade-1994': arcadeGuide({
    aliases: ['Top Hunter', 'Roddy & Cathy', '顶尖猎人'],
    gameplay: '在前后两条纵深轨道间切换，使用拳脚、投技和场景机关推进；遇到直线攻击时切换轨道通常比硬跳更安全。',
    moves: '除普通攻击与跳跃外，可尝试方向连续输入配合攻击发动冲刺或特殊动作；角色还能抓取敌人并使用关卡中的机械装置。',
    name: '顶尖猎人：罗迪与凯茜',
    summary: 'NEOGEO 平台的双轨道清版动作游戏，融合格斗输入、场景机关与双人合作。',
  }),
  'disneys-aladdin-gba-2003': gbaGuide({
    aliases: ['Disney’s Aladdin', '阿拉丁 GBA版'],
    gameplay: '控制阿拉丁完成平台跳跃、攀爬和战斗，苹果适合远程牵制，弯刀用于近身处理敌人；先观察移动平台节奏再起跳。',
    name: '迪士尼阿拉丁',
    summary: '以迪士尼动画为主题的 GBA 横版动作游戏，重点是平台跳跃、收集与关卡路线。',
  }),
  'kirby-nightmare-in-dream-land-gba-2002': gbaGuide({
    aliases: ['Kirby: Nightmare in Dream Land', '星之卡比 梦之泉豪华版'],
    gameplay: '吞下敌人复制能力，再根据机关和首领更换合适能力；漂浮能降低落坑风险，新手可优先使用剑、火焰等容易控制的能力。',
    name: '星之卡比：梦之泉豪华版',
    summary: '梦之泉物语的 GBA 重制作品，以吞噬、复制能力和轻快平台闯关为核心。',
  }),
  'james-pond-codename-robocod-gba-2003': gbaGuide({
    aliases: ['James Pond: Codename Robocod', '机器鱼特工'],
    gameplay: '利用主角可伸长身体的能力攀上高处、寻找隐藏路线并解救目标；进入新区域时先确认上下空间，避免被机关夹击。',
    name: '詹姆斯·庞德：代号机器鱼',
    summary: '以特工鱼为主角的幽默平台动作游戏，特色是伸缩身体和多层探索。',
  }),
  'mario-vs-donkey-kong-gba-2004': gbaGuide({
    aliases: ['Mario vs. Donkey Kong', '马里奥对大金刚'],
    gameplay: '观察钥匙、开关、颜色平台和敌人行动顺序，在时限内规划路线；倒立跳、后空翻等动作能到达普通跳跃够不到的位置。',
    moves: '方向键移动，A 跳跃；蹲下、倒立和方向组合可衍生高跳与后空翻。先在安全区域练习动作，再挑战需要连续操作的机关。',
    name: '马里奥对大金刚',
    summary: '融合平台动作与解谜的 GBA 作品，每关需要取得钥匙、救出迷你马里奥并破解机关。',
  }),
  'spyro-season-of-ice-gba-2001': gbaGuide({
    aliases: ['Spyro: Season of Ice', '小龙斯派罗 冰之季节'],
    gameplay: '在等距场景中探索、冲撞敌人并喷火，解救精灵和收集宝石；转向时留意角色朝向，跳跃前先对准落点。',
    name: '小龙斯派罗：冰之季节',
    summary: '紫色小龙斯派罗在 GBA 上的等距视角动作冒险，包含探索、收集和迷你关卡。',
  }),
  'klonoa-2-dream-champ-tournament-gba-2002': gbaGuide({
    aliases: ['Klonoa 2: Dream Champ Tournament', '风之克罗诺亚G2'],
    gameplay: '用风弹抓住敌人，再把敌人投向机关或借力二段跳；很多谜题要求保留正确敌人，不要见到目标就立刻扔掉。',
    name: '风之克罗诺亚G2：梦幻冠军赛',
    summary: '以抓取敌人、投掷解谜和二段跳为核心的 GBA 平台动作游戏。',
  }),
  'lady-sia-gba-2001': gbaGuide({
    aliases: ['Lady Sia', '希娅公主'],
    gameplay: '使用剑术、跳跃和逐步解锁的能力探索关卡，留意可攀爬墙面与隐藏通路；首领战先观察攻击循环再近身。',
    name: '希娅公主',
    summary: '原创奇幻题材 GBA 动作冒险，以手绘风格、剑术和变身能力为特色。',
  }),
  'densetsu-no-stafy-gba-2002': gbaGuide({
    aliases: ['Densetsu no Stafy', '传说的斯塔菲'],
    gameplay: '在水下用旋转攻击清敌并推动机关，陆地部分注意跳跃惯性；与场景角色交谈可获得路线和任务提示。',
    name: '传说的斯塔菲',
    summary: '任天堂掌机上的水下平台动作游戏，主角斯塔菲以旋转、游泳和轻度解谜推进冒险。',
  }),
  'sonic-advance-2-gba-2002': gbaGuide({
    aliases: ['Sonic Advance 2', '索尼克进化2'],
    gameplay: '保持速度、利用斜坡和弹簧连续通过关卡，同时观察陷阱提示；新手不要全程按住前进，危险路段适当减速更容易保留生命。',
    moves: '方向键移动，跳跃键可攻击；下加跳可蓄力冲刺，空中方向与动作键会因角色不同产生飞行、滑翔等能力。',
    name: '索尼克进化2',
    summary: '高速横版动作游戏，加入多名角色与强调连续奔跑的关卡设计。',
  }),
  'disneys-magical-quest-3-starring-mickey-and-donald-gba-2003': gbaGuide({
    aliases: ['Disney’s Magical Quest 3', '米奇与唐老鸭魔法冒险3'],
    gameplay: '米奇与唐老鸭可更换不同服装获得近战、攀爬等能力；看到特殊机关时先判断所需服装，再决定是否返回更换。',
    multiplayer: 'GBA 原版的协作功能依赖联机条件；网页版本通常以单人切换或单人流程为主。',
    name: '米奇与唐老鸭魔法冒险3',
    summary: '迪士尼题材横版动作游戏，核心特色是角色与职业服装带来的多种能力。',
  }),
  'rayman-3-gba-2003': gbaGuide({
    aliases: ['Rayman 3', '雷曼3 GBA版'],
    gameplay: '控制雷曼跳跃、攀爬和远程攻击，收集物品并寻找隐藏出口；连续平台段先掌握悬挂与跳跃节奏。',
    name: '雷曼3',
    summary: 'GBA 上重新设计的 2D 雷曼动作游戏，包含平台闯关、收集和能力解锁。',
  }),
  'ninja-five-0-gba-2003': gbaGuide({
    aliases: ['Ninja Five-O', 'Ninja Cop', '忍者刑警'],
    gameplay: '利用钩索快速移动、救出人质并清理敌人；钩索既能跨越地形也能调整空中位置，是通关和提速的关键。',
    moves: '普通攻击负责近身，飞镖用于远程，钩索键配合方向选择落点；积累能量后可强化攻击，但人质附近不要盲目输出。',
    name: '忍者刑警',
    summary: '高机动 GBA 动作游戏，将忍者战斗、钩索移动和人质救援结合在一起。',
  }),
  'mega-man-zero-3-gba-2004': gbaGuide({
    aliases: ['Mega Man Zero 3', 'Rockman Zero 3', '洛克人ZERO3'],
    gameplay: '用光剑和手枪应对不同距离，冲刺跳与贴墙移动是躲避首领招式的基础；先完成关卡、熟悉动作后再追求评价。',
    moves: '方向键配合冲刺可快速位移，跳跃中贴墙可下滑或蹬墙；主副武器可独立配置，蓄力攻击和属性芯片适合针对首领弱点。',
    name: '洛克人ZERO3',
    summary: '洛克人ZERO系列第三作，以高速动作、武器搭配、芯片系统和高难度首领战著称。',
  }),
}

const kofNames: Record<string, [string, Array<string>]> = {
  'the-king-of-fighters-94-arcade-1994': ['拳皇94', ['KOF94', '格斗之王94']],
  'the-king-of-fighters-95-arcade-1995': ['拳皇95', ['KOF95', '格斗之王95']],
  'the-king-of-fighters-96-arcade-1996': ['拳皇96', ['KOF96', '格斗之王96']],
  'the-king-of-fighters-97-arcade-1997': ['拳皇97', ['KOF97', '格斗之王97']],
  'the-king-of-fighters-98-arcade-1998': ['拳皇98：梦战斗未结束', ['KOF98', '拳皇98梦战']],
  'the-king-of-fighters-99-arcade-1999': ['拳皇99：千年之战', ['KOF99', '格斗之王99']],
  'the-king-of-fighters-2000-arcade-2000': ['拳皇2000', ['KOF2000', '格斗之王2000']],
  'the-king-of-fighters-2001-arcade-2001': ['拳皇2001', ['KOF2001', '格斗之王2001']],
  'the-king-of-fighters-2002-arcade-2002': ['拳皇2002', ['KOF2002', '格斗之王2002']],
  'the-king-of-fighters-2003-arcade-2003': ['拳皇2003', ['KOF2003', '格斗之王2003']],
  'the-king-of-fighters-ex-neoblood-gba-2002': ['拳皇EX：新血', ['KOF EX NeoBlood', '拳皇EX']],
  'king-of-fighters-ex-2-the-howling-blood-gba-2003': ['拳皇EX2：咆哮之血', ['KOF EX2', '拳皇EX2']],
  'nettou-the-king-of-fighters-95-gb-1996': ['热斗拳皇95', ['热斗KOF95', '掌机拳皇95']],
  'nettou-the-king-of-fighters-96-gb-1997': ['热斗拳皇96', ['热斗KOF96', '掌机拳皇96']],
  'king-of-fighters-r2-ngpc-1999': ['拳皇R-2', ['KOF R-2', '掌机拳皇R2']],
}

const streetFighterNames: Record<string, [string, Array<string>]> = {
  'street-fighter-arcade-1987': ['街头霸王', ['Street Fighter', '街霸1']],
  'street-fighter-ii-the-world-warrior-other-1991': ['街头霸王II：世界勇士', ['街霸2', 'Street Fighter II']],
  'street-fighter-ii-champion-edition-arcade-1992': ['街头霸王II：冠军版', ['街霸2冠军版', '四大天王版']],
  'super-street-fighter-ii-arcade-1993': ['超级街头霸王II', ['超级街霸2', 'Super Street Fighter II']],
  'street-fighter-alpha-2-arcade-1996': ['少年街霸2', ['Street Fighter Alpha 2', 'Street Fighter Zero 2']],
  'street-fighter-alpha-3-arcade-1998': ['少年街霸3', ['Street Fighter Alpha 3', 'Street Fighter Zero 3']],
  'street-fight-iii-new-generation-arcade-1997': ['街头霸王III：新纪元', ['街霸3新生代', 'Street Fighter III']],
  'x-men-vs-street-fighter-arcade-1996': ['X战警对街头霸王', ['X-Men vs. Street Fighter', 'XVSF']],
  'super-puzzle-fighter-ii-turbo-arcade-1996': ['超级方块战士II Turbo', ['口袋方块', 'Puzzle Fighter']],
}

export function getChineseGameGuide(game: PublicGame): ChineseGameGuide | undefined {
  const slug = game.url_slug?.trim() ?? ''

  if (guides[slug]) {
    return guides[slug]
  }

  const kof = kofNames[slug]
  if (kof) {
    const isHandheld = /-(?:gba|gb|ngpc)-/.test(slug)
    const factory = isHandheld ? gbaGuide : arcadeGuide
    return factory({
      aliases: kof[1],
      gameplay: '先选择三名角色组成队伍，通过走位、轻重攻击、跳跃和必杀技击败对手。新手先固定一支队伍，熟悉对空、牵制与能量使用，再练习连续技。',
      moves: '采用数字方向记法时，236 表示下、右下、右，214 表示下、左下、左；常见必杀技为 236/214 加拳或脚，超必杀通常需要能量。不同角色与版本指令会变化，请结合角色出招表练习。',
      multiplayer: isHandheld
        ? '掌机原版对战通常需要联机设备；网页版本一般以单人模式为主。'
        : '支持 1P 对 2P。先分别配置两套方向与拳脚键，第二位玩家投币并按开始键即可加入对战。',
      name: kof[0],
      summary: `${kof[0]}是 SNK 拳皇系列作品，核心是三人组队、能量管理、必杀技与本地对战。`,
    })
  }

  const streetFighter = streetFighterNames[slug]
  if (streetFighter) {
    return arcadeGuide({
      aliases: streetFighter[1],
      gameplay: '围绕地面牵制、跳跃对空、投技和必杀技展开一对一格斗。先掌握防守与稳定对空，再练习从普通技取消到必杀技。',
      moves: '常见波动指令为 236+拳，升龙指令为 623+拳，旋风类招式常用 214+脚；具体角色和版本存在差异，蓄力角色还需要按住后或下约一秒再输入相反方向与攻击键。',
      multiplayer: '支持 1P 对 2P 本地对战。分别设置两套方向与拳脚键，第二位玩家投币并按开始键加入。',
      name: streetFighter[0],
      summary: `${streetFighter[0]}属于卡普空街头霸王系列，强调距离控制、对空、防守和必杀技输入。`,
    })
  }

  if (slug === 'snk-vs-capcom-match-the-millennium-ngpc-1999') {
    return gbaGuide({
      aliases: ['SNK vs. Capcom: Match of the Millennium', 'SNK对卡普空 千年之战'],
      gameplay: '从 SNK 与 CAPCOM 角色中组建单人、双人或三人队伍，利用简化拳脚系统完成对战和小游戏。',
      moves: '必杀技以 236、214、623 等方向组合加攻击键为主；掌机版按键较少，同一角色的轻重攻击会根据按键时间变化。',
      name: 'SNK对卡普空：千年之战',
      summary: 'NEOGEO Pocket Color 上的跨厂商格斗作品，拥有大量角色和掌机化操作。',
    })
  }

  if (slug === 'super-fighters-99-gbc-1999') {
    return gbaGuide({
      aliases: ['Super Fighters 99', '超级格斗家99'],
      gameplay: '选择角色进行掌机格斗，利用方向、普通攻击和必杀技削减对手体力；画面节奏较快，先练习防守和稳定对空。',
      moves: '常见必杀输入为 236 或 214 配合攻击键，不同角色指令不同；掌机按键较少，连续技以普通攻击衔接必杀为主。',
      name: '超级格斗家99',
      summary: 'Game Boy Color 上的非官方风格格斗作品，角色与系统带有明显的街机格斗游戏元素。',
    })
  }

  if (slug === 'snk-gals-s-fighters-ngpc-2000') {
    return gbaGuide({
      aliases: ['SNK Gals’ Fighters', 'SNK女格斗家'],
      gameplay: '选择 SNK 女性角色参加一对一比赛，通过轻重攻击、闪避和必杀技取胜，并逐步解锁剧情与隐藏内容。',
      moves: '必杀技主要使用 236、214、623 等方向输入配合攻击键；掌机版强调短连段和闪避，能量足够时可发动超必杀。',
      name: 'SNK女格斗家',
      summary: 'NEOGEO Pocket Color 的轻快格斗作品，以 SNK 女性角色阵容和掌机化操作为特色。',
    })
  }

  return undefined
}

export function applyChineseGameGuide(game: PublicGame, guide: ChineseGameGuide | undefined) {
  return guide
    ? {
        ...game,
        description: guide.summary,
        name: guide.name,
      }
    : game
}
