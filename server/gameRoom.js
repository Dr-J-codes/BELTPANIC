// Authoritative Game Room for Belt Panic!
import { ARENA, GAME_RULES, GAME_PHASES, PLAYER_STATES } from './constants.js';
import { BotController, BOT_NAMES, BOT_SKINS } from './botAI.js';

export class GameRoom {
  constructor(roomId, onBroadcast) {
    this.id = roomId;
    this.broadcast = onBroadcast; // callback: (roomId, msg) => void

    this.players = new Map(); // id -> PlayerObject
    this.bots = new Map(); // id -> BotController

    this.phase = GAME_PHASES.LOBBY;
    this.phaseTimer = 0;
    this.matchTimer = GAME_RULES.MATCH_DURATION_SEC;

    this.belt = {
      x: ARENA.PEDESTAL.x,
      y: ARENA.PEDESTAL.height + 0.4,
      z: ARENA.PEDESTAL.z,
      onPedestal: true,
      holderId: null,
    };

    this.hunterId = null;
    this.pendingHunterId = null;
    this.beltStolenInBlackout = false;
    this.stealerId = null;
    this.stealTimer = 0; // seconds held

    this.tickInterval = null;
    this.lastTickTime = Date.now();

    this.startLoop();
  }

  startLoop() {
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => {
      this.tick();
    }, GAME_RULES.TICK_INTERVAL_MS);
  }

  stopLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  addPlayer(id, name, skin, isBot = false) {
    const spawnPos = this._getSpawnPosition(this.players.size);
    const player = {
      id,
      name: name || (isBot ? 'Bot' : `Player_${id.slice(0, 4)}`),
      skin: skin || { color: '#ff477e', hat: 'party', face: 'happy' },
      x: spawnPos.x,
      y: 0,
      z: spawnPos.z,
      vx: 0,
      vy: 0,
      vz: 0,
      angle: spawnPos.angle,
      isGrounded: true,
      state: PLAYER_STATES.NORMAL,
      score: 0,
      tagsCount: 0,
      stealsCount: 0,
      swingCooldown: 0,
      stunTimer: 0,
      isBot,
      input: {
        x: 0,
        z: 0,
        jump: false,
        swing: false,
        steal: false,
        angle: 0,
      },
    };

    this.players.set(id, player);

    if (isBot) {
      this.bots.set(id, new BotController(player, this));
    }

    // Notify all
    this.broadcast(this.id, {
      type: 'PLAYER_JOINED',
      player: this._serializePlayer(player),
    });

    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;

    this.players.delete(id);
    this.bots.delete(id);

    // If hunter or stealer left
    if (this.hunterId === id || this.pendingHunterId === id) {
      this._handleHunterDisconnect();
    }

    this.broadcast(this.id, {
      type: 'PLAYER_LEFT',
      playerId: id,
    });

    if (this.players.size === 0) {
      this.resetToLobby();
    }
  }

  setPlayerInput(id, input) {
    const p = this.players.get(id);
    if (p && !p.isBot) {
      p.input = {
        x: Number(input.x) || 0,
        z: Number(input.z) || 0,
        jump: Boolean(input.jump),
        swing: Boolean(input.swing),
        steal: Boolean(input.steal),
        angle: (input.angle !== null && input.angle !== undefined && !isNaN(input.angle))
          ? Number(input.angle)
          : p.angle,
      };
    }
  }

  addBots(count = 3) {
    for (let i = 0; i < count; i++) {
      const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const skin = BOT_SKINS[Math.floor(Math.random() * BOT_SKINS.length)];
      this.addPlayer(botId, name, skin, true);
    }
  }

  clearBots() {
    for (const [id, p] of this.players.entries()) {
      if (p.isBot) {
        this.removePlayer(id);
      }
    }
  }

  startMatch() {
    this.phase = GAME_PHASES.COUNTDOWN;
    this.phaseTimer = GAME_RULES.COUNTDOWN_DURATION_SEC;
    this.matchTimer = GAME_RULES.MATCH_DURATION_SEC;
    this.hunterId = null;
    this.pendingHunterId = null;
    this.beltStolenInBlackout = false;
    this.stealerId = null;
    this.stealTimer = 0;

    // Reset belt to pedestal
    this.belt = {
      x: ARENA.PEDESTAL.x,
      y: ARENA.PEDESTAL.height + 0.4,
      z: ARENA.PEDESTAL.z,
      onPedestal: true,
      holderId: null,
    };

    // Respawn players at spawn points
    let idx = 0;
    for (const p of this.players.values()) {
      const spawn = this._getSpawnPosition(idx++);
      p.x = spawn.x;
      p.y = 0;
      p.z = spawn.z;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.angle = spawn.angle;
      p.state = PLAYER_STATES.NORMAL;
      p.score = 0;
      p.tagsCount = 0;
      p.stealsCount = 0;
      p.stunTimer = 0;
      p.swingCooldown = 0;
    }

    this.broadcast(this.id, {
      type: 'MATCH_COUNTDOWN_STARTED',
      duration: this.phaseTimer,
    });
  }

  resetToLobby() {
    this.phase = GAME_PHASES.LOBBY;
    this.phaseTimer = 0;
    this.hunterId = null;
    this.pendingHunterId = null;
    this.beltStolenInBlackout = false;
    this.stealerId = null;
    this.stealTimer = 0;
    this.belt.onPedestal = true;
    this.belt.holderId = null;
    this.belt.x = ARENA.PEDESTAL.x;
    this.belt.y = ARENA.PEDESTAL.height + 0.4;
    this.belt.z = ARENA.PEDESTAL.z;

    for (const p of this.players.values()) {
      p.state = PLAYER_STATES.NORMAL;
      p.stunTimer = 0;
    }

    this.broadcast(this.id, {
      type: 'RETURNED_TO_LOBBY',
    });
  }

  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;
    const nowSec = now / 1000;

    // Update bots
    for (const bot of this.bots.values()) {
      bot.update(dt, nowSec);
    }

    // Update match and phase timers
    this._updateTimers(dt);

    // Update player movement and physics
    this._updatePhysics(dt);

    // Update game mechanics (rush, swing, steal, etc.)
    this._updateGameplay(dt);

    // Broadcast state update
    this._broadcastState();
  }

  _updateTimers(dt) {
    if (this.phase === GAME_PHASES.LOBBY) return;

    if (this.phase !== GAME_PHASES.GAME_OVER && this.phase !== GAME_PHASES.COUNTDOWN) {
      this.matchTimer -= dt;
      if (this.matchTimer <= 0) {
        this.matchTimer = 0;
        this._endMatch();
        return;
      }
    }

    this.phaseTimer -= dt;

    if (this.phase === GAME_PHASES.COUNTDOWN) {
      if (this.phaseTimer <= 0) {
        // Countdown finished -> Rush to the belt!
        this.phase = GAME_PHASES.RUSH;
        this.phaseTimer = 0;
        this.broadcast(this.id, {
          type: 'PHASE_CHANGE',
          phase: GAME_PHASES.RUSH,
          banner: 'WHO WILL GET THE BELT?',
          subtext: 'Rush to the pedestal in the centre!',
        });
      }
    } else if (this.phase === GAME_PHASES.LIGHTS_ON) {
      if (this.phaseTimer <= 0) {
        // Lights ON ended -> Blackout starts!
        this.phase = GAME_PHASES.BLACKOUT;
        this.phaseTimer = GAME_RULES.BLACKOUT_DURATION_SEC;
        this.beltStolenInBlackout = false;
        this.stealerId = null;
        this.stealTimer = 0;

        this.broadcast(this.id, {
          type: 'PHASE_CHANGE',
          phase: GAME_PHASES.BLACKOUT,
          duration: this.phaseTimer,
          banner: 'LIGHTS OUT! STEAL THE BELT!',
          subtext: 'Get close to the Hunter and hold [E] to steal!',
        });
      }
    } else if (this.phase === GAME_PHASES.BLACKOUT) {
      if (this.phaseTimer <= GAME_RULES.LIGHTS_WARN_DURATION_SEC) {
        // Final 2 seconds warning of blackout!
        this.phase = GAME_PHASES.LIGHTS_WARN;
        this.broadcast(this.id, {
          type: 'PHASE_CHANGE',
          phase: GAME_PHASES.LIGHTS_WARN,
          duration: this.phaseTimer,
          banner: 'LIGHTS RETURNING!',
          subtext: 'Warning! Lights switching ON in 2 seconds!',
        });
      }
    } else if (this.phase === GAME_PHASES.LIGHTS_WARN) {
      if (this.phaseTimer <= 0) {
        // Lights return! Reveal new hunter!
        this._lightsReturn();
      }
    }
  }

  _lightsReturn() {
    this.phase = GAME_PHASES.LIGHTS_ON;
    this.phaseTimer = GAME_RULES.LIGHTS_ON_DURATION_SEC;
    this.stealTimer = 0;
    this.stealerId = null;

    let banner = 'LIGHTS ON!';
    let subtext = 'Hunter on the loose!';

    if (this.pendingHunterId) {
      // Belt was stolen during blackout!
      const oldHunter = this.players.get(this.hunterId);
      if (oldHunter) oldHunter.state = PLAYER_STATES.NORMAL;

      this.hunterId = this.pendingHunterId;
      this.pendingHunterId = null;

      const newHunter = this.players.get(this.hunterId);
      if (newHunter) {
        newHunter.state = PLAYER_STATES.HUNTER;
        banner = `NEW HUNTER: ${newHunter.name}!`;
        subtext = `${newHunter.name} stole the belt in the dark! RUN!`;
      }
    } else {
      const currentHunter = this.players.get(this.hunterId);
      if (currentHunter) {
        banner = `HUNTER: ${currentHunter.name}!`;
        subtext = `${currentHunter.name} kept the belt! Watch out!`;
      }
    }

    // Award survival points to uncaught survivors
    for (const p of this.players.values()) {
      if (p.id !== this.hunterId && p.state !== PLAYER_STATES.STUNNED) {
        p.score += GAME_RULES.SURVIVE_PHASE_SCORE;
      }
      // Reset stunned players back to normal
      p.state = p.id === this.hunterId ? PLAYER_STATES.HUNTER : PLAYER_STATES.NORMAL;
      p.stunTimer = 0;
    }

    this.broadcast(this.id, {
      type: 'PHASE_CHANGE',
      phase: GAME_PHASES.LIGHTS_ON,
      duration: this.phaseTimer,
      hunterId: this.hunterId,
      banner,
      subtext,
    });
  }

  _updatePhysics(dt) {
    for (const p of this.players.values()) {
      // Cooldowns and stun
      if (p.swingCooldown > 0) p.swingCooldown -= dt;
      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        if (p.stunTimer <= 0) {
          p.stunTimer = 0;
          if (p.state === PLAYER_STATES.STUNNED) {
            p.state = p.id === this.hunterId ? PLAYER_STATES.HUNTER : PLAYER_STATES.NORMAL;
          }
        }
      }

      // If stunned, cannot move
      if (p.state === PLAYER_STATES.STUNNED) {
        p.vx = 0;
        p.vz = 0;
      } else {
        const speed = p.id === this.hunterId ? GAME_RULES.HUNTER_SPEED : GAME_RULES.PLAYER_SPEED;
        const inputLen = Math.hypot(p.input.x, p.input.z);
        const targetVx = inputLen > 0.05 ? (p.input.x / inputLen) * speed : 0;
        const targetVz = inputLen > 0.05 ? (p.input.z / inputLen) * speed : 0;

        // Smooth acceleration and deceleration
        const accel = p.isGrounded ? 32.0 : 14.0;
        p.vx += (targetVx - p.vx) * Math.min(1.0, accel * dt);
        p.vz += (targetVz - p.vz) * Math.min(1.0, accel * dt);

        // Smooth character rotation toward input direction
        if (p.input.angle !== undefined && !isNaN(p.input.angle)) {
          let diff = (p.input.angle - p.angle) % (Math.PI * 2);
          if (diff < -Math.PI) diff += Math.PI * 2;
          if (diff > Math.PI) diff -= Math.PI * 2;
          p.angle += diff * Math.min(1.0, 18.0 * dt);
        }

        // Jump
        if (p.input.jump && p.isGrounded) {
          p.vy = 9.5;
          p.isGrounded = false;
        }
      }

      // Gravity
      p.vy -= 25.0 * dt;
      p.y += p.vy * dt;

      // Ground plane
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.isGrounded = true;
      }

      // X Movement & Obstacle sliding
      p.x += p.vx * dt;
      this._resolveObstacleCollisions(p);

      // Z Movement & Obstacle sliding
      p.z += p.vz * dt;
      this._resolveObstacleCollisions(p);

      // Arena boundary collision with smooth sliding
      const bound = ARENA.HALF_SIZE - GAME_RULES.PLAYER_RADIUS;
      if (p.x < -bound) p.x = -bound;
      if (p.x > bound) p.x = bound;
      if (p.z < -bound) p.z = -bound;
      if (p.z > bound) p.z = bound;

      // Central Pedestal collision & stepping
      const distToCenter = Math.hypot(p.x, p.z);
      if (distToCenter < ARENA.PEDESTAL.radius) {
        // Step onto pedestal top
        p.y = Math.max(p.y, ARENA.PEDESTAL.height);
        if (p.y <= ARENA.PEDESTAL.height + 0.05) {
          p.y = ARENA.PEDESTAL.height;
          p.vy = 0;
          p.isGrounded = true;
        }
      }
    }
  }

  _resolveObstacleCollisions(p) {
    const pr = GAME_RULES.PLAYER_RADIUS;
    for (const obs of ARENA.OBSTACLES) {
      if (obs.type === 'cylinder') {
        const dx = p.x - obs.x;
        const dz = p.z - obs.z;
        const distSq = dx * dx + dz * dz;
        const minDist = obs.radius + pr;
        if (distSq < minDist * minDist && distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const pushOut = minDist - dist;
          p.x += (dx / dist) * pushOut;
          p.z += (dz / dist) * pushOut;
        }
      } else if (obs.type === 'box') {
        // Circle-AABB closest point projection for smooth rounded corner sliding
        const halfX = obs.sx / 2;
        const halfZ = obs.sz / 2;
        const closestX = Math.max(obs.x - halfX, Math.min(obs.x + halfX, p.x));
        const closestZ = Math.max(obs.z - halfZ, Math.min(obs.z + halfZ, p.z));

        const dx = p.x - closestX;
        const dz = p.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < pr * pr) {
          if (distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const pushOut = pr - dist;
            p.x += (dx / dist) * pushOut;
            p.z += (dz / dist) * pushOut;
          } else {
            // Player is inside the box: push out to shallowest edge
            const left = p.x - (obs.x - halfX);
            const right = (obs.x + halfX) - p.x;
            const top = p.z - (obs.z - halfZ);
            const bottom = (obs.z + halfZ) - p.z;
            const min = Math.min(left, right, top, bottom);

            if (min === left) p.x = obs.x - halfX - pr;
            else if (min === right) p.x = obs.x + halfX + pr;
            else if (min === top) p.z = obs.z - halfZ - pr;
            else p.z = obs.z + halfZ + pr;
          }
        }
      }
    }
  }

  _updateGameplay(dt) {
    // 1. RUSH PHASE: Who picks up the belt from the pedestal?
    if (this.phase === GAME_PHASES.RUSH && this.belt.onPedestal) {
      for (const p of this.players.values()) {
        const distToPedestal = Math.hypot(p.x - ARENA.PEDESTAL.x, p.z - ARENA.PEDESTAL.z);
        if (distToPedestal <= ARENA.PEDESTAL.pickupRadius) {
          // Belt picked up!
          this.belt.onPedestal = false;
          this.belt.holderId = p.id;
          this.hunterId = p.id;
          p.state = PLAYER_STATES.HUNTER;

          this.phase = GAME_PHASES.LIGHTS_ON;
          this.phaseTimer = GAME_RULES.LIGHTS_ON_DURATION_SEC;

          this.broadcast(this.id, {
            type: 'BELT_PICKED_UP',
            hunterId: p.id,
            hunterName: p.name,
            banner: 'WE HAVE A HUNTER!',
            subtext: `${p.name} grabbed the belt! RUN FOR YOUR LIVES!`,
          });
          break;
        }
      }
    }

    // 2. LIGHTS ON: Hunter swings belt at survivors
    if (this.phase === GAME_PHASES.LIGHTS_ON && this.hunterId) {
      const hunter = this.players.get(this.hunterId);
      if (hunter && hunter.input.swing && hunter.swingCooldown <= 0) {
        hunter.swingCooldown = GAME_RULES.SWING_COOLDOWN_SEC;

        // Broadcast swing animation
        this.broadcast(this.id, {
          type: 'BELT_SWING',
          hunterId: hunter.id,
        });

        // Hit detection
        const hunterDirX = Math.sin(hunter.angle);
        const hunterDirZ = Math.cos(hunter.angle);

        for (const target of this.players.values()) {
          if (target.id === hunter.id || target.state === PLAYER_STATES.STUNNED) continue;

          const dx = target.x - hunter.x;
          const dz = target.z - hunter.z;
          const dist = Math.hypot(dx, dz);

          if (dist <= GAME_RULES.SWING_RANGE) {
            // Check angle in front of hunter
            const dirToTargetX = dx / dist;
            const dirToTargetZ = dz / dist;
            const dot = hunterDirX * dirToTargetX + hunterDirZ * dirToTargetZ;
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

            if (angle <= GAME_RULES.SWING_ANGLE_RAD / 2) {
              // TAGGED!
              target.state = PLAYER_STATES.STUNNED;
              target.stunTimer = GAME_RULES.STUN_DURATION_SEC;
              hunter.score += GAME_RULES.TAG_SCORE;
              hunter.tagsCount++;

              this.broadcast(this.id, {
                type: 'PLAYER_TAGGED',
                hunterId: hunter.id,
                hunterName: hunter.name,
                taggedId: target.id,
                taggedName: target.name,
                hitPos: { x: target.x, y: target.y + 0.9, z: target.z },
              });
            }
          }
        }
      }
    }

    // 3. BLACKOUT: Survivors can steal the belt
    if ((this.phase === GAME_PHASES.BLACKOUT || this.phase === GAME_PHASES.LIGHTS_WARN) && !this.beltStolenInBlackout) {
      const hunter = this.players.get(this.hunterId);
      if (hunter) {
        let activeThief = null;

        for (const p of this.players.values()) {
          if (p.id === hunter.id || p.state === PLAYER_STATES.STUNNED) continue;

          if (p.input.steal) {
            const dist = Math.hypot(p.x - hunter.x, p.z - hunter.z);
            if (dist <= GAME_RULES.STEAL_RANGE) {
              activeThief = p;
              break;
            }
          }
        }

        if (activeThief) {
          if (this.stealerId === activeThief.id) {
            this.stealTimer += dt;
            if (this.stealTimer >= GAME_RULES.STEAL_HOLD_TIME_SEC) {
              // SUCCESSFUL STEAL!
              this.beltStolenInBlackout = true;
              this.pendingHunterId = activeThief.id;
              this.belt.holderId = activeThief.id;
              activeThief.score += GAME_RULES.STEAL_SCORE;
              activeThief.stealsCount++;

              this.broadcast(this.id, {
                type: 'BELT_STOLEN',
                thiefId: activeThief.id,
                banner: 'BELT STOLEN!',
                subtext: 'A survivor swiped the belt in the shadows!',
              });
              this.stealTimer = 0;
              this.stealerId = null;
            }
          } else {
            this.stealerId = activeThief.id;
            this.stealTimer = dt;
          }
        } else {
          // Reset stealing progress
          this.stealerId = null;
          this.stealTimer = 0;
        }
      }
    }

    // Update belt position
    if (this.belt.onPedestal) {
      this.belt.x = ARENA.PEDESTAL.x;
      this.belt.y = ARENA.PEDESTAL.height + 0.4;
      this.belt.z = ARENA.PEDESTAL.z;
    } else {
      const holder = this.players.get(this.belt.holderId || this.hunterId);
      if (holder) {
        this.belt.x = holder.x;
        this.belt.y = holder.y + 0.6;
        this.belt.z = holder.z;
      }
    }
  }

  _handleHunterDisconnect() {
    this.broadcast(this.id, {
      type: 'HUNTER_DISCONNECTED',
      banner: 'HUNTER DISCONNECTED!',
      subtext: 'The belt has returned to the pedestal! RUSH!',
    });

    this.belt.onPedestal = true;
    this.belt.holderId = null;
    this.belt.x = ARENA.PEDESTAL.x;
    this.belt.y = ARENA.PEDESTAL.height + 0.4;
    this.belt.z = ARENA.PEDESTAL.z;
    this.hunterId = null;
    this.pendingHunterId = null;
    this.phase = GAME_PHASES.RUSH;
    this.phaseTimer = 0;
  }

  _endMatch() {
    this.phase = GAME_PHASES.GAME_OVER;

    // Determine rankings
    const sortedPlayers = Array.from(this.players.values()).sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0] || null;

    this.broadcast(this.id, {
      type: 'MATCH_OVER',
      winner: winner ? this._serializePlayer(winner) : null,
      leaderboard: sortedPlayers.map((p) => this._serializePlayer(p)),
      banner: winner ? `${winner.name} WINS!` : 'MATCH OVER!',
      subtext: 'Belt Panic Champion of the Arena!',
    });
  }

  _getSpawnPosition(index) {
    const totalSpawns = 8;
    const angle = (index % totalSpawns) * ((Math.PI * 2) / totalSpawns);
    const dist = 14.0; // Distance from center
    return {
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      angle: angle + Math.PI, // Face inwards towards center
    };
  }

  _serializePlayer(p) {
    return {
      id: p.id,
      name: p.name,
      skin: p.skin,
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      vx: Math.round(p.vx * 100) / 100,
      vy: Math.round(p.vy * 100) / 100,
      vz: Math.round(p.vz * 100) / 100,
      angle: Math.round(p.angle * 100) / 100,
      state: p.state,
      score: p.score,
      tagsCount: p.tagsCount,
      stealsCount: p.stealsCount,
      isGrounded: p.isGrounded,
      isBot: p.isBot,
    };
  }

  _broadcastState() {
    const playerArray = [];
    for (const p of this.players.values()) {
      playerArray.push(this._serializePlayer(p));
    }

    const statePayload = {
      type: 'STATE_UPDATE',
      phase: this.phase,
      phaseTimer: Math.max(0, Math.round(this.phaseTimer * 10) / 10),
      matchTimer: Math.max(0, Math.round(this.matchTimer)),
      hunterId: (this.phase === GAME_PHASES.BLACKOUT || this.phase === GAME_PHASES.LIGHTS_WARN)
        ? null // Keep suspense during blackout!
        : this.hunterId,
      belt: {
        x: Math.round(this.belt.x * 100) / 100,
        y: Math.round(this.belt.y * 100) / 100,
        z: Math.round(this.belt.z * 100) / 100,
        onPedestal: this.belt.onPedestal,
        holderId: (this.phase === GAME_PHASES.BLACKOUT || this.phase === GAME_PHASES.LIGHTS_WARN)
          ? null
          : this.belt.holderId,
      },
      stealerId: this.stealerId,
      stealProgress: this.stealerId ? Math.min(1.0, this.stealTimer / GAME_RULES.STEAL_HOLD_TIME_SEC) : 0,
      players: playerArray,
    };

    this.broadcast(this.id, statePayload);
  }
}
