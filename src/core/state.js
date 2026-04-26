export const state = {
  game: false,
  paused: false,
  currentLevel: 0,
  totalTime: 0,
  jsTriggered: false,
  startTime: 0,
  levelStartTime: 0,
  // user settings
  userBrightness: 1.0,
  userVolume: 0.7,
  mouseSens: 1.0,
  flashlightIntensity: 1.4,
  fxEnabled: true,
  // flicker timing
  flashTimer: 0,
  nextFlicker: 9,
  flickering: false,
  flickerEnd: 0,
  // music
  heartTimer: 0,
};
