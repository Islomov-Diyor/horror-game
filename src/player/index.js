export const P = {
  x: 0, y: 1.7, z: 0,
  vx: 0, vz: 0,
  yaw: 0, pitch: 0,
  keys: {},
  hasKey: false,
  stamina: 1.0,
  battery: 1.0,
  flashOn: false,
  hiding: false,
  hideSpot: null,
  noteReading: false,
  noteCurrent: null,
  notesFoundThisLevel: 0,
  notesTotalThisLevel: 0,
  noiseLevel: 0,
  bobPhase: 0,
};

export function raiseNoise(amount) {
  P.noiseLevel = Math.max(P.noiseLevel, amount);
}
