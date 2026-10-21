import type { PublicGame } from './ggemu'
import { getChineseGameGuide } from './chinese-game-guides'

export function getHomeHeroGameName(game: PublicGame, locale: string) {
  return getGameCardDisplayName(game, locale)
}

export function getGameCardDisplayName(game: PublicGame, locale: string) {
  const originalName = game.name?.trim() || (locale === 'en' ? 'Game' : '游戏')
  if (locale === 'zh-CN' || locale === 'zh-TW') {
    const slug = game.url_slug?.trim() || ''
    if (/\p{Script=Han}/u.test(originalName)) return originalName
    return getChineseGameGuide(game)?.name
      || HOME_HERO_CHINESE_NAMES[slug]
      || ARCADE_CHINESE_NAME_OVERRIDES[slug]
      || getChineseKeywordName(game.keywords)
      || translateCommonGameTitle(originalName)
  }
  return originalName
}

function getChineseKeywordName(keywords?: string) {
  if (!keywords) return ''
  const candidates = keywords
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /\p{Script=Han}/u.test(item) && !/[\u3040-\u30ff]/u.test(item))

  return candidates.find((item) => /[\u4e00-\u9fff]{2,}/u.test(item)) || ''
}

const ARCADE_CHINESE_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  '1945-arcade-1995': '1945',
  '1945-ii-arcade-1997': '1945 II',
  '1945-iii-arcade-2000': '1945 III',
  'aquajack-arcade-1990': '水上坦克',
  'arabian-fight-arcade-1992': '阿拉伯之战',
  'bad-dudes-vs-gragon-ninja-arcade-1988': '坏小子大战龙忍者',
  'boogie-wings-arcade-1992': '滑稽战机',
  'cow-boys-of-moo-mesa-arcade-1992': '西部牛仔',
  'excelsior-arcade-1995': '美女打砖',
  'fata-fury-3-arcade-1995': '饿狼传说3',
  'goal-goal-goal-arcade-1995': '进球！进球！进球！',
  'in-the-hunt-arcade-1993': '海底大战争',
  'knights-of-valour-2-plus-arcade-2000': '三国战纪2 Plus',
  'knuckle-bash-2-arcade-1999': '拳击冲击2',
  'megaman-2-the-power-fighters-arcade-1996': '洛克人2：力量对决',
  'new-rally-x-arcade-1981': '新拉力X',
  'super-side-kick-3-the-next-glory-arcade-1992': '得点王3：下一次荣耀',
  'the-king-of-fighters-99-arcade-1999': '拳皇99',
  'three-wonders-arcade-1991': '奇迹三合一',
  'thrash-rally-arcade-1991': '疯狂拉力赛',
  'tv-animation-slam-dunk-super-slams-arcade-1995': '灌篮高手：超级扣篮',
  'ultraman-arcade-1991': '奥特曼',
  'wind-jammers-arcade-1994': '飞盘对决',
  'wow-new-fantasia-arcade-2002': '美女天蚕变',
  'x-men-vs-street-fighter-arcade-1996': 'X战警对街头霸王',
}

function translateCommonGameTitle(name: string) {
  const exact = COMMON_CHINESE_GAME_NAMES[name.toLocaleLowerCase()]
  if (exact) return exact

  const translated = name
    .replace(/the king of fighters/gi, '拳皇')
    .replace(/street fighter/gi, '街头霸王')
    .replace(/metal slug/gi, '合金弹头')
    .replace(/double dragon/gi, '双截龙')
    .replace(/final fight/gi, '快打旋风')
    .replace(/samurai shodown/gi, '侍魂')
    .replace(/fatal fury/gi, '饿狼传说')
    .replace(/art of fighting/gi, '龙虎之拳')
    .replace(/world heroes/gi, '世界英雄')
    .replace(/snow bros/gi, '雪人兄弟')
    .replace(/golden axe/gi, '战斧')
    .replace(/wonder boy/gi, '神奇男孩')
    .replace(/teenage mutant ninja turtles/gi, '忍者神龟')
    .replace(/alien vs\.? predator/gi, '异形大战铁血战士')
    .replace(/captain commando/gi, '名将')
    .replace(/knights of the round/gi, '圆桌骑士')
    .replace(/three wonders/gi, '奇迹三合一')
    .replace(/marvel super heroes/gi, '漫威超级英雄')
    .replace(/darkstalkers/gi, '恶魔战士')
    .replace(/dungeons?\s*&\s*dragons?/gi, '龙与地下城')
    .replace(/sonic the hedgehog/gi, '刺猬索尼克')
    .replace(/mortal kombat/gi, '真人快打')
    .replace(/pac-?man/gi, '吃豆人')
    .replace(/space invaders/gi, '太空侵略者')
    .replace(/donkey kong/gi, '大金刚')
    .replace(/dragon ball/gi, '龙珠')
    .replace(/power rangers/gi, '恐龙战队')
    .replace(/ninja baseball bat man/gi, '忍者棒球')
    .replace(/armored warriors/gi, '装甲战士')
    .replace(/warriors of fate/gi, '吞食天地2')
    .replace(/knights of valour/gi, '三国战纪')
    .replace(/oriental legend/gi, '西游释厄传')
    .replace(/super/gi, '超级')
    .replace(/champion(?:ship)?/gi, '冠军')
    .replace(/revenge/gi, '复仇')
    .replace(/warriors?/gi, '战士')
    .replace(/fighters?/gi, '格斗家')
    .replace(/battle/gi, '战斗')
    .replace(/world/gi, '世界')
    .replace(/legend/gi, '传说')
    .replace(/adventure/gi, '冒险')
    .replace(/attack/gi, '攻击')
    .replace(/return/gi, '归来')
    .replace(/final/gi, '最终')
    .replace(/new/gi, '新')
    .replace(/plus/gi, '加强版')
    .replace(/\s*[-:–—]\s*/g, '：')
    .replace(/\s+/g, ' ')
    .trim()

  return translated
}

