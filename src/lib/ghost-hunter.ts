export type Cell = [number, number]
export type Placement = { x: number; y: number; rotation: number }
export const LEVELS = [
  { id: 31, image: '/ghost-hunter/level-31.webp', ghosts: [[0, 0], [1, 0], [2, 1], [0, 2], [2, 2], [3, 2]] },
  { id: 3, image: '/ghost-hunter/level-3.webp', ghosts: [[0, 0], [1, 0], [0, 2], [1, 2], [1, 3], [3, 3]] },
  { id: 4, image: '/ghost-hunter/level-4.webp', ghosts: [[0, 0], [2, 0], [3, 0], [0, 2], [1, 2], [2, 3]] },
  { id: 26, image: '/ghost-hunter/level-26.webp', ghosts: [[1, 0], [3, 0], [0, 1], [1, 1], [0, 2], [3, 3]] },
  { id: 53, image: '/ghost-hunter/level-53.webp', ghosts: [[0, 0], [2, 0], [1, 1], [2, 1], [2, 2], [3, 2]] },
  { id: 54, image: '/ghost-hunter/level-54.webp', ghosts: [[1, 0], [3, 0], [0, 1], [3, 1], [0, 2], [2, 2]] },
  { id: 57, image: '/ghost-hunter/level-57.webp', ghosts: [[0, 0], [1, 0], [2, 1], [1, 2], [0, 3], [3, 3]] },
  { id: 58, image: '/ghost-hunter/level-58.webp', ghosts: [[0, 0], [1, 0], [1, 1], [3, 1], [0, 2], [2, 2]] },
  { id: 59, image: '/ghost-hunter/level-59.webp', ghosts: [[1, 0], [0, 1], [1, 2], [2, 2], [3, 2], [0, 3]] },
  { id: 60, image: '/ghost-hunter/level-60.webp', ghosts: [[2, 0], [0, 1], [1, 1], [2, 2], [1, 3], [3, 3]] },
] as const satisfies ReadonlyArray<{ id: number; image: string; ghosts: ReadonlyArray<Cell> }>

export const GHOSTS: ReadonlyArray<Cell> = LEVELS[0].ghosts
export const MODULES: { cells: Cell[]; lights: Cell[]; width: number; height: number }[] = [
  { cells: [[0, 0], [1, 0], [0, 1]], lights: [[0, 0]], width: 2, height: 2 },
  { cells: [[1, 0], [0, 1], [1, 1]], lights: [[1, 0]], width: 2, height: 2 },
  { cells: [[0, 0], [0, 1], [1, 1]], lights: [[0, 0]], width: 2, height: 2 },
  { cells: [[0, 0], [1, 0], [1, 1]], lights: [[0, 0], [1, 1]], width: 2, height: 2 },
  { cells: [[0, 0], [0, 1]], lights: [[0, 0]], width: 1, height: 2 },
  { cells: [[0, 0], [1, 0]], lights: [], width: 2, height: 1 },
]

export function geometry(id: number, rotation: number) {
  const module = MODULES[id]
  let { width, height } = module
  let cells = module.cells
  let lights = module.lights
  for (let turn = 0; turn < rotation % 4; turn++) {
    const rotate = ([x, y]: Cell): Cell => [height - 1 - y, x]
    cells = cells.map(rotate)
    lights = lights.map(rotate)
    ;[width, height] = [height, width]
  }
  return { cells, lights, width, height }
}

export function canPlace(id: number, candidate: Placement, placed: (Placement | null)[]) {
  const occupied = new Set(placed.flatMap((p, other) => p && other !== id
    ? geometry(other, p.rotation).cells.map(([x, y]) => `${x + p.x},${y + p.y}`) : []))
  return geometry(id, candidate.rotation).cells.every(([x, y]) => {
    x += candidate.x
    y += candidate.y
    return x >= 0 && y >= 0 && x < 4 && y < 4 && !occupied.has(`${x},${y}`)
  })
}

export function litGhosts(
  placed: (Placement | null)[],
  ghosts: ReadonlyArray<Cell> = GHOSTS,
) {
  const lights = new Set(placed.flatMap((p, id) => p
    ? geometry(id, p.rotation).lights.map(([x, y]) => `${x + p.x},${y + p.y}`) : []))
  return ghosts.filter(([x, y]) => lights.has(`${x},${y}`))
}

export function isLevelComplete(
  placed: (Placement | null)[],
  ghosts: ReadonlyArray<Cell>,
) {
  return placed.every(Boolean) && litGhosts(placed, ghosts).length === ghosts.length
}
