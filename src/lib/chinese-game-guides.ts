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
const nesControls =
  '方向键控制移动，A/B 对应跳跃、攻击或功能键，Start 用于开始与暂停，Select 用于选择模式；网页端键位以模拟器设置为准，可自行重新绑定。'
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

function nesGuide(seed: GuideSeed): ChineseGameGuide {
  return {
    controls: nesControls,
    moves: seed.moves ?? 'FC 游戏通常没有复杂出招表，主要通过方向键与 A/B 组合完成跳跃、攻击、冲刺或使用道具。',
    multiplayer: seed.multiplayer ?? '若原版支持双人，可在标题画面选择 2 PLAYERS，并分别设置 1P、2P 键位；部分作品为轮流游玩而非同时操作。',
    save: seed.save ?? '多数 FC 原版不提供流程存档，可使用网页模拟器的即时存档保存进度；更换浏览器或清理数据前请先确认存档。',
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
  'contra-nes-1988': nesGuide({
    aliases: ['Contra', '魂斗罗美版', '魂斗罗FC版'],
    gameplay: '控制突击队员一路向右推进，使用步枪与散弹、激光等强化武器清敌。背熟敌人刷新点、保留散弹枪，并在伪3D基地关卡优先破坏核心。',
    moves: '方向键移动或卧倒，A 跳跃，B 射击；跳跃时可配合方向调整落点。经典 30 人秘籍需在标题画面输入上上下下左右左右BA后开始，不同版本可能无效。',
    multiplayer: '支持双人同时合作。标题画面选择双人模式，为 1P、2P 分别设置方向、射击、跳跃和开始键；双方共享画面推进范围。',
    name: '魂斗罗',
    summary: '科乐美经典 FC 横版射击游戏，以高难度关卡、武器强化和双人同屏合作闻名。',
  }),
  'vice-city-html5-2002': html5Guide({
    aliases: ['Vice City', 'GTA Vice City', '罪恶都市网页版'],
    controls: '电脑端通常用 WASD 移动，鼠标调整视角，空格执行跳跃或手刹，E/F 进入载具；手机端使用屏幕虚拟摇杆和动作按钮，具体以页面提示为准。',
    gameplay: '在开放城市中驾驶车辆、探索地图并完成任务。接任务前先熟悉小地图与车辆操控，追逐时控制速度比持续加速更容易过弯。',
    moves: '本作没有格斗出招表；常用技巧是步行时利用掩体和移动射击，驾驶时提前刹车、用手刹修正急弯。网页版本内容和原作可能不同。',
    multiplayer: '当前网页版本以单人体验为主，不支持本地双人同屏。',
    name: '侠盗猎车手：罪恶都市',
    save: '网页版本通常把进度保存在当前浏览器；完成任务后确认保存提示，清理网站数据或更换设备可能丢失记录。',
    summary: '以霓虹都市、自由探索、驾驶与任务挑战为核心的开放世界动作游戏网页版本。',
  }),
  'warriors-of-fate-ii-arcade-1992': arcadeGuide({
    aliases: ['Warriors of Fate II', 'Tenchi wo Kurau II', '三国志II', '吞食天地2'],
    gameplay: '选择赵云、关羽、张飞、黄忠或魏延横向清版，利用普通连击、投技、冲刺与骑马推进。多人时分散站位，避免所有人同时被首领范围攻击命中。',
    moves: '攻击连打形成连击；前前可冲刺，冲刺中攻击可发动突进技，跳跃加攻击用于压制或脱离包围；攻击与跳跃同按可放保险技但会消耗体力。角色招式细节略有不同。',
    multiplayer: '街机版支持多人合作，当前模拟版本通常支持两人。分别配置 1P、2P 键位，第二位玩家投币后按开始键加入。',
    name: '吞食天地2：赤壁之战',
    summary: '卡普空三国题材清版动作街机，也常被称为《三国志II》，拥有五名武将、骑马战斗与多人合作。',
  }),
  '3d-pinball-space-cadet-html5-1995': html5Guide({
    aliases: ['3D Pinball: Space Cadet', '太空军校生', 'Windows 3D弹球'],
    controls: '使用左右方向键或页面指定键控制两侧挡板，空格键蓄力发射弹珠；可用轻推球台键改变弹珠轨迹，但连续使用会触发倾斜锁定。',
    gameplay: '保持弹珠不落出底部，通过撞击目标、点亮任务灯和完成航天任务累积分数。优先观察弹珠落点，挡板不要过早挥动。',
    moves: '没有传统出招；关键技巧是挡板接球、延迟击球和轻推球台。把弹珠暂时停在抬起的挡板上，可以更稳定地瞄准上方目标。',
    multiplayer: '以单人轮次挑战为主，可由多位玩家在同一设备上轮流比较分数，不支持同时操作。',
    name: '3D弹球：太空军校生',
    save: '最高分通常保存在当前浏览器，关闭无痕窗口或清理网站数据后可能消失；单局中途一般不提供正式存档。',
    summary: '经典 Windows 太空主题弹球游戏，通过完成任务、升级军衔和刷新高分持续挑战。',
  }),
  'taiko-no-tatsujin-taiko-web-html5-2011': html5Guide({
    aliases: ['Taiko no Tatsujin', 'Taiko Web', '太鼓网页模拟器'],
    controls: '红色音符敲鼓面，蓝色音符敲鼓边；电脑端按键可在设置中确认，手机端直接轻触对应鼓面区域。大音符可同时按下左右两侧。',
    gameplay: '跟随节奏在音符到达判定圈时敲击，连续准确命中可维持连段并提高得分。初次游玩先选简单难度，校准音画延迟后再挑战高难度。',
    moves: '本作没有传统出招；黄条连打需要快速交替敲击，气球音符要在限定时间内完成指定次数。稳定节奏比盲目追求手速更重要。',
    multiplayer: '是否支持双人取决于当前网页版本和谱面页面；出现 2P 入口时分别设置两套按键，否则为单人模式。',
    name: '太鼓达人网页版',
    save: '歌曲设置与成绩通常保存在当前浏览器；清理缓存或更换设备可能重置记录。',
    summary: '以红蓝音符和太鼓敲击为核心的节奏游戏网页版本，适合从简单谱面逐步挑战连段与高分。',
  }),
  'sanguosha-html5-2011': html5Guide({
    aliases: ['三国杀网页版', 'Sanguosha', '三国杀 Online'],
    controls: '使用鼠标或触屏选择卡牌、目标和技能，再点击确认；长按或悬停卡牌可查看说明，轮到自己时注意阶段提示与倒计时。',
    gameplay: '根据主公、忠臣、反贼、内奸等身份目标行动，合理使用杀、闪、桃和锦囊牌。不要过早暴露身份，优先观察出牌与救援关系。',
    moves: '本作为卡牌策略游戏，没有方向出招；进阶操作是把握出牌阶段顺序、响应窗口、距离与装备效果，并根据武将技能组合保留关键牌。',
    multiplayer: '核心玩法为多人轮流对战；当前网页版本是否支持联网房间以开始界面为准，本地同屏通常不支持多人同时操作。',
    name: '三国杀',
    save: '单局通常需要一次完成，账号版战绩由服务器保存；离线网页版本可能只在当前浏览器记录设置。',
    summary: '以三国人物、身份推理和卡牌攻防为核心的多人策略游戏。',
  }),
  'cadillacs-and-dinosaurs-arcade-1993': arcadeGuide({
    aliases: ['Cadillacs and Dinosaurs', '恐龙新世纪', '黄帽'],
    gameplay: '选择四名角色之一横向清版，利用连击、投技、冲刺、枪械与场景武器处理敌群。及时上下走位，把敌人集中在同一侧再输出。',
    moves: '攻击连打形成组合技；前前冲刺后按攻击可突进，跳跃加攻击可飞踢；攻击与跳跃同按发动保险技并消耗体力。部分角色可用下上加攻击发动特殊动作。',
    multiplayer: '支持双人同时合作。分别配置两套方向、攻击、跳跃、投币和开始键，第二位玩家投币后可随时加入。',
    name: '恐龙快打',
    summary: '卡普空经典清版动作街机，正式名称为《凯迪拉克与恐龙》，国内玩家常称《恐龙快打》。',
  }),
  'subway-surf-web-html5-2012': html5Guide({
    aliases: ['Subway Surfers', '地铁跑酷网页版'],
    controls: '电脑端使用左右键换道、上键跳跃、下键翻滚；手机端向对应方向滑动。获得滑板等道具后按页面提示启用。',
    gameplay: '在三条轨道间躲避列车和障碍，收集金币、钥匙与强化道具。视线保持在角色前方，提前一至两个障碍规划换道。',
    moves: '没有传统出招；跳跃后快速下滑可提前落地，翻滚可穿过低障碍。磁铁、喷射背包和倍数道具应尽量连续利用。',
    multiplayer: '当前网页版本为单人跑酷，可在同一设备轮流挑战最高分，不支持双人同时游玩。',
    name: '地铁跑酷',
    save: '金币、角色和最高分通常保存在当前浏览器；无痕模式、清理网站数据或更换设备可能导致进度丢失。',
    summary: '经典三轨道无尽跑酷游戏，通过换道、跳跃和翻滚躲避障碍并刷新距离与分数。',
  }),
  'geometry-dash-advance-gba-2025': gbaGuide({
    aliases: ['Geometry Dash Advance', '几何冲刺GBA版'],
    controls: '主要使用 A 键跳跃或控制飞行，方向键和 Start 用于菜单；按住动作键可连续跳跃，实际键位可在模拟器设置中调整。',
    gameplay: '让方块跟随音乐自动前进，准确跳过尖刺与平台。先记住障碍节奏和传送门变化，再追求一次无失误通关。',
    moves: '本作没有格斗出招；短按适合单次小跳，长按用于连续跳跃或维持飞行高度。进入不同形态后操作规律会变化。',
    multiplayer: '以单人节奏闯关为主，不支持 GBA 同屏双人。',
    name: '几何冲刺：进阶版',
    summary: '以《几何冲刺》为灵感制作的 GBA 节奏平台游戏，强调音乐同步、记忆关卡与精准跳跃。',
  }),
  'tower-bloxx-flash': html5Guide({
    aliases: ['Tower Bloxx', '都市摩天楼', '高楼爆破'],
    controls: '鼠标点击、触屏轻触或空格键放下正在摆动的楼层；不同模式可通过菜单选择城市建设或快速挑战。',
    gameplay: '观察吊钩摆动，在楼层与下方建筑中心重合时放下。连续精准堆叠会提升人口与分数，偏移过大则会让高层越来越难对齐。',
    moves: '没有传统出招；可利用固定摆动周期预判落点，不要只盯吊钩，参考下方楼层中心线更容易实现完美落位。',
    multiplayer: '当前 Flash 网页版本以单人挑战为主，可轮流比较楼层和分数。',
    name: '都市摩天楼',
    save: '城市进度和最高分可能保存在当前浏览器；若版本不支持持久存储，关闭页面后需要重新开始。',
    summary: '经典休闲堆楼游戏，在摆动中准确投放楼层，建设城市并挑战更高楼层。',
  }),
  'super-mario-bros-4-the-undiscovered-zones-v2-nes-2017': nesGuide({
    aliases: ['Super Mario Bros. 4: The Undiscovered Zones V2', '超级马里奥兄弟4改版'],
    gameplay: '控制马里奥在全新关卡中跳跃、踩敌和寻找隐藏砖块。该版本难度高于原作，进入陌生区域时先观察平台与敌人节奏。',
    moves: '方向键移动，下键蹲下；A 跳跃，按住 B 可加速奔跑，获得火焰花后 B 发射火球。奔跑加跳跃可以跨越更远距离。',
    multiplayer: '若标题画面提供双人选项，则由两名玩家轮流操作角色，不是同屏同时闯关。',
    name: '超级马里奥兄弟4：未知区域 V2',
    summary: '基于 FC《超级马里奥兄弟》制作的非官方关卡改版，加入新的地图布局、隐藏路线和高难度挑战。',
  }),
  'battle-city-nes-1985': nesGuide({
    aliases: ['Battle City', '坦克1990前身', '打坦克'],
    gameplay: '驾驶坦克保护基地鹰标并消灭全部敌军，利用砖墙、钢墙、树林和水域规划路线。优先清理靠近基地的敌人，再争取强化道具。',
    moves: '方向键移动，A 或 B 发射炮弹；拾取星星提升射速与威力，手雷可清屏，铲子会临时强化基地。不要在基地附近朝错误方向开火。',
    multiplayer: '支持双人同时合作。选择双人模式并分别设置 1P、2P 方向与射击键；双方炮弹可能破坏基地周围砖墙，需要分工防守。',
    name: '坦克大战',
    summary: '南梦宫经典 FC 坦克射击游戏，围绕基地防守、地形利用和双人合作展开。',
  }),
  'murdoku-html5-2026': html5Guide({
    aliases: ['Murdoku', 'Murdoku 数字谜题'],
    controls: '使用鼠标或触屏选择格子，再从数字面板输入答案；可使用笔记、撤销或提示功能，具体按钮以当前页面为准。',
    gameplay: '根据行、列和区域限制逐步排除候选数字。先处理候选最少的格子，不确定时用笔记记录，避免连续猜测造成大范围错误。',
    moves: '本作为逻辑谜题，没有出招；常用技巧包括唯一候选、隐藏唯一数、数对排除和交叉定位。',
    multiplayer: '以单人解谜为主，可在同一设备轮流挑战完成时间，不支持实时双人。',
    name: 'Murdoku 数字谜题',
    save: '未完成盘面通常保存在当前浏览器；关闭前确认自动保存状态，清理网站数据可能删除进度。',
    summary: '一款以数字排除和逻辑推理为核心的网页益智游戏，目标是在有限条件下完成整个盘面。',
  }),
  'angry-birds-html5-2009': html5Guide({
    aliases: ['Angry Birds', '愤怒的小鸟网页版'],
    controls: '用鼠标或手指拖动弹弓调整角度与力度，松开后发射；部分小鸟飞行中再次点击可触发分裂、加速或爆炸能力。',
    gameplay: '观察建筑支点、材料强度与猪的位置，用有限小鸟摧毁目标。优先攻击底部支撑结构，争取用连锁坍塌提高分数。',
    moves: '红鸟无额外能力；蓝鸟可分裂，黄鸟可加速，黑鸟可爆炸，白鸟可投蛋，不同网页版本的鸟种可能不同。能力触发时机比频繁点击更重要。',
    multiplayer: '当前网页版本为单人关卡挑战，可轮流比较星级与得分，不支持双人同时操作。',
    name: '愤怒的小鸟',
    save: '关卡星级通常自动保存在当前浏览器；无痕模式、清理缓存或更换设备后可能需要重新解锁。',
    summary: '经典物理弹射益智游戏，通过不同小鸟的能力破坏建筑并消灭小猪。',
  }),
  'double-dragon-iii-the-sacred-stones-nes-1991': nesGuide({
    aliases: ['Double Dragon III: The Sacred Stones', '双截龙III', '双截龙3FC版'],
    gameplay: '操控比利与吉米横向闯关，合理运用拳脚、跳跃攻击与武器。敌人包围时先向上下移动拉开距离，不要站在同一水平线硬拼。',
    moves: 'A、B 分别负责拳脚，同时按下可跳跃；跳跃中按攻击可飞踢，靠近敌人可抓取并追加攻击。双人靠近时还能尝试合作旋转类动作，具体输入受版本影响。',
    multiplayer: '支持双人合作模式。分别配置两套方向和 A/B 键，在标题画面选择双人；部分模式可能允许误伤，出招时注意队友位置。',
    name: '双截龙3：圣石',
    summary: '经典 FC 清版动作游戏，讲述双截龙兄弟寻找圣石的旅程，支持双人合作与多角色战斗。',
  }),
  'minecraft-offline-edition-html5-2011': html5Guide({
    aliases: ['Minecraft Offline Edition', '我的世界离线版', 'Minecraft网页版'],
    controls: '电脑端通常用 WASD 移动、空格跳跃、鼠标观察，左键破坏、右键放置；数字键切换快捷栏。手机端使用虚拟摇杆和触控按钮。',
    gameplay: '采集木材制作基础工具，寻找食物与矿物，并在天黑前建造安全住所。探索洞穴时携带火把、食物和备用工具，避免迷路。',
    moves: '没有传统出招；常用操作包括疾跑跳跃、潜行防止坠落、快速切换工具和搭方块脱离危险。具体功能取决于当前网页版本。',
    multiplayer: '离线网页版本通常为单人模式，不支持服务器联机或本地双人；若页面提供多人入口，则以其房间说明为准。',
    name: '我的世界：离线版',
    save: '世界存档通常保存在当前浏览器本地。清理网站数据、使用无痕模式或更换设备可能导致世界丢失，重要地图请使用版本提供的导出功能备份。',
    summary: '以采集、合成、建造和生存探索为核心的沙盒游戏离线网页版本。',
  }),
  'contra-1987-arcade-1987': arcadeGuide({
    aliases: ['Contra Arcade', '魂斗罗街机版', '魂斗罗初代街机'],
    gameplay: '控制突击队员在横版与纵深基地关卡中射击推进，拾取强化武器并躲避密集火力。保持移动、熟悉敌人出现位置是减少损命的关键。',
    moves: '摇杆移动与卧倒，攻击键射击，跳跃键翻滚跳；空中可调整方向射击。基地关卡用方向控制瞄准和移动，优先破坏前方核心。',
    multiplayer: '支持双人同时合作。分别配置 1P、2P 的方向、射击、跳跃、投币和开始键，第二位玩家投币后加入。',
    name: '魂斗罗：街机版',
    summary: '科乐美 1987 年推出的《魂斗罗》初代街机版，融合横版射击、纵深基地战和双人合作。',
  }),
  'ra2web-html5-2026': html5Guide({
    aliases: ['RA2Web', 'Red Alert 2 Web', '红警2网页版'],
    controls: '鼠标左键选择单位和执行命令，拖框可多选，右键或页面指定方式移动与攻击；数字键可编队，键盘快捷键以当前版本设置为准。',
    gameplay: '采集矿石建立经济，展开基地并生产步兵、载具和空军。侦察对手后再决定科技路线，避免把全部资金投入单一兵种。',
    moves: '本作为即时战略游戏，没有格斗出招；常用技巧包括单位编队、集火高价值目标、边移动边攻击、分兵骚扰与及时维修基地。',
    multiplayer: '是否支持联网对战取决于当前 RA2Web 版本；有房间或联机入口时按页面说明加入，否则为单人遭遇战或任务模式。',
    name: '红色警戒2网页版',
    save: '任务或设置的保存方式取决于网页版本。开始长局前确认是否提供存档或导出功能，清理浏览器数据可能删除本地记录。',
    summary: '以基地建设、资源采集和多兵种即时作战为核心的《红色警戒2》网页版本。',
  }),
  'dyna-gear-arcade-1993': arcadeGuide({
    aliases: ['Dyna Gear'],
    gameplay: '选择战士后横向推进，在原始世界中击败兽人、恐龙和大型首领；注意利用上下走位把敌人引到同一侧。',
    name: '恐龙时代',
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
