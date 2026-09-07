import type { SwitchLibraryGame } from './switch-library'

export const PSP_LIBRARY_GAMES: (SwitchLibraryGame & { boxCover?: string; cardLanguage?: string })[] = [{
  id: 'tales-of-phantasia-narikiri-dungeon-x',
  title: '幻想传说：换装迷宫X',
  cover: '/psp-library/narikiri-dungeon-x/main.webp',
  boxCover: '/psp-library/narikiri-dungeon-x/box.webp',
  genre: '角色扮演、动作',
  publisher: 'Bandai Namco Games',
  releaseDate: '2010-08-05',
  requiredSystem: '待确认',
  language: '日、中',
  cardLanguage: '中文',
  downloadUrl: 'https://pan.baidu.com/s/1-wXLBASytlJmlRPI62r3xw?pwd=9999',
  description: '跟随双子主角展开幻想冒险，通过更换服装体验不同职业与战斗方式。搭配伙伴探索迷宫，在即时战斗中组合技能，体验《幻想传说》世界的故事。',
  screenshots: Array.from({ length: 8 }, (_, index) => `/psp-library/narikiri-dungeon-x/${String(index + 2).padStart(2, '0')}.webp`),
}]
