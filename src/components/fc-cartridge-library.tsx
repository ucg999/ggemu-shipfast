import { useEffect, useMemo, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { SiteLayout } from '#/components/site-layout'
import { CartridgeControlsDialog, CartridgePlayerDialog } from '#/components/cartridge-controls-dialog'
import { addCoinBalance, readCoinBalance, spendBrowserCoinBalance } from '#/lib/coin-wallet'
import { getMemberSession, useMemberSession } from '#/lib/member-client'
import { collectionApiUrl, getGuestCollectorId } from '#/lib/library-collection-client'

const OWNED_CARTRIDGES_KEY = 'ucg999-fc-owned-cartridges'
const OWNED_CARTRIDGES_MIGRATION_KEY = 'ucg999-fc-owned-cartridges-migrated'
const CARTRIDGE_PRICE = 10
const MAIN_SITE_TRIAL_SLUGS: Readonly<Record<string, string>> = {
  'balloon-fight': 'balloon-fight-nes-1986',
  'ice-climber': 'ice-climber-nes-1985',
  'kung-fu': 'yie-ar-kung-fu-nes-1985',
}

function isLocalDevelopment() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

const PRISON_BREAK_GUIDE = {
  title: '这次的脱狱，有什么不同？',
  introduction: [
    '保留原作的横版格斗节奏，九名人物都能成为主角。除了拳脚和拾取武器，还能跑步、翻滚、二段跳、连招和抓摔；每个人物也有自己的出场、过关和通关对白与立绘。',
  ],
  highlights: [
    ['六种语言', '英文、日文、繁体中文、广东话、简体中文、韩文。'],
    ['单人或双人', '两个人一起出击。双人共用所选人物，体力与武器库存各自记录。'],
    ['九人任选', '开局、过关后和接关时选人；关卡途中及首领战不换人。'],
    ['更多动作', '冲刺、滑铲、蹲下、翻滚、空中攻击、五连击与抓摔。'],
    ['随身武器', '小刀、枪、手榴弹分别保存库存，捡到武器不会自动换装。'],
    ['普通与困难', '默认困难。困难模式敌人血量三倍，进攻、躲避更积极；可持械敌兵带武器，能投手榴弹的普通敌兵每次出场带两颗。'],
    ['新的演出', '片头动作场面、人物对白、插画、音乐和音效。'],
  ],
  sections: [
    {
      title: '九名角色，各有拿手好戏',
      items: [
        ['巴特、斯内库', '拳脚均衡，能用小刀、枪和手榴弹。'],
        ['绿衣兵', '三种武器都能用，上+A+B 空翻高跳，落地扎刀。'],
        ['格斗兵', '使用小刀、手榴弹；不能选枪。'],
        ['持刀兵', '空手也能上+B 扔库存小刀，上+A+B 空翻高跳并落地扎刀。'],
        ['唐·詹姆斯', '散弹枪扇形射击。Select 切换枪、手榴弹和空手；持手榴弹 B 投掷，持枪 B 先举枪再向下砸，上+B 为枪托攻击。'],
        ['安吉尔', '只用拳脚。跑步中 B 肩撞，A+B 蓄力起跳并飞身重压。'],
        ['斯尼维尔', '手枪快速两连射，B 先举枪再向下砸。'],
        ['雷克斯', '只用拳脚。跑步中 A 团身冲撞，上+A+B 空翻高跳。'],
      ],
    },
    {
      title: '基本操作',
      items: [
        ['方向键', '移动。'], ['A', '空手踢腿，持枪射击。'], ['B', '空手出拳、持刀挥刀、持枪近身攻击、持手榴弹投掷。'],
        ['A+B', '普通低跳；安吉尔为蓄力跳跃攻击。'], ['上+A+B', '绿衣兵、持刀兵、雷克斯空翻高跳。'],
        ['下+B', '蹲下；蹲着按左／右翻滚，新按其他按键起身。'], ['Select', '空手→小刀→枪→手榴弹循环换装；跳过不能用或已经耗尽的武器。'],
        ['Start', '暂停／继续；有提示的剧情画面可跳过。'],
      ],
    },
    {
      title: '进阶招式',
      items: [
        ['跑步', '快速连按两次同一方向，再按一次相同方向停跑。跑步中 A 前冲踢，B 前冲攻击，下+A 滑铲，A+B 助跑跳；人物专属招式优先。'],
        ['翻滚攻击', '翻滚中 A 旋风腿、B 攻击、A+B 起跳。持刀按 B，会滚完再向前刺；从翻滚中使出的攻击是同类普通攻击的两倍伤害。'],
        ['空中', '普通跳跃中 B 飞踢，持刀为旋风刀；A 踢腿，接近最高点按 A 旋风腿。再按 A+B 二段跳。空翻高跳不接受这些普通跳跃的追加招式。'],
        ['连击', '后→前+B 五连拳，持刀时为五连砍；“前”是人物面朝的方向。'],
        ['抓摔', '普通敌兵血量够低并闪光，或仍活着但已倒地时，向前走近可抓住。B 或前+B 向前扔，后+B 向后扔。抓住后敌人会在 1–5 秒内挣脱；已经开始的投掷会完成。'],
        ['首领近身技', '贴近敌方首领按前+B 扣血，首领不会像普通敌兵那样被扔出去。'],
        ['倒地起身', '落地且仍活着时，新按 A 或 B 前冲攻击。'],
        ['暂停跳关', '暂停后上+A 前一关，第一关无效；下+A 下一关，最多到结局。每次需重新按 A。'],
      ],
    },
    {
      title: '武器与库存',
      items: [
        ['开局库存', '可持械人物开局有五把小刀、一把枪、三颗手榴弹库存，只能使用自己支持的武器。开局均为空手，唐·詹姆斯和斯尼维尔也要按 Select 拿出枪。'],
        ['库存规则', '库存过关、死亡后保留，最多 99。枪另有子弹数量，有备用枪时打空后换下一把；最后一把打空仍能近身攻击。来回切换不会补子弹。'],
        ['使用方式', '持刀上+B 扔刀，持手榴弹 B 投掷，每次消耗一件库存。唐·詹姆斯用 Select 切换到手榴弹，再按 B 投掷；安吉尔、雷克斯始终空手。'],
      ],
    },
  ],
  credit: '白河愁',
} as const

const GREEN_BERET_CAPTAIN_AMERICA_GUIDE = {
  title: '这个改版，有什么不同？',
  introduction: [
    '在《绿色兵团》的基础上扩展了六语言界面、盾牌反击、全新近战动作、四栏武器、战犬支援、双人合作和全新像素动画片头。',
  ],
  highlights: [
    ['六种语言', '日语、英语、繁体中文、粤语、简体中文和韩语。支持对应语言的标题、菜单与剧情文字；粤语为文字界面。'],
    ['盾牌反击', '挡下子弹和激光，并以双倍速度反弹；举盾还可弹回从上方袭来的跳跃敌兵。'],
    ['全新近战', '横向翻滚、斜上旋转、空中飞踢与二段跳，让移动和进攻更灵活。'],
    ['四栏武器系统', '狗／小刀、火箭筒、手雷、手枪自由切换，当前武器以亮白色数字显示。'],
    ['战犬支援', '召唤普通狗扑击敌人，还有机会召出无敌金狗，冲破地雷阵。'],
    ['双人合作', '两位玩家各自管理弹药与召唤次数，可以配合举盾、翻滚和放狗。'],
    ['全新像素动画片头', '蓝衣兵盾反激光、红衣兵翻滚突击、双犬出击，以及女情报员与鹰的支援演出，配有音乐和音效。女情报员与鹰仅在片头登场。'],
  ],
  sections: [
    {
      title: '游戏设置',
      items: [
        ['可调项目', '初始生命 1～15（默认 12）、接关次数 0～9 或无限（默认无限），以及起始关卡 1～6。'],
        ['操作方法', '上下选择项目，左右调整，按 A 试听音乐或音效；按 START 确认，或选中“开始游戏”后按 A。'],
      ],
    },
    {
      title: '基本操作',
      items: [
        ['方向键', '移动、转向、蹲下；在梯子处上下攀爬。'],
        ['A', '跳跃；空中松开后再次按 A，可以二段跳。'],
        ['B', '小刀攻击。'],
        ['按住上／左上／右上', '举起头顶盾，移动和普通跳跃中也可使用。'],
        ['SELECT', '切换当前武器。'],
        ['A+B', '使用当前武器；狗栏位时召唤战犬。'],
        ['左→右+B', '向右翻滚突击。'],
        ['右→左+B', '向左翻滚突击。'],
        ['下→上+B', '斜上旋转攻击。'],
        ['空中下／斜下+B', '飞踢。'],
        ['平台上按住下，再按 A', '从可下穿的平台落下。'],
        ['START', '开始／暂停。'],
        ['指令说明', '“→”表示依次输入，“+”表示组合按键。特殊武器使用 A+B，单按 B 始终是普通近战攻击。'],
      ],
    },
    {
      title: '盾牌与出招技巧',
      items: [
        ['盾牌', '只能防住盾面方向的攻击，并非全身无敌。可反弹子弹、激光和从上方袭来的跳跃敌兵；反弹弹丸命中敌人后消失。'],
        ['动作限制', '翻滚、飞踢及放狗指挥期间不能同时举盾。'],
        ['翻滚方向', '接受斜方向输入，以最后有效的左右输入为准。例如“左下→右上+B”会向右斜上旋转；“下→上→右+B”同样向右斜上旋转。'],
        ['招式优先级', '下上指令优先于横向翻滚；空中斜下+B 优先触发飞踢。'],
        ['地雷与跳跃敌兵', '旋转可以穿过地雷而不触发爆炸；趴下出刀也能命中攻击范围内的跳跃敌兵。'],
      ],
    },
    {
      title: '武器与战犬',
      items: [
        ['武器切换', '按 SELECT 循环切换：狗（小刀模式）→火箭筒→手雷→手枪。'],
        ['初始库存', '每位玩家开始时有 3 次放狗、5 发火箭筒、10 枚手雷和 30 发手枪弹药。拾取武器可补充库存，普通武器剩余弹药在死亡、接关后保留。'],
        ['召唤方法', '选中狗栏位按 A+B，主角挥手指挥，战犬从画面左侧向右冲出，发现敌人后扑击。地面指挥动作也具有小刀威力。'],
        ['召唤限制', '每条生命有 3 次召唤，过关后补满；全场同时只能有一只我方狗，它离场前不能再次召唤。'],
        ['普通狗', '蓝色系外观，与敌犬区分。被子弹击中会死亡；踩中地雷会引爆地雷，并被炸死。'],
        ['金狗', '每次召唤有 1/8 概率出现。不会被敌方子弹或地雷杀死，可引爆地雷后继续前进。'],
        ['折返', '普通狗首次有 1/4 概率折返，金狗为 1/2；每成功折返一次，下次概率减半。出场、完成扑击及折返时会叫一声。'],
      ],
    },
    {
      title: '地道与最终决战',
      items: [
        ['地下通道', '用手雷炸开隐藏入口，走到梯子处按住下，即可进入地下通道，再寻找出口返回地表。'],
        ['最终核弹', '除了火箭筒、手雷和手枪，也能用小刀、飞踢和旋转命中弱点。战犬不能直接秒杀核弹；近战命中的爆点不会产生火箭筒式范围伤害。摧毁目标后，完成最后的逃离。'],
      ],
    },
  ],
} as const

const CONTRA_UNDERWATER_GUIDE = {
  title: '这个改版，有什么不同？',
  introduction: [
    '《魂斗罗：水下八关》加入六名能力各异的角色、双武器切换、更多动作、双人合作、全新演出与水下篇 Boss 强化，并提供丰富的开局设置。',
  ],
  highlights: [
    ['六名角色', '比尔、兰斯可以二段跳；RD008、RC011 能短暂悬停；狼人可以高跳；希娜落地前最多进行三次八方向突进，不能连续朝同一方向，并带踩踏伤害。'],
    ['双武器切换', '随身携带两把枪，按 SELECT 切换。交叉前进的双火球、强化散弹与加粗激光，带来不同打法。'],
    ['更多动作', '加入飞踢、踩踏和滑铲，跳跃高低也能控制。特殊动作主要用于横版关卡。'],
    ['双人合作', '两名玩家并肩闯关；同时碰到同一道具时，两人都能获得效果。'],
    ['全新演出', '加入六人立绘、组队开场、队伍合照与角色通讯。'],
    ['原曲重混', '水下八关及基地头目战重新编曲，保留熟悉旋律并加入新的伴奏变化；经典八关音乐保持不变。'],
    ['自由设置', '可选择起始关卡、生命、接关次数、初始武器与无敌模式，并支持六种语言。'],
  ],
  sections: [
    {
      title: '基本操作',
      items: [
        ['方向键', '移动／瞄准。'],
        ['A', '跳跃。'],
        ['B', '射击。'],
        ['SELECT', '切换随身携带的两把武器。'],
        ['START', '暂停。'],
      ],
    },
    {
      title: '横版关卡特殊动作',
      items: [
        ['控制跳跃', '按住 A 的时间决定跳跃高低。'],
        ['滑铲', '站在地面依次输入“下→前→A”。'],
        ['踩踏／飞踢', '除希娜外，空中按下+A 踩踏，按斜下+A 飞踢。'],
        ['希娜突进', '空中再次按方向+A，可进行八方向突进；每次必须松开再按 A，落地前最多三次，不能连续同向，接近地面时不能发动。'],
        ['取消突进', '不按 A，只按反方向，可以取消希娜的突进并下落。'],
      ],
    },
    {
      title: '武器与角色效果',
      items: [
        ['默认 R 效果', '比尔、兰斯使用 S，机械人使用 M，狼人使用 L，希娜使用 F 时，默认带有原本的 R 效果；R 道具仍可正常生效。'],
        ['双武器', '两把枪都随身保留，通过 SELECT 随时切换，方便针对不同地形和敌人改变打法。'],
      ],
    },
    {
      title: '接关与重新选人',
      items: [
        ['默认接关', '默认提供 255 次接关。'],
        ['全灭后', '按 START 先重新选择角色，再回到当前场景的死亡位置；按 SELECT 可以结束游戏。'],
        ['过关后', '普通过关对话结束后，也可以重新选择角色。'],
      ],
    },
    {
      title: '水下篇 Boss 强化',
      items: [
        ['强化范围', 'Boss 强化只作用于水下篇。'],
        ['第五关', '双雪山 Boss。'],
        ['第六关', '三巨神兵。'],
        ['第七关', '接力战与炮台。'],
        ['最终关', '加入瞄准连射、激光扫射和地面冲击波。'],
      ],
    },
  ],
} as const

type FcRankings = {
  cartridges: { rank: number; cartridgeId: string; count: number }[]
  collectors: { rank: number; displayName: string; playerNumber: number | null; count: number }[]
}

const FC_CARTRIDGES = [
  {
    id: 'donkey-kong', number: '001号', title: '森喜刚', cover: '/fc-player/assets/cartridges/donkey-kong.min.webp',
    genre: '动作', releaseDate: '1983-07-15', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'donkey-kong-jr', number: '002号', title: '森喜刚JR.', cover: '/fc-player/assets/cartridges/donkey-kong-jr.min.webp',
    genre: '动作', releaseDate: '1983-07-15', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'popeye', number: '003号', title: '大力水手', cover: '/fc-player/assets/cartridges/popeye.min.webp',
    genre: '动作', releaseDate: '1983-07-15', publisher: '任天堂', initial: 'D', edition: '原版',
  },
  {
    id: 'gomoku-narabe', number: '004号', title: '五子棋', cover: '/fc-player/assets/cartridges/gomoku-narabe.min.webp',
    genre: '益智', releaseDate: '1983-08-27', publisher: '任天堂', initial: 'W', edition: '原版',
  },
  {
    id: 'mahjong', number: '005号', title: '麻将', cover: '/fc-player/assets/cartridges/mahjong.min.webp',
    genre: '益智', releaseDate: '1983-08-27', publisher: '任天堂', initial: 'M', edition: '原版',
  },
  {
    id: 'mario-bros', number: '006号', title: '水管玛丽', cover: '/fc-player/assets/cartridges/mario-bros.min.webp',
    genre: '动作', releaseDate: '1983-09-09', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'popeye-english', number: '007号', title: '大力水手学英语', cover: '/fc-player/assets/cartridges/popeye-english.min.webp',
    genre: '教育', releaseDate: '1983-11-22', publisher: '任天堂', initial: 'D', edition: '原版',
  },
  {
    id: 'baseball', number: '008号', title: '棒球', cover: '/fc-player/assets/cartridges/baseball.min.webp',
    genre: '体育', releaseDate: '1983-12-07', publisher: '任天堂', initial: 'B', edition: '原版',
  },
  {
    id: 'donkey-kong-jr-math', number: '009号', title: '森喜刚学算数', cover: '/fc-player/assets/cartridges/donkey-kong-jr-math.min.webp',
    genre: '教育', releaseDate: '1983-12-12', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'urban-champion',
    number: '026号',
    title: '街头格斗',
    cover: '/fc-player/assets/cartridges/urban-champion.min.webp',
    genre: '格斗',
    releaseDate: '1984-11-14',
    publisher: '任天堂',
    initial: 'J',
    edition: '原版',
  },
  {
    id: 'happy-cat',
    number: '027号',
    title: '快乐猫',
    cover: '/fc-player/assets/cartridges/happy-cat.min.webp',
    genre: '动作',
    releaseDate: '1984-11-14',
    publisher: 'NAMCO',
    initial: 'K',
    edition: '原版',
  },
  {
    id: 'balloon-fight', number: '030号', title: '气球大战', cover: '/fc-player/assets/cartridges/balloon-fight.min.webp',
    genre: '动作', releaseDate: '1985-01-22', publisher: '任天堂', initial: 'Q', edition: '原版',
  },
  {
    id: 'ice-climber', number: '031号', title: '敲冰块', cover: '/fc-player/assets/cartridges/ice-climber.min.webp',
    genre: '动作', releaseDate: '1985-01-30', publisher: '任天堂', initial: 'Q', edition: '原版',
  },
  {
    id: 'galaga', number: '033号', title: '大蜜蜂', cover: '/fc-player/assets/cartridges/galaga.min.webp',
    genre: '射击', releaseDate: '1985-02-15', publisher: 'NAMCO', initial: 'D', edition: '原版',
  },
  {
    id: 'soccer', number: '037号', title: '足球', cover: '/fc-player/assets/cartridges/soccer.min.webp',
    genre: '体育', releaseDate: '1985-04-09', publisher: '任天堂', initial: 'Z', edition: '原版',
  },
  {
    id: 'championship-lode-runner', number: '039号', title: '冠军淘金者', cover: '/fc-player/assets/cartridges/championship-lode-runner.min.webp',
    genre: '动作', releaseDate: '1985-04-17', publisher: 'Hudson Soft', initial: 'G', edition: '原版',
  },
  {
    id: 'kung-fu', number: '040号', title: '功夫', cover: '/fc-player/assets/cartridges/kung-fu.min.webp',
    genre: '动作', releaseDate: '1985-06-21', publisher: '任天堂', initial: 'G', edition: '原版',
  },
  {
    id: 'wrecking-crew', number: '046号', title: '拆屋工', cover: '/fc-player/assets/cartridges/wrecking-crew.min.webp',
    genre: '益智', releaseDate: '1985-06-18', publisher: '任天堂', initial: 'C', edition: '原版',
  },
  {
    id: 'karateka-street-fighter',
    number: '1054号',
    title: '空手道 街霸版',
    cover: '/fc-player/assets/cartridges/karateka-street-fighter.min.webp',
    genre: '格斗',
    releaseDate: '1985-12-05',
    publisher: 'Soft Pro',
    initial: 'K',
    edition: '改版',
  },
  {
    id: 'baoxiao-sanguo',
    number: '1055号',
    title: '爆笑三国',
    cover: '/fc-player/assets/cartridges/baoxiao-sanguo.min.webp',
    genre: '角色扮演',
    releaseDate: '1996-01-01',
    publisher: '外星科技',
    initial: 'B',
    edition: '改版',
  },
  {
    id: 'prison-break-nine-characters',
    number: '1056号',
    title: '脱狱 9人版',
    cover: '/fc-player/assets/cartridges/prison-break-nine-characters.min.webp',
    genre: '动作',
    releaseDate: '1989-06-30',
    publisher: 'SNK',
    initial: 'T',
    edition: '改版',
  },
  {
    id: 'contra-underwater-eight-levels',
    number: '1057号',
    title: '魂斗罗：水下八关',
    cover: '/fc-player/assets/cartridges/contra-underwater-eight-levels.min.webp',
    genre: '射击',
    releaseDate: '1988-02-09',
    publisher: 'Konami',
    initial: 'H',
    edition: '改版',
  },
  {
    id: 'green-beret-captain-america',
    number: '1058号',
    title: '绿色兵团：美国队长版',
    cover: '/fc-player/assets/cartridges/green-beret-captain-america.min.webp',
    genre: '动作',
    releaseDate: '1987-04-10',
    publisher: 'Konami',
    initial: 'L',
    edition: '改版',
  },
] as const

const FC_CARTRIDGE_UPDATED_AT: Record<string, string> = {
  'donkey-kong': '2026-10-05T18:17:37+08:00',
  'donkey-kong-jr': '2026-10-05T18:17:36+08:00',
  'popeye': '2026-10-05T18:17:43+08:00',
  'gomoku-narabe': '2026-10-05T18:17:40+08:00',
  'mahjong': '2026-10-05T19:53:18+08:00',
  'mario-bros': '2026-10-05T18:17:40+08:00',
  'popeye-english': '2026-10-05T18:17:40+08:00',
  baseball: '2026-10-05T18:17:36+08:00',
  'donkey-kong-jr-math': '2026-10-05T18:17:36+08:00',
  'urban-champion': '2026-10-05T18:17:43+08:00',
  'happy-cat': '2026-10-05T18:17:43+08:00',
  'balloon-fight': '2026-10-16T18:30:00+08:00',
  'ice-climber': '2026-10-16T18:30:00+08:00',
  galaga: '2026-10-16T18:30:00+08:00',
  soccer: '2026-10-16T18:30:00+08:00',
  'championship-lode-runner': '2026-10-16T18:30:00+08:00',
  'kung-fu': '2026-10-16T18:30:00+08:00',
  'wrecking-crew': '2026-10-16T18:30:00+08:00',
  'karateka-street-fighter': '2026-10-05T18:17:44+08:00',
  'baoxiao-sanguo': '2026-10-07T11:24:38+08:00',
  'prison-break-nine-characters': '2026-10-11T12:14:55+08:00',
  'contra-underwater-eight-levels': '2026-10-15T16:00:28+08:00',
  'green-beret-captain-america': '2026-10-15T16:00:48+08:00',
}

export function FcCartridgeLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const member = useMemberSession()
  const [owned, setOwned] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'random' | 'updatedAt' | 'releaseDate'>('updatedAt')
  const [reverse, setReverse] = useState(false)
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [letterOpen, setLetterOpen] = useState(false)
  const [selectedInitial, setSelectedInitial] = useState('')
  const [modifiedOnly, setModifiedOnly] = useState(false)
  const [rankings, setRankings] = useState<FcRankings>({ cartridges: [], collectors: [] })
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({})
  const [rankingsOpen, setRankingsOpen] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const searchRef = useRef<HTMLFormElement>(null)

  function applyRankings(result: { rankings?: Partial<FcRankings>; collectionCounts?: Record<string, number> }) {
    setRankings({
      cartridges: Array.isArray(result.rankings?.cartridges) ? result.rankings.cartridges.slice(0, 5) : [],
      collectors: Array.isArray(result.rankings?.collectors) ? result.rankings.collectors.slice(0, 5) : [],
    })
    setCollectionCounts(result.collectionCounts ?? {})
  }

  async function refreshRankings() {
    try {
      const response = await fetch('/api/fc-cartridges', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) return
      applyRankings(await response.json() as { rankings?: Partial<FcRankings>; collectionCounts?: Record<string, number> })
    } catch {}
  }

  useEffect(() => {
    if (isLocalDevelopment()) {
      setOwned(FC_CARTRIDGES.map(cartridge => cartridge.id))
      void refreshRankings()
      return
    }
    if (!member) {
      try {
        const stored = JSON.parse(window.localStorage.getItem(OWNED_CARTRIDGES_KEY) || '[]')
        setOwned(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [])
      } catch { setOwned([]) }
      void fetch(collectionApiUrl('/api/fc-cartridges'), { credentials: 'same-origin', cache: 'no-store' })
        .then(response => response.ok ? response.json() : Promise.reject())
        .then((result: { owned?: string[]; rankings?: Partial<FcRankings>; collectionCounts?: Record<string, number> }) => {
          const next = Array.isArray(result.owned) ? result.owned : []
          setOwned(next)
          window.localStorage.setItem(OWNED_CARTRIDGES_KEY, JSON.stringify(next))
          applyRankings(result)
        }).catch(() => { void refreshRankings() })
      return
    }
    let cancelled = false
    void (async () => {
      let legacyOwned: string[] = []
      let cachedOwned: string[] = []
      const accountCacheKey = `${OWNED_CARTRIDGES_KEY}:${member.id}`
      try {
        const cached = JSON.parse(window.localStorage.getItem(accountCacheKey) || '[]')
        cachedOwned = Array.isArray(cached) ? cached.filter((value): value is string => typeof value === 'string') : []
        if (window.localStorage.getItem(`${OWNED_CARTRIDGES_MIGRATION_KEY}:${member.id}`) !== 'yes') {
          const stored = JSON.parse(window.localStorage.getItem(OWNED_CARTRIDGES_KEY) || '[]')
          legacyOwned = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []
        }
      } catch {}
      try {
        const response = await fetch('/api/fc-cartridges', { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw new Error('collection_load_failed')
        const result = await response.json() as { owned?: string[]; rankings?: Partial<FcRankings>; collectionCounts?: Record<string, number> }
        const next = Array.isArray(result.owned) ? result.owned : []
        if (cancelled) return
        setOwned(next)
        applyRankings(result)
        window.localStorage.setItem(accountCacheKey, JSON.stringify(next))
      } catch {
        if (!cancelled) setOwned(cachedOwned.length ? cachedOwned : legacyOwned)
      }
    })()
    return () => { cancelled = true }
  }, [member?.id])

  useEffect(() => {
    if (!searchOpen) return
    const close = (event: PointerEvent) => {
      if (event.target instanceof Element && !searchRef.current?.contains(event.target) && !event.target.closest('[data-fc-filter]')) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [searchOpen])

  const cartridges = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    const filtered = FC_CARTRIDGES.filter((cartridge) => {
      const values = searchField ? [cartridge[searchField]] : [cartridge.title, cartridge.number, cartridge.genre, cartridge.publisher, cartridge.releaseDate]
      return (!selectedInitial || cartridge.initial === selectedInitial)
        && (!modifiedOnly || cartridge.edition === '改版')
        && (!keyword || values.some(value => value.toLocaleLowerCase().includes(keyword)))
    })
    const result = [...filtered]
    if (sortField === 'random') result.sort(() => Math.random() - 0.5)
    else if (sortField === 'name') result.sort((a, b) => a.title.localeCompare(b.title, lang))
    else if (sortField === 'updatedAt') result.sort((a, b) => Date.parse(FC_CARTRIDGE_UPDATED_AT[b.id]) - Date.parse(FC_CARTRIDGE_UPDATED_AT[a.id]))
    else result.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.number.localeCompare(b.number))
    return reverse ? result.reverse() : result
  }, [lang, modifiedOnly, query, reverse, searchField, selectedInitial, sortField])

  const filters = [
    ['name', copy.gameName], ['random', copy.random], ['updatedAt', copy.updatedAt], ['genre', copy.genre], ['publisher', copy.publisher],
    ['releaseDate', copy.releaseDate], ['modified', copy.modified],
  ] as const

  function handleCartridge(cartridgeId: string) {
    if (isLocalDevelopment()) {
      window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridgeId)}`)
      return
    }
    if (owned.includes(cartridgeId)) {
      window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridgeId)}`)
      return
    }
    setPendingPurchase(cartridgeId)
  }

  function openCartridge(cartridgeId: string) {
    setPreviewing(cartridgeId)
  }

  function playOrCollect(cartridgeId: string) {
    if (owned.includes(cartridgeId) && window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) setPlaying(cartridgeId)
    else handleCartridge(cartridgeId)
  }

  async function confirmPurchase() {
    const cartridgeId = pendingPurchase
    if (!cartridgeId) return
    setPendingPurchase(null)
    const paidFromBrowser = !member
    if (paidFromBrowser && (readCoinBalance() < CARTRIDGE_PRICE || !spendBrowserCoinBalance(CARTRIDGE_PRICE))) { setNotice(copy.insufficient); return }
    const previous = owned
    try {
      let next = [...new Set([...owned, cartridgeId])]
      const response = await fetch('/api/fc-cartridges', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartridgeId, guestId: getGuestCollectorId(), guestPaid: paidFromBrowser, paymentId: paidFromBrowser ? crypto.randomUUID() : undefined }),
      })
      const result = await response.json() as { owned?: string[]; error?: string }
      if (!response.ok) throw new Error(result.error || 'collection_save_failed')
      next = Array.isArray(result.owned) ? result.owned : next
      window.localStorage.setItem(member ? `${OWNED_CARTRIDGES_KEY}:${member.id}` : OWNED_CARTRIDGES_KEY, JSON.stringify(next))
      setOwned(next)
      setNotice(copy.purchased)
      if (member) await getMemberSession().catch(() => null)
      void refreshRankings()
    } catch (error) {
      if (paidFromBrowser) addCoinBalance(CARTRIDGE_PRICE)
      setOwned(previous)
      setNotice(error instanceof Error && error.message.includes('金币不足') ? copy.insufficient : copy.failed)
    }
  }
  return (
    <SiteLayout locale={lang}>
      <main className="min-h-screen bg-[#f0f0ed] px-4 pb-20 pt-8 text-base-content sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-[1500px]">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/50">
                <span>{copy.count(FC_CARTRIDGES.length)}，{copy.collectionHint}</span>
                <span className="font-semibold text-amber-500">{copy.ownedCount(owned.length)}</span>
                <button className="font-semibold text-base-content underline underline-offset-2" type="button" onClick={() => setRankingsOpen(true)}>{copy.rankings}</button>
              </div>
            </div>
            <div className="relative flex w-full max-w-full flex-nowrap items-center justify-start gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:justify-end">
              {filters.map(([field, label]) => (
                <button
                  className={`btn btn-ghost btn-sm shrink-0 whitespace-nowrap px-2 text-sm font-medium ${(sortField === field || (field === 'modified' && modifiedOnly) || (searchField === field && query)) ? 'text-error' : ''}`}
                  data-fc-filter=""
                  key={field}
                  type="button"
                  onClick={() => {
                    if (field === 'genre' || field === 'publisher') {
                      setSearchField(field)
                      setDraftQuery(searchField === field ? query : '')
                      setSearchOpen(true)
                      return
                    }
                    if (field === 'name') {
                      setSortField('name')
                      setReverse(false)
                      setLetterOpen(value => !value)
                      return
                    }
                    if (field === 'modified') {
                      setModifiedOnly(value => !value)
                      return
                    }
                    setReverse(sortField === field && field !== 'random' ? !reverse : false)
                    setSortField(field)
                  }}
                >
                  {label}{sortField === field && field !== 'random' ? <span aria-hidden="true">{reverse ? '↑' : '↓'}</span> : null}
                </button>
              ))}
              <button aria-label={copy.search} className="btn btn-ghost btn-sm btn-square shrink-0" data-fc-filter="" type="button" onClick={() => { setSearchField(null); setDraftQuery(searchField === null ? query : ''); setSearchOpen(true) }}><i className="ri-search-line text-lg" /></button>
              {searchOpen ? <form ref={searchRef} className="absolute right-0 top-full z-30 mt-1 flex h-9 w-64 items-center rounded-lg bg-white p-1 shadow-lg" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery); setSearchOpen(false) }}>
                <input autoFocus className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" placeholder={searchField ? `${copy.search} · ${copy[searchField]}` : copy.searchPlaceholder} type="search" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} />
                <button className="btn btn-error btn-xs text-white" type="submit">{copy.confirm}</button>
              </form> : null}
            </div>
            {letterOpen ? <div className="mt-2 flex w-full flex-wrap items-center gap-1 sm:justify-end">
              <button className={`btn btn-xs ${!selectedInitial ? 'btn-neutral' : 'btn-ghost'}`} type="button" onClick={() => setSelectedInitial('')}>{copy.allLetters}</button>
              {[...new Set(FC_CARTRIDGES.map(item => item.initial))].sort().map(letter => <button className={`btn btn-xs ${selectedInitial === letter ? 'btn-neutral' : 'btn-ghost'}`} key={letter} type="button" onClick={() => setSelectedInitial(letter)}>{letter}</button>)}
            </div> : null}
          </header>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-7">
            {cartridges.map((cartridge, index) => (
              <article className="psp-library-card group relative" key={cartridge.id}>
                <button aria-label={`${owned.includes(cartridge.id) ? copy.open : copy.buy}${cartridge.title}`} className="block w-full" onClick={() => openCartridge(cartridge.id)} type="button">
                  <div className="fc-cartridge-cover psp-library-cover aspect-[3/2] w-full overflow-hidden rounded-lg bg-transparent">
                    <img
                      alt={`${cartridge.title} FC卡带`}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
                      decoding="async"
                      fetchPriority={index < 3 ? 'high' : 'auto'}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      src={cartridge.cover}
                    />
                  </div>
                </button>
                <div className="psp-library-info bg-base-100 p-1.5 sm:p-2">
                  <h2 className="truncate text-center text-sm font-semibold text-base-content sm:text-base" title={cartridge.title}>{cartridge.title}</h2>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-base-content/60 sm:text-xs">
                    <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-center">
                      <span>{cartridge.number}</span>{cartridge.edition === '改版' ? <> · <span className="font-semibold text-error">{copy.modified}</span></> : null}{' · '}<time>{cartridge.releaseDate}</time>{' · '}<span>{cartridge.publisher}</span>
                    </div>
                    <button
                      aria-label={`${owned.includes(cartridge.id) ? copy.open : copy.buy}${cartridge.title}`}
                      className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm transition sm:h-7 sm:w-7 ${owned.includes(cartridge.id) ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-300 text-black hover:bg-amber-200'}`}
                      title={owned.includes(cartridge.id) ? copy.play : `${CARTRIDGE_PRICE} ${copy.buyLabel}`}
                      onClick={() => playOrCollect(cartridge.id)}
                      type="button"
                    >
                      {owned.includes(cartridge.id)
                        ? <i className="ri-play-fill" />
                        : <img alt="" className="h-4 w-4 object-contain sm:h-[18px] sm:w-[18px]" src="/images/coin-rewards/pixel-reward-coin.webp" />}
                    </button>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-x-1 bottom-1 z-30 hidden rounded-lg bg-black/90 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-xl group-hover:block">
                  <strong className="block text-sm font-semibold">{cartridge.title}</strong>
                  <span className="block">{cartridge.number} · {cartridge.genre} · {cartridge.edition}</span>
                  <span className="block">{cartridge.releaseDate} · {cartridge.publisher}</span>
                </div>
              </article>
            ))}
          </div>
          {previewing ? (() => {
            const cartridge = FC_CARTRIDGES.find(item => item.id === previewing)
            if (!cartridge) return null
            const guide = cartridge.id === 'prison-break-nine-characters'
              ? PRISON_BREAK_GUIDE
              : cartridge.id === 'contra-underwater-eight-levels'
                ? CONTRA_UNDERWATER_GUIDE
              : cartridge.id === 'green-beret-captain-america'
                ? GREEN_BERET_CAPTAIN_AMERICA_GUIDE
                : undefined
            return <CartridgeControlsDialog actionHint={lang === 'en' ? 'No loading · Dedicated emulator' : lang === 'zh-TW' ? '無需載入，專用模擬器' : '无需加载，专用模拟器'} actionLabel={owned.includes(cartridge.id) ? copy.play : copy.buyLabel} collectionLabel={lang === 'en' ? `${collectionCounts[cartridge.id] ?? 0} collectors` : `${collectionCounts[cartridge.id] ?? 0}人已收藏`} cover={cartridge.cover} details={`${cartridge.number} · ${cartridge.genre} · ${cartridge.releaseDate} · ${cartridge.publisher}`} guide={guide} onAction={() => {
              setPreviewing(null)
              if (!owned.includes(cartridge.id)) {
                handleCartridge(cartridge.id)
                return
              }
              if (window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) setPlaying(cartridge.id)
              else window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridge.id)}`)
            }} onClose={() => setPreviewing(null)} onTrial={cartridge.id === 'mahjong'
              ? () => { window.location.assign(`/${lang}/games/mahjong-nes-1983/play?autoplay=%221%22&inline=%221%22`) }
              : MAIN_SITE_TRIAL_SLUGS[cartridge.id]
                ? () => { window.location.assign(`/${lang}/games/${MAIN_SITE_TRIAL_SLUGS[cartridge.id]}/play?autoplay=%221%22&inline=%221%22`) }
                : undefined} title={cartridge.title} trialHint={cartridge.id === 'mahjong' || MAIN_SITE_TRIAL_SLUGS[cartridge.id] ? (lang === 'en' ? 'Loading required' : lang === 'zh-TW' ? '需要載入' : '需要加载') : undefined} trialLabel={lang === 'en' ? 'Try now' : lang === 'zh-TW' ? '立即試玩' : '立即试玩'} />
          })() : null}
          {playing ? <CartridgePlayerDialog
            onClose={() => setPlaying(null)}
            src={playing === 'green-beret-captain-america'
              ? '/fc-1058/index.html?v=20261016-2&cartridge=green-beret-captain-america'
              : `/fc-player/index.html?v=20261016-5&cartridge=${encodeURIComponent(playing)}`}
            title={FC_CARTRIDGES.find(item => item.id === playing)?.title ?? 'FC游戏机'}
          /> : null}
          {rankingsOpen ? <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="fc-rankings-title" onClick={() => setRankingsOpen(false)}>
            <section className="w-full max-w-2xl rounded-2xl bg-[#f0f0ed] p-4 text-base-content shadow-2xl sm:p-6" onClick={event => event.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold" id="fc-rankings-title">{copy.rankings}</h2><button aria-label={copy.cancel} className="btn btn-ghost btn-sm btn-circle text-xl" type="button" onClick={() => setRankingsOpen(false)}>×</button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 shadow-sm"><h3 className="mb-2 text-sm font-semibold">{copy.popularRanking}</h3><ol className="space-y-1.5 text-xs sm:text-sm">{rankings.cartridges.length ? rankings.cartridges.map(item => { const cartridge = FC_CARTRIDGES.find(entry => entry.id === item.cartridgeId); return cartridge ? <li className="flex items-center gap-2" key={item.cartridgeId}><b className="w-5 text-center text-amber-600">{item.rank}</b><span className="min-w-0 flex-1 truncate">{cartridge.number} · {cartridge.title}</span><span className="shrink-0 text-base-content/55">{copy.peopleCount(item.count)}</span></li> : null }) : <li className="text-base-content/45">{copy.noRankings}</li>}</ol></div>
                <div className="rounded-xl bg-white p-3 shadow-sm"><h3 className="mb-2 text-sm font-semibold">{copy.collectorRanking}</h3><ol className="space-y-1.5 text-xs sm:text-sm">{rankings.collectors.length ? rankings.collectors.map(item => <li className="flex items-center gap-2" key={`${item.playerNumber ?? 'player'}-${item.rank}`}><b className="w-5 text-center text-amber-600">{item.rank}</b><span className="min-w-0 flex-1 truncate">{item.displayName}{item.playerNumber ? <small className="ml-1 text-base-content/40">ID:{String(item.playerNumber).padStart(5, '0')}</small> : null}</span><span className="shrink-0 text-base-content/55">{copy.cartridgeCount(item.count)}</span></li>) : <li className="text-base-content/45">{copy.noRankings}</li>}</ol></div>
              </div>
            </section>
          </div> : null}
          {pendingPurchase ? <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="fc-purchase-title">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black shadow-2xl">
              <h2 className="text-lg font-semibold" id="fc-purchase-title">{copy.confirmTitle}</h2>
              <p className="mt-2 text-sm text-black/65">{copy.confirmMessage(FC_CARTRIDGES.find(item => item.id === pendingPurchase)?.title ?? '', CARTRIDGE_PRICE)}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPendingPurchase(null)}>{copy.cancel}</button>
                <button className="btn btn-warning btn-sm" type="button" onClick={confirmPurchase}>{copy.confirmCollect}</button>
              </div>
            </div>
          </div> : null}
          {notice ? <div className="fixed bottom-8 left-1/2 z-[180] -translate-x-1/2 rounded-full bg-black px-5 py-2 text-sm text-white shadow-xl" role="status">{notice}</div> : null}
        </div>
      </main>
    </SiteLayout>
  )
}

function getCopy(lang: Locale) {
  if (lang === 'en') return { title: 'FC Cartridge Collection', chinese: 'Chinese', gameName: 'Game name', random: 'Random', genre: 'Game genre', publisher: 'Publisher', releaseDate: 'Release date', updatedAt: 'Last updated', modified: 'Modified', allLetters: 'All', rankings: 'FC rankings', popularRanking: 'Most collected cartridges', collectorRanking: 'Top collectors', noRankings: 'No ranking data yet', peopleCount: (count: number) => `${count} players`, cartridgeCount: (count: number) => `${count} cartridges`, search: 'Search', searchPlaceholder: 'Game name or keyword', confirm: 'Confirm', confirmTitle: 'Collect cartridge?', confirmMessage: (title: string, price: number) => `Spend ${price} coins to collect ${title}?`, cancel: 'Cancel', confirmCollect: 'Collect', open: 'Play ', buy: 'Collect ', buyLabel: 'Collect', play: 'Collected · Play', loginRequired: '', insufficient: `Not enough coins. ${CARTRIDGE_PRICE} coins required.`, purchased: 'Cartridge added to FC Collection', failed: 'Collection could not be saved', count: (count: number) => `${count} cartridges available`, collectionHint: 'collected cartridges can be switched and played directly in the mobile FC Collection', ownedCount: (count: number) => `${count} collected` }
  if (lang === 'zh-TW') return { title: 'FC卡帶收藏', chinese: '中文', gameName: '遊戲名稱', random: '隨機', genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', updatedAt: '更新時間', modified: '改版', allLetters: '全部', rankings: 'FC排行榜', popularRanking: '最多人收藏的卡帶', collectorRanking: '收藏卡帶最多的玩家', noRankings: '暫無排行資料', peopleCount: (count: number) => `${count}人收藏`, cartridgeCount: (count: number) => `${count}款`, search: '搜尋', searchPlaceholder: '遊戲名稱或關鍵詞', confirm: '確認', confirmTitle: '確認收藏卡帶？', confirmMessage: (title: string, price: number) => `將花費 ${price} 個金幣收藏《${title}》，是否繼續？`, cancel: '取消', confirmCollect: '確認收藏', open: '遊玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 遊玩', loginRequired: '請先登入玩家帳號再收藏卡帶', insufficient: `金幣不足，需要${CARTRIDGE_PRICE}個金幣`, purchased: '收藏成功，卡帶已加入FC遊戲機', failed: '卡帶收藏記錄保存失敗', count: (count: number) => `目前共有 ${count} 款卡帶`, collectionHint: '收藏後可直接在手機FC遊戲機換卡帶遊玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
  if (lang === 'ja') return { title: 'FCカセットコレクション', chinese: '中国語', gameName: 'ゲーム名', random: 'ランダム', genre: 'ジャンル', publisher: 'メーカー', releaseDate: '発売日', updatedAt: '更新日時', modified: '改造版', allLetters: 'すべて', rankings: 'FCランキング', popularRanking: '人気カセット', collectorRanking: 'トップコレクター', noRankings: 'ランキングデータはまだありません', peopleCount: (count: number) => `${count}人`, cartridgeCount: (count: number) => `${count}本`, search: '検索', searchPlaceholder: 'ゲーム名またはキーワード', confirm: '確認', confirmTitle: 'カセットをコレクションしますか？', confirmMessage: (title: string, price: number) => `${price}コインで「${title}」をコレクションしますか？`, cancel: 'キャンセル', confirmCollect: 'コレクション', open: 'プレイ：', buy: 'コレクション：', buyLabel: 'コレクション', play: '収集済み・プレイ', loginRequired: 'カセットのコレクションにはログインが必要です', insufficient: `コインが不足しています（${CARTRIDGE_PRICE}枚必要）`, purchased: 'FCコレクションに追加しました', failed: 'コレクション情報を保存できませんでした', count: (count: number) => `${count}本のカセット`, collectionHint: 'コレクション後はスマホのFCコレクションで交換して遊べます', ownedCount: (count: number) => `${count}本収集済み` }
  return { title: 'FC卡带收藏', chinese: '中文', gameName: '游戏名称', random: '随机', genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', updatedAt: '更新时间', modified: '改版', allLetters: '全部', rankings: 'FC排行榜', popularRanking: '最多人收藏的卡带', collectorRanking: '收藏卡带最多的玩家', noRankings: '暂无排行数据', peopleCount: (count: number) => `${count}人收藏`, cartridgeCount: (count: number) => `${count}款`, search: '搜索', searchPlaceholder: '游戏名称或关键词', confirm: '确认', confirmTitle: '确认收藏卡带？', confirmMessage: (title: string, price: number) => `将花费 ${price} 个金币收藏《${title}》，是否继续？`, cancel: '取消', confirmCollect: '确认收藏', open: '游玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 游玩', loginRequired: '', insufficient: `金币不足，需要${CARTRIDGE_PRICE}个金币`, purchased: '收藏成功，卡带已加入FC游戏机', failed: '卡带收藏记录保存失败', count: (count: number) => `目前共有 ${count} 款卡带`, collectionHint: '收藏可直接在手机FC游戏机换卡带游玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
}

