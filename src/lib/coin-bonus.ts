export type BonusKind = 'free' | 'small-three' | 'small-four' | 'fruit-double' | 'all-bar' | 'five' | 'random-lights' | 'big-three' | 'big-four' | 'all-stars'
export type BonusPlan = { kind: BonusKind; title: string; targets: number[]; simultaneous: boolean; fruitDouble?: boolean; allStars?: boolean }
export const BONUS_NAMES: Record<BonusKind, string> = {
  free: '免费灯一轮', 'small-three': '小三元', 'small-four': '小四喜', 'fruit-double': '水果翻倍', 'all-bar': '全盘 BAR', five: '五分天下',
  'random-lights': '随机送灯', 'big-three': '大三元', 'big-four': '大四喜', 'all-stars': '满天星',
}
// Index 23 becomes the bell x2 in the local experimental panel.
export const BONUS_CELLS = [
  [1,10],[3,10],[7,50],[7,100],[7,25],[0,5],[2,10],[4,20],
  [4,3],[-1,0],[0,5],[1,2],[1,10],[3,10],[6,3],[6,20],
  [0,5],[2,2],[2,10],[5,20],[5,3],[-1,0],[0,5],[3,2],
] as const
const BASE = [5,10,10,10,20,20,20,100]
const FRUITS = new Set([0,1,2,4])
function pick<T>(items: readonly T[], random: () => number): T { return items[Math.min(items.length-1,Math.floor(random()*items.length))] }
function sample<T>(items: readonly T[], count: number, random: () => number): T[] {
  const pool = [...items], result: T[] = []
  while (result.length < count && pool.length) result.push(pool.splice(Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0])
  return result
}
export function chooseBonusKind(mode: 'lucky' | 'gold', hits: number, random = Math.random): BonusKind {
  const weighted: [BonusKind,number][] = mode === 'lucky' ? [['free',55],['small-three',30],['small-four',15]] : [['random-lights',75]]
  if (hits>=3) weighted.push([mode==='lucky'?'fruit-double':'big-three',12])
  if (hits>=5) weighted.push([mode==='lucky'?'all-bar':'big-four',5])
  if (hits>=8) weighted.push([mode==='lucky'?'five':'all-stars',2])
  let roll=random()*weighted.reduce((sum,item)=>sum+item[1],0)
  for (const [kind,weight] of weighted) { roll-=weight; if (roll<0) return kind }
  return weighted[weighted.length-1][0]
}
export function makeBonusPlan(kind: BonusKind, random = Math.random): BonusPlan {
  const symbols=BONUS_CELLS.flatMap(([option],index)=>option>=0?[index]:[])
  let targets: number[]=[]
  switch (kind) {
    case 'small-three': targets=[11,17,23]; break
    case 'small-four': targets=[5,10,16,22]; break
    case 'all-bar': targets=[4,3,2]; break
    case 'five': targets=sample([0,1,2,3,4,5,6,7],5,random).map(option=>pick(symbols.filter(index=>BONUS_CELLS[index][0]===option),random)); break
    case 'big-three': targets=[15,7,19]; break
    case 'big-four': targets=[15,7,19,3]; break
    case 'all-stars': targets=Array.from({length:24},(_,i)=>i); break
    case 'random-lights': targets=Array.from({length:random()<0.5?2:3},()=>pick(symbols,random)); break
    default: targets=[pick(symbols,random)]
  }
  return {kind,title:BONUS_NAMES[kind],targets,simultaneous:['small-three','five','big-three','big-four','all-stars'].includes(kind),fruitDouble:kind==='fruit-double',allStars:kind==='all-stars'}
}
export function bonusPayout(plan: BonusPlan, bets: readonly number[]): number {
  if (plan.allStars) return BASE.reduce((sum,multiplier,option)=>sum+(bets[option]??0)*multiplier,0)
  return plan.targets.reduce((sum,index)=>{
    const [option,multiplier]=BONUS_CELLS[index]
    return sum+(option<0?0:(bets[option]??0)*multiplier*(plan.fruitDouble&&FRUITS.has(option)?2:1))
  },0)
}