const COMMON_CHINESE_GAME_NAMES: Readonly<Record<string, string>> = {
  '1941: counter attack': '1941：反击战',
  '1942': '1942',
  '1943: the battle of midway': '1943：中途岛海战',
  'aero fighters 2': '四国战机2',
  'alien storm': '异形风暴',
  'altered beast': '兽王记',
  'bad dudes vs. dragon ninja': '忍者龙剑传：恶人战士',
  'bubble bobble': '泡泡龙',
  'breakers': '破坏者格斗',
  'breakers revenge': '破坏者格斗：复仇',
  'cadillacs and dinosaurs': '恐龙快打',
  'carrier air wing': '美国海军',
  'caveman ninja': '战斗原始人',
  'chiki chiki boys': '双麟儿',
  'contra': '魂斗罗',
  'cyberbots: fullmetal madness': '装甲战士：全金属狂潮',
  'dyna gear': '动力装甲',
  'eight man': '八超人',
  'fightcade': '格斗对战平台',
  'galaga': '小蜜蜂',
  'ghosts n goblins': '魔界村',
  'ghouls n ghosts': '大魔界村',
  'giga wing': '千兆翼',
  'gunbird': '武装飞鸟',
  'hook': '铁钩船长',
  'king of dragons': '龙王战士',
  'last resort': '最后的度假村',
  'magician lord': '魔法领主',
  'magic sword': '魔法剑',
  'mercs': '战场之狼2',
  'mutation nation': '异形国度',
  'night slashers': '黑暗封印：暗夜杀手',
  'out zone': '异域战将',
  'pang': '超级气球',
  'prehistoric isle 2': '史前岛2',
  'pulstar': '脉冲之星',
  'punisher': '惩罚者',
  'raiden': '雷电',
  'rastan': '拉斯坦传奇',
  'sengoku': '战国传承',
  'sengoku 2': '战国传承2',
  'sengoku 3': '战国传承3',
  'shock troopers': '突击骑兵',
  'spin master': '飞天神童',
  'sunset riders': '落日骑士',
  'the punisher': '惩罚者',
  'top hunter: roddy & cathy': '顶级猎人：罗迪与凯茜',
  'tumblepop': '魔法气泡',
  'vendetta': '暴力克星',
  'willow': '威洛之旅',
}

