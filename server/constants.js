// Server and Game Constants for Belt Panic!

export const ARENA = {
  HALF_SIZE: 20, // 40x40 arena (-20 to 20)
  WALL_HEIGHT: 7,
  PEDESTAL: {
    x: 0,
    y: 0.5,
    z: 0,
    radius: 3.2,
    height: 1.0,
    pickupRadius: 3.8,
  },
  // Obstacles for collision detection and hiding spots
  OBSTACLES: [
    // Pillars
    { type: 'cylinder', x: -8, z: -8, radius: 1.1, height: 7, name: 'Pillar NW' },
    { type: 'cylinder', x: 8, z: -8, radius: 1.1, height: 7, name: 'Pillar NE' },
    { type: 'cylinder', x: -8, z: 8, radius: 1.1, height: 7, name: 'Pillar SW' },
    { type: 'cylinder', x: 8, z: 8, radius: 1.1, height: 7, name: 'Pillar SE' },

    // Lockers
    { type: 'box', x: -16, z: -10, sx: 2.0, sz: 6.0, sy: 4.5, name: 'Lockers West' },
    { type: 'box', x: 16, z: 10, sx: 2.0, sz: 6.0, sy: 4.5, name: 'Lockers East' },

    // Shelves / Cupboards
    { type: 'box', x: -16, z: 10, sx: 2.2, sz: 5.0, sy: 4.0, name: 'Shelf SW' },
    { type: 'box', x: 16, z: -10, sx: 2.2, sz: 5.0, sy: 4.0, name: 'Shelf NE' },

    // Crates
    { type: 'box', x: -11, z: 0, sx: 2.6, sz: 2.6, sy: 2.6, name: 'Crate Stack West' },
    { type: 'box', x: 11, z: 0, sx: 2.6, sz: 2.6, sy: 2.6, name: 'Crate Stack East' },
    { type: 'box', x: 0, z: -12, sx: 3.0, sz: 2.0, sy: 2.2, name: 'Crate North' },
    { type: 'box', x: 0, z: 12, sx: 3.0, sz: 2.0, sy: 2.2, name: 'Crate South' },

    // Tables (players can hide behind/under)
    { type: 'box', x: -6, z: -14, sx: 4.5, sz: 2.2, sy: 1.8, name: 'Table NW' },
    { type: 'box', x: 6, z: 14, sx: 4.5, sz: 2.2, sy: 1.8, name: 'Table SE' },

    // Corner decorative potted plants
    { type: 'cylinder', x: -17, z: -17, radius: 1.3, height: 3.5, name: 'Plant NW' },
    { type: 'cylinder', x: 17, z: -17, radius: 1.3, height: 3.5, name: 'Plant NE' },
    { type: 'cylinder', x: -17, z: 17, radius: 1.3, height: 3.5, name: 'Plant SW' },
    { type: 'cylinder', x: 17, z: 17, radius: 1.3, height: 3.5, name: 'Plant SE' },
  ],
};

export const GAME_RULES = {
  TICK_RATE: 30, // 30 ticks per second
  TICK_INTERVAL_MS: 1000 / 30,
  
  MATCH_DURATION_SEC: 180, // 3 minute match
  COUNTDOWN_DURATION_SEC: 4, // 3, 2, 1, GO!
  
  LIGHTS_ON_DURATION_SEC: 12,
  BLACKOUT_DURATION_SEC: 10,
  LIGHTS_WARN_DURATION_SEC: 2.0, // Last 2 seconds of blackout
  
  PLAYER_SPEED: 9.5,
  HUNTER_SPEED: 10.6,
  PLAYER_RADIUS: 0.75,
  
  SWING_COOLDOWN_SEC: 0.85,
  SWING_RANGE: 3.2,
  SWING_ANGLE_RAD: (140 * Math.PI) / 180, // 140 degree hit cone
  
  STEAL_RANGE: 2.4,
  STEAL_HOLD_TIME_SEC: 1.0, // Survivor must hold E for 1 second near Hunter
  
  STUN_DURATION_SEC: 2.8,
  
  TAG_SCORE: 100,
  STEAL_SCORE: 150,
  SURVIVE_PHASE_SCORE: 50,
};

export const PLAYER_STATES = {
  NORMAL: 'NORMAL',
  HUNTER: 'HUNTER',
  STUNNED: 'STUNNED',
  STEALING: 'STEALING',
  SPECTATING: 'SPECTATING',
};

export const GAME_PHASES = {
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  RUSH: 'RUSH', // Waiting for first belt pickup
  LIGHTS_ON: 'LIGHTS_ON',
  BLACKOUT: 'BLACKOUT',
  LIGHTS_WARN: 'LIGHTS_WARN',
  GAME_OVER: 'GAME_OVER',
};
