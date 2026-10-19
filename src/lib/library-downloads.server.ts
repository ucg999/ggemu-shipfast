export type DownloadPlatform = 'psp' | 'switch'

const DOWNLOAD_URLS: Record<DownloadPlatform, Record<string, string>> = {
  psp: {
    'tales-of-phantasia-narikiri-dungeon-x': 'https://pan.baidu.com/s/1-wXLBASytlJmlRPI62r3xw?pwd=9999',
    'ridge-racer': 'https://pan.baidu.com/s/1pSdu1XeGRhPVNgMIrupP4w?pwd=9999',
    'monster-hunter-portable': 'https://pan.baidu.com/s/1ua3xTM1tSvb7Y7nKiMfY8w?pwd=9999',
    'monster-hunter-portable-2nd': 'https://pan.baidu.com/s/1tnEWUPGqXOV-Bg4HHl5D9A?pwd=9999',
    'monster-hunter-portable-2nd-g': 'https://pan.baidu.com/s/1mR0e3RvUKPAJYBBJEQ0M1w?pwd=9999',
    'djmax-portable-2': 'https://pan.baidu.com/s/1VGvubJ0zMFCcZJSlgHfGcA?pwd=9999',
    'djmax-clazziquai-edition': 'https://pan.baidu.com/s/1si3JooRtb1tikqzgfe8Ndw?pwd=9999',
    'nba-ballers-rebound': 'https://pan.baidu.com/s/15sVU4JQRgHx-g8lPhJPPIw?pwd=9999',
    'valkyrie-profile-lenneth': 'https://pan.baidu.com/s/1I0QQM_rWlUDe3TChJaDTxQ?pwd=9999',
    'motorstorm-arctic-edge': 'https://pan.baidu.com/s/14xUlddp5nA0NyT_FsgOUmQ?pwd=9999',
    'flatout-head-on': 'https://pan.baidu.com/s/1WhoOJ75t3HWI4wcC90tqBA?pwd=9999',
    'split-second-velocity': 'https://pan.baidu.com/s/1A3iREptHOcflypl4udZ26w?pwd=9999',
    'ridge-racers-2': 'https://pan.baidu.com/s/1bti7eCSwy638NayQ2_-L9g?pwd=9999',
    'moto-gp': 'https://pan.baidu.com/s/1VyIkxvIP7INThktQ_eYvPA?pwd=9999',
  },
  switch: {
    'river-city-saga-journey-to-the-west': 'https://pan.baidu.com/s/1EDBQghZBMEN67Vkj6vNxbw?pwd=rnj5',
    'dragon-quest-vii-reimagined': 'https://pan.baidu.com/s/1DKiMC1R7KvlUSb6T3tjhag?pwd=ggeb',
    'nin-nin-days-2': 'https://pan.baidu.com/s/1BClXWZvU3q_8tizhJvHBxg?pwd=yqrt',
    'hello-kitty-island-adventure': 'https://pan.baidu.com/s/1W0au-Wxb3Kra8Al7zvNaWA?pwd=6jwh',
    'tales-of-eternia-remastered': 'https://pan.baidu.com/s/1Zzuk9rMkgghr1lnPgD-4Bg?pwd=sj9k',
    'warriors-abyss': 'https://pan.baidu.com/s/1tLpvWSG03B2NLwvrWM1zvQ?pwd=9999',
    'dave-the-diver': 'https://pan.baidu.com/s/1Qkx-nyzqj3nqsnnsOPm1yA?pwd=9999',
    'tmnt-splintered-fate': 'https://pan.baidu.com/s/1tKOOjAOzOD8cLFDq3T9wvg?pwd=i5jv',
    'gta5-switch-port': 'https://pan.baidu.com/s/1wBKVjA0eQuHkNjWgSoG2Mg?pwd=r8vb',
    'ace-angler': 'https://pan.baidu.com/s/1sQaQ3JBwTjfaPTh-q5W2PQ?pwd=pwqz',
    'octopath-traveler-2': 'https://pan.baidu.com/s/19XCSl8HDjQzXsV9hdySsTQ?pwd=ajym',
    'digimon-story-time-stranger': 'https://pan.baidu.com/s/1k2wQ7hnXMJm3796iGte7-g?pwd=4fib',
    'new-sword-heroes-trilogy': 'https://pan.baidu.com/s/1jLbH6ByHPQqJkSszJXN1Hw?pwd=dy1s',
    'ace-angler-fishing-spirits': 'https://pan.baidu.com/s/1DlQ_AMSRYJ2b0GJhQxuX0w?pwd=87d3',
  },
}

export function getLibraryDownloadUrl(platform: DownloadPlatform, gameId: string) {
  return DOWNLOAD_URLS[platform][gameId] ?? ''
}
