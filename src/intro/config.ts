export type TileRevealMode = 'snake' | 'shuffle'

export const defaultTileRevealMode: TileRevealMode = 'snake'
export const defaultRevealSeed = 'wordwyrm-intro-v1'

// Framer Motion durations are in seconds; scramble intervals use milliseconds.
// Decode durations cover the whole stage. Route dimensions are grouped below.
export const introTimings = {
  enemyDecode: 2.5,
  stagePause: 0.08,
  boardTravel: 0.32,
  tileDecode: 3.2,
  appear: 0.1,
  screenExit: 0.2,
  titlePass: 0.6,
  dockSettle: 0.1,
  travelWiggle: 0.65,
  idleWiggle: 2.6,
  tongueFlick: 3.8,
  reducedStage: 0.04,
  enemyScrambleMs: 70,
  tileScrambleMs: 65,
  lockIn: 0.45,
  enemyLockIn: 0.18,
  definitionFade: 0.35,

  edgeGapPx: 8,
  enemyWaveHeightRatio: 0.3,
  enemyWaveMaxPx: 10,
  enemyWaveCycles: 2,
  offscreenPaddingPx: 32,
  titleWavePx: 2,
  tileLane: 0.5,
  tileWaveHeightRatio: 0.12,
  tileWaveMaxPx: 8,
  tileWaveCycles: 1,
} as const