export const HOME_HERO_CHINESE_NAMES: Readonly<Record<string, string>> = {
  'pow-prisoners-of-war-arcade-1988': '战俘',
  'zatchbell-electric-arena-gba-2005': '金色的卡修：电击竞技场',
  'vice-city-html5-2002': 'GTA：罪恶都市网页版',
  'the-king-of-fighters-97-arcade-1997': "拳皇97（The King of Fighters '97）",
  'contra-nes-1988': '魂斗罗',
  'murdoku-html5-2026': '死亡数独',
  'angry-birds-html5-2009': '愤怒的小鸟',
  'the-king-of-fighters-97-plus-arcade-1997': '拳皇97 大蛇版',
  'warriors-of-fate-ii-arcade-1992': '吞食天地2：赤壁之战',
  'taiko-no-tatsujin-taiko-web-html5-2011': '太鼓达人网页版',
  '3d-pinball-space-cadet-html5-1995': '3D弹球：太空军校生',
  'cadillacs-and-dinosaurs-arcade-1993': '恐龙快打',
  'subway-surf-web-html5-2012': '地铁跑酷网页版',
  'contra-gender-swap-nes-1988': '魂斗罗：性别互换版',
  'geometry-dash-advance-gba-2025': '几何冲刺 Advance',
  'wow-new-fantasia-arcade-2002': '美女天蚕变',
  'minecraft-offline-edition-html5-2011': '我的世界离线版',
  'super-mario-bros-nes-1985': '超级马里奥兄弟',
  'battle-city-nes-1985': '坦克大战',
  'tower-bloxx-flash': '摩天大楼',
  'governor-of-poker-flash-2005': '州长扑克',
  'super-mario-bros-4-the-undiscovered-zones-v2-nes-2017': '超级马里奥兄弟4：未知区域 V2',
  'the-king-of-fighters-98-arcade-1998': '拳皇98',
  'knights-of-valour-plus-arcade-1999': '三国战纪 Plus',
  'metal-slug-x-arcade-1999': '合金弹头X',
  'neighbours-from-hell-flash-2003': '整蛊邻居',
  'commandos-dos-1998': '盟军敢死队',
  'double-dragon-iii-the-sacred-stones-nes-1991': '双截龙3：圣石',
  'flowline-an-endless-mountain-html5': '流光线：无尽山脉',
  'contra-1987-arcade-1987': '魂斗罗1987',
  'super-mario-3d-world-64-n64-2017': '超级马里奥3D世界64',
  'coin-pusher-html5-2024': '推金币',
  'the-king-of-fighters-kyo-ps1-1998': '拳皇 京',
  'yie-ar-kung-fu-nes-1985': '功夫',
  'metal-slug-arcade-1996': '合金弹头',
  'the-king-of-fighters-99-arcade-1999': '拳皇99',
  'double-dragon-ii-the-revenge-arcade-1988': '双截龙2：复仇',
  'towerbloxx-mycity-java-2006': '都市摩天楼',
  'rhythm-heaven-nds-2008': '节奏天国',
  'bomberman-nes-1985': '炸弹人',
  'warriors-of-fate-ii-sanjiansheng-arcade-1993': '吞食天地2：三剑圣',
  'circus-charlie-nes-1984': '马戏团',
  'the-king-of-fighters-95-arcade-1995': '拳皇95',
  'grow-cube-flash-2005': '成长立方体',
  'oriental-legend-arcade-1997': '西游释厄传',
  'giga-wing-arcade-1999': '千兆翼',
  'richman-4-java-2005': '大富翁4',
  'sword-and-sandals-2-flash-2002': '剑与凉鞋2',
  'rhythm-tengoku-japan-gba-2006': '节奏天国',
  'metal-slug-3-arcade-2000': '合金弹头3',
  'age-of-empires-ii-dos-1999': '帝国时代2',
  'super-double-dragon-snes-1992': '超级双截龙',
  'vs-mahjong-otome-ryouran-arcade-1998': '乙女缭乱',
  'the-king-of-fighters-2002-arcade-2002': '拳皇2002',
  'golden-axe-arcade-1989': '战斧',
  'rhythm-tengoku-gold-nds-2008': '节奏天国黄金版',
  'home-sheep-home-flash-2010': '小羊回家',
  'raiden-arcade-1990': '雷电',
  'taiko-no-tatsujin-ds-touch-de-dokodon-nds-2005': '太鼓达人DS：触摸演奏',
  'initial-d-another-stage-gba-2003': '头文字D：另一个舞台',
  'snow-bros-arcade-1990': '雪人兄弟',
  'grand-theft-auto-chinatown-wars-nds-2009': '侠盗猎车手：血战唐人街',
  'initial-d-ps1-1998': '头文字D',
  'mario-in-the-multiverse-n64-2024': '马里奥多元宇宙',
  'asphalt-6-adrenaline-java-2010': '狂野飙车6：火线追击',
  'out-zone-arcade-1990': '异域战将',
  'doodle-shooter-html5-2020': '涂鸦射手',
  'snooker-ai-html5': 'AI斯诺克',
  'gals-panic-arcade': '美女拼图',
  'street-fight-iii-new-generation-arcade-1997': '街头霸王3：新生代',
  'championship-lode-runner-nes-1985': '冠军淘金者',
  'tomodachi-collection-nds-2009': '朋友收藏集',
  'dj-max-emotional-sense-html5-2012': 'DJMAX：情感节奏',
}

