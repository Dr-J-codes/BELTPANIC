// Bot AI for Belt Panic!
import { GAME_PHASES, GAME_RULES, ARENA } from './constants.js';

export const BOT_NAMES = [
  'ChunkyChip',
  'BouncyBob',
  'WobblyWill',
  'SpeedySam',
  'DizzyDan',
  'GoofyGus',
  'TinyToby',
  'SnazzySyd',
];

export const BOT_SKINS = [
  { color: '#ff477e', hat: 'crown', face: 'derp' },
  { color: '#06d6a0', hat: 'party', face: 'happy' },
  { color: '#ffd166', hat: 'propeller', face: 'goofy' },
  { color: '#118ab2', hat: 'chef', face: 'cool' },
  { color: '#8338ec', hat: 'beanie', face: 'wink' },
  { color: '#fb5607', hat: 'horns', face: 'happy' },
];

export class BotController {
  constructor(player, gameRoom) {
    this.player = player;
    this.room = gameRoom;
    this.nextDecisionTime = 0;
    this.targetPos = { x: 0, z: 0 };
    this.isStealing = false;
    this.stuckTimer = 0;
    this.lastPos = { x: player.x, z: player.z };
  }

  update(dt, nowSec) {
    if (!this.player || this.player.state === 'STUNNED') {
      this.player.input = { x: 0, z: 0, jump: false, swing: false, steal: false, angle: this.player.angle };
      return;
    }

    const phase = this.room.phase;
    const isHunter = this.room.hunterId === this.player.id;

    // Movement vector output
    let moveX = 0;
    let moveZ = 0;
    let targetAngle = this.player.angle;
    let swing = false;
    let steal = false;
    let jump = false;

    // Detect if stuck against an obstacle
    const distMoved = Math.hypot(this.player.x - this.lastPos.x, this.player.z - this.lastPos.z);
    if (distMoved < 0.05 * dt) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.8) {
        jump = Math.random() < 0.6;
        this.nextDecisionTime = 0; // force new target
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    this.lastPos.x = this.player.x;
    this.lastPos.z = this.player.z;

    // Decision-making logic based on game phase
    if (phase === GAME_PHASES.RUSH && !this.room.beltOwnerId) {
      // Rush towards the pedestal!
      const dx = ARENA.PEDESTAL.x - this.player.x;
      const dz = ARENA.PEDESTAL.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        moveX = dx / dist;
        moveZ = dz / dist;
        targetAngle = Math.atan2(moveX, moveZ);
      }
    } else if (isHunter && phase === GAME_PHASES.LIGHTS_ON) {
      // HUNTER: Find closest survivor and chase them!
      let closestSurvivor = null;
      let minDist = Infinity;

      for (const p of this.room.players.values()) {
        if (p.id === this.player.id || p.state === 'STUNNED' || p.state === 'SPECTATING') continue;
        const dist = Math.hypot(p.x - this.player.x, p.z - this.player.z);
        if (dist < minDist) {
          minDist = dist;
          closestSurvivor = p;
        }
      }

      if (closestSurvivor) {
        const dx = closestSurvivor.x - this.player.x;
        const dz = closestSurvivor.z - this.player.z;
        const dist = Math.hypot(dx, dz);

        moveX = dx / dist;
        moveZ = dz / dist;
        targetAngle = Math.atan2(moveX, moveZ);

        // If in range and reasonably facing target, swing!
        if (dist <= GAME_RULES.SWING_RANGE * 0.95) {
          swing = true;
        }
      } else {
        // Patrol arena
        this._patrol(nowSec);
        moveX = (this.targetPos.x - this.player.x);
        moveZ = (this.targetPos.z - this.player.z);
        const len = Math.hypot(moveX, moveZ);
        if (len > 0.5) {
          moveX /= len;
          moveZ /= len;
          targetAngle = Math.atan2(moveX, moveZ);
        }
      }
    } else if (!isHunter && phase === GAME_PHASES.LIGHTS_ON) {
      // SURVIVOR in LIGHTS ON: Run away from the Hunter!
      const hunter = this.room.players.get(this.room.hunterId);
      if (hunter) {
        const dx = this.player.x - hunter.x;
        const dz = this.player.z - hunter.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 12) {
          // Flee directly away from hunter with slight jitter
          const angle = Math.atan2(dx, dz) + (Math.sin(nowSec * 3 + this.player.id.charCodeAt(0)) * 0.4);
          moveX = Math.sin(angle);
          moveZ = Math.cos(angle);
          targetAngle = angle;
          if (dist < 4.0 && Math.random() < 0.1) {
            jump = true; // Panic jump!
          }
        } else {
          // Hide behind an obstacle
          this._patrol(nowSec);
          moveX = (this.targetPos.x - this.player.x);
          moveZ = (this.targetPos.z - this.player.z);
          const len = Math.hypot(moveX, moveZ);
          if (len > 0.5) {
            moveX /= len;
            moveZ /= len;
            targetAngle = Math.atan2(moveX, moveZ);
          }
        }
      }
    } else if (!isHunter && (phase === GAME_PHASES.BLACKOUT || phase === GAME_PHASES.LIGHTS_WARN)) {
      // SURVIVOR in BLACKOUT: SNEAK UP AND STEAL THE BELT!
      const hunter = this.room.players.get(this.room.hunterId);
      if (hunter && !this.room.beltStolenInBlackout) {
        const dx = hunter.x - this.player.x;
        const dz = hunter.z - this.player.z;
        const dist = Math.hypot(dx, dz);

        if (dist > GAME_RULES.STEAL_RANGE * 0.8) {
          moveX = dx / dist;
          moveZ = dz / dist;
          targetAngle = Math.atan2(moveX, moveZ);
        } else {
          // Close enough: Hold E to steal!
          steal = true;
          targetAngle = Math.atan2(dx, dz);
        }
      } else {
        // Wandering stealthily
        this._patrol(nowSec);
        moveX = (this.targetPos.x - this.player.x);
        moveZ = (this.targetPos.z - this.player.z);
        const len = Math.hypot(moveX, moveZ);
        if (len > 0.5) {
          moveX /= len;
          moveZ /= len;
          targetAngle = Math.atan2(moveX, moveZ);
        }
      }
    } else if (isHunter && (phase === GAME_PHASES.BLACKOUT || phase === GAME_PHASES.LIGHTS_WARN)) {
      // HUNTER in BLACKOUT: Run around randomly trying to evade survivors
      this._patrol(nowSec);
      moveX = (this.targetPos.x - this.player.x);
      moveZ = (this.targetPos.z - this.player.z);
      const len = Math.hypot(moveX, moveZ);
      if (len > 0.5) {
        moveX /= len;
        moveZ /= len;
        targetAngle = Math.atan2(moveX, moveZ);
      }
    } else {
      // Lobby or countdown or game over: goofy wandering
      if (nowSec > this.nextDecisionTime) {
        this._patrol(nowSec);
      }
      moveX = (this.targetPos.x - this.player.x);
      moveZ = (this.targetPos.z - this.player.z);
      const len = Math.hypot(moveX, moveZ);
      if (len > 0.8) {
        moveX /= len;
        moveZ /= len;
        targetAngle = Math.atan2(moveX, moveZ);
      }
    }

    // Apply inputs to player state
    this.player.input = {
      x: moveX,
      z: moveZ,
      jump,
      swing,
      steal,
      angle: targetAngle,
    };
  }

  _patrol(nowSec) {
    if (nowSec > this.nextDecisionTime) {
      this.nextDecisionTime = nowSec + 2.0 + Math.random() * 2.5;
      const bound = ARENA.HALF_SIZE - 4;
      this.targetPos = {
        x: (Math.random() * 2 - 1) * bound,
        z: (Math.random() * 2 - 1) * bound,
      };
    }
  }
}

