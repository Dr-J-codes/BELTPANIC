// Main Entrypoint for BELT PANIC!
import * as THREE from 'three';
import { ArenaScene } from './game/scene.js';
import { ThirdPersonCamera } from './game/camera.js';
import { CharacterModel } from './game/character.js';
import { BeltModel } from './game/belt.js';
import { EffectsManager } from './game/effects.js';
import { InputControls } from './game/controls.js';
import { NetworkClient, getBackendHttpUrl } from './network.js';
import { sound } from './audio.js';
import { GAME_PHASES, PLAYER_STATES } from '../server/constants.js';

class BeltPanicGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Three.js Camera & ThirdPerson Controller
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
    this.thirdPersonCam = new ThirdPersonCamera(this.camera);

    // Arena Scene & Props
    this.arena = new ArenaScene();
    this.effects = new EffectsManager(this.arena.scene);

    // Central Belt
    this.belt = new BeltModel();
    this.arena.scene.add(this.belt.root);

    // Character Meshes Map: id -> CharacterModel
    this.characters = new Map();

    // Input & Controls
    this.controls = new InputControls(this.canvas, this.thirdPersonCam);

    // Networking
    this.net = new NetworkClient();

    // State cache
    this.localPlayerId = null;
    this.currentPhase = GAME_PHASES.LOBBY;
    this.hunterId = null;
    this.stealerId = null;
    this.stealProgress = 0;
    this.lastState = null;

    // Customization state
    this.localSkin = {
      color: '#ff477e',
      hat: 'party',
      face: 'happy',
    };

    // Timing
    this.clock = new THREE.Clock();

    // Banner timer
    this.bannerTimeout = null;

    this._initUI();
    this._initNetworkEvents();
    this._initCustomizerPreview();
    this._setupResize();

    // Start render loop
    this.animate();
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _initUI() {
    // Buttons
    document.getElementById('btn-play').addEventListener('click', () => {
      sound.init();
      sound.startMusic();
      const name = document.getElementById('player-name').value.trim() || 'BouncyHero';
      const room = document.getElementById('room-code').value.trim() || 'ARENA1';
      this._joinGame(room, name, false);
    });

    document.getElementById('btn-practice').addEventListener('click', () => {
      sound.init();
      sound.startMusic();
      const name = document.getElementById('player-name').value.trim() || 'BouncyHero';
      const room = `BOT_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      this._joinGame(room, name, true);
    });

    // Customise button
    document.getElementById('btn-customize').addEventListener('click', () => {
      sound.init();
      document.getElementById('customise-modal').classList.remove('hidden');
    });

    document.getElementById('btn-save-custom').addEventListener('click', () => {
      document.getElementById('customise-modal').classList.add('hidden');
    });

    // How to Play button
    document.getElementById('btn-how-to-play').addEventListener('click', () => {
      sound.init();
      document.getElementById('how-to-play-modal').classList.remove('hidden');
    });

    document.getElementById('btn-close-how').addEventListener('click', () => {
      document.getElementById('how-to-play-modal').classList.add('hidden');
    });

    // Sound toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      soundBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    // Server Config Modal (for Vercel -> Render)
    const serverBtn = document.getElementById('btn-server-config');
    const serverModal = document.getElementById('server-modal');
    const serverInput = document.getElementById('input-server-url');
    const serverFeedback = document.getElementById('server-status-feedback');
    const serverLabel = document.getElementById('label-server-name');

    const updateServerPill = () => {
      try {
        const u = new URL(getBackendHttpUrl());
        serverLabel.textContent = `SERVER: ${u.hostname.replace('.onrender.com', '')}`;
      } catch {
        serverLabel.textContent = `SERVER: AUTO`;
      }
    };
    updateServerPill();

    serverBtn.addEventListener('click', () => {
      serverInput.value = getBackendHttpUrl();
      serverFeedback.textContent = '';
      serverModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-server').addEventListener('click', () => {
      serverModal.classList.add('hidden');
    });

    document.getElementById('btn-test-server').addEventListener('click', async () => {
      const raw = serverInput.value.trim();
      if (!raw) return;
      serverFeedback.style.color = '#ffd166';
      serverFeedback.textContent = '⏳ Pinging server... (if Render free tier is sleeping, wake-up takes ~30-50s)';

      try {
        const start = performance.now();
        const res = await fetch(`${raw.replace(/\/+$/, '')}/health`, { mode: 'cors' });
        const data = await res.json();
        const ping = Math.round(performance.now() - start);
        serverFeedback.style.color = '#06d6a0';
        serverFeedback.textContent = `✓ Server is ONLINE! (${ping}ms) • Active rooms: ${data.rooms}`;
      } catch (err) {
        serverFeedback.style.color = '#ef233c';
        serverFeedback.textContent = '✗ Could not reach server. Verify Render URL and make sure service is active.';
      }
    });

    document.getElementById('btn-save-server').addEventListener('click', () => {
      const val = serverInput.value.trim();
      if (val) {
        localStorage.setItem('beltpanic_server_url', val);
      } else {
        localStorage.removeItem('beltpanic_server_url');
      }
      updateServerPill();
      serverModal.classList.add('hidden');
    });

    // HUD Lobby buttons
    document.getElementById('hud-btn-start').addEventListener('click', () => {
      this.net.startMatch();
    });

    document.getElementById('hud-btn-bots').addEventListener('click', () => {
      this.net.addBots(3);
    });

    document.getElementById('hud-btn-leave').addEventListener('click', () => {
      window.location.reload();
    });

    // Game Over buttons
    document.getElementById('btn-play-again').addEventListener('click', () => {
      document.getElementById('game-over-modal').classList.add('hidden');
      this.net.startMatch();
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
      window.location.reload();
    });
  }

  _initCustomizerPreview() {
    const stage = document.getElementById('custom-preview-stage');
    if (stage) {
      const width = stage.clientWidth || 300;
      const height = stage.clientHeight || 280;
      const prevScene = new THREE.Scene();
      const prevCam = new THREE.PerspectiveCamera(45, width / height, 0.1, 20);
      prevCam.position.set(0, 1.0, 3.2);
      prevCam.lookAt(0, 0.7, 0);

      const prevRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      prevRenderer.setSize(width, height);
      prevRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      stage.appendChild(prevRenderer.domElement);

      const amb = new THREE.AmbientLight(0xffffff, 1.2);
      prevScene.add(amb);
      const dir = new THREE.DirectionalLight(0xfffaed, 1.6);
      dir.position.set(2, 4, 3);
      prevScene.add(dir);

      this.previewChar = new CharacterModel(this.localSkin);
      prevScene.add(this.previewChar.root);

      let prevClock = new THREE.Clock();
      const renderPreview = () => {
        requestAnimationFrame(renderPreview);
        const dt = prevClock.getDelta();
        if (this.previewChar) {
          this.previewChar.root.rotation.y += dt * 1.4;
          this.previewChar.animate(dt, 0, true, 0, false, false, false);
        }
        prevRenderer.render(prevScene, prevCam);
      };
      renderPreview();
    }

    // Interactive color swatches
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        swatches.forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        this.localSkin.color = swatch.getAttribute('data-color');
        if (this.previewChar) {
          this.previewChar.setSkin(this.localSkin);
        }
      });
    });

    // Interactive hat cards
    const hatCards = document.querySelectorAll('.hat-card');
    hatCards.forEach((card) => {
      card.addEventListener('click', () => {
        hatCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.localSkin.hat = card.getAttribute('data-hat');
        if (this.previewChar) {
          this.previewChar.setSkin(this.localSkin);
        }
      });
    });
  }

  async _joinGame(roomId, playerName, autoBots = false) {
    try {
      await this.net.connect();
      this.net.joinRoom(roomId, playerName, this.localSkin);

      document.getElementById('main-menu').classList.add('hidden');
      document.getElementById('game-hud').classList.remove('hidden');
      document.getElementById('hud-room-name').textContent = roomId.toUpperCase();

      if (autoBots) {
        setTimeout(() => {
          this.net.addBots(3);
          setTimeout(() => {
            this.net.startMatch();
          }, 800);
        }, 500);
      }
    } catch (err) {
      alert(`Could not connect to game server at:\n${this.net.serverWsUrl}\n\n• If hosted on Render Free Tier, the backend sleeps after inactivity and takes ~30-50 seconds to wake up!\n• You can click "SERVER SETTINGS" on the main menu to test the connection or change the URL.`);
      console.error(err);
    }
  }

  _initNetworkEvents() {
    this.net.on('joined', (data) => {
      this.localPlayerId = data.playerId;
      console.log('Joined room as', this.localPlayerId);
      this._updateHUD(data);
    });

    this.net.on('ping', (pingMs) => {
      document.getElementById('hud-ping-ms').textContent = `${pingMs}ms`;
    });

    this.net.on('state', (state) => {
      this.lastState = state;
      this._updateHUD(state);
    });

    this.net.on('phase_change', (msg) => {
      this.currentPhase = msg.phase;
      this.hunterId = msg.hunterId || this.hunterId;

      if (msg.phase === GAME_PHASES.BLACKOUT) {
        sound.playBlackout();
      } else if (msg.phase === GAME_PHASES.LIGHTS_WARN) {
        sound.playWarningBuzzer();
      } else if (msg.phase === GAME_PHASES.LIGHTS_ON) {
        sound.playCountdown(true);
      }

      if (msg.banner) {
        this.showBanner(msg.banner, msg.subtext || '');
      }
    });

    this.net.on('belt_picked_up', (msg) => {
      this.hunterId = msg.hunterId;
      sound.playCountdown(true);
      this.showBanner(msg.banner, msg.subtext);
    });

    this.net.on('belt_swing', (msg) => {
      sound.playBeltSwing();
      const hunterModel = this.characters.get(msg.hunterId);
      if (hunterModel) {
        hunterModel.triggerSwing();
      }
      this.belt.triggerSwing(hunterModel ? hunterModel.root.rotation.y : 0);
    });

    this.net.on('player_tagged', (msg) => {
      sound.playTagHit();
      sound.playStunStars();

      if (msg.hitPos) {
        this.effects.spawnHitSparks(msg.hitPos);
      }

      if (msg.taggedId === this.localPlayerId) {
        this.showBanner('YOU GOT TAGGED!', 'Stunned for 3 seconds!');
      } else if (msg.hunterId === this.localPlayerId) {
        this.showBanner('NICE TAG!', `Tagged ${msg.taggedName}! +100 PTS`);
      }
    });

    this.net.on('belt_stolen', (msg) => {
      sound.playStealSuccess();
      this.showBanner(msg.banner, msg.subtext);
    });

    this.net.on('match_over', (msg) => {
      sound.playStealSuccess();
      this._showVictoryScreen(msg);
    });

    this.net.on('returned_to_lobby', () => {
      this.showBanner('RETURNED TO LOBBY', 'Waiting for host to start match...');
    });
  }

  showBanner(title, subtext = '') {
    const banner = document.getElementById('hud-banner');
    const titleEl = document.getElementById('hud-banner-title');
    const subEl = document.getElementById('hud-banner-sub');

    titleEl.textContent = title;
    subEl.textContent = subtext;

    banner.classList.remove('hidden');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, 2800);
  }

  _updateHUD(state) {
    if (!state) return;

    this.currentPhase = state.phase;
    this.hunterId = state.hunterId;
    this.stealerId = state.stealerId;
    this.stealProgress = state.stealProgress || 0;

    // Phase Pill
    const phasePill = document.getElementById('hud-phase-pill');
    const phaseText = document.getElementById('hud-phase-text');
    const phaseIcon = document.getElementById('hud-phase-icon');
    const phaseTimer = document.getElementById('hud-phase-timer');
    const matchTimer = document.getElementById('hud-match-timer');
    const phaseBar = document.getElementById('hud-phase-bar');

    phaseTimer.textContent = `${Math.ceil(state.phaseTimer)}s`;

    const m = Math.floor(state.matchTimer / 60);
    const s = Math.floor(state.matchTimer % 60);
    matchTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    phasePill.className = 'phase-pill';
    if (state.phase === GAME_PHASES.LIGHTS_ON) {
      phasePill.classList.add('lights-on');
      phaseIcon.textContent = '☀️';
      phaseText.textContent = 'LIGHTS ON';
      phaseBar.style.width = `${(state.phaseTimer / 12) * 100}%`;
      phaseBar.style.background = '#ffb703';
    } else if (state.phase === GAME_PHASES.BLACKOUT) {
      phasePill.classList.add('blackout');
      phaseIcon.textContent = '🌑';
      phaseText.textContent = 'BLACKOUT';
      phaseBar.style.width = `${(state.phaseTimer / 10) * 100}%`;
      phaseBar.style.background = '#00f5d4';
    } else if (state.phase === GAME_PHASES.LIGHTS_WARN) {
      phasePill.classList.add('warning');
      phaseIcon.textContent = '⚠️';
      phaseText.textContent = 'LIGHTS RETURNING!';
      phaseBar.style.width = `${(state.phaseTimer / 2) * 100}%`;
      phaseBar.style.background = '#ff0055';
    } else if (state.phase === GAME_PHASES.COUNTDOWN) {
      phasePill.classList.add('warning');
      phaseIcon.textContent = '⏳';
      phaseText.textContent = 'GET READY!';
    } else if (state.phase === GAME_PHASES.RUSH) {
      phasePill.classList.add('lights-on');
      phaseIcon.textContent = '🏃';
      phaseText.textContent = 'RUSH FOR THE BELT!';
    } else {
      phaseIcon.textContent = '🎉';
      phaseText.textContent = 'LOBBY';
      phaseBar.style.width = '100%';
    }

    // Players count
    const countEl = document.getElementById('hud-player-count');
    if (state.players) {
      countEl.textContent = `${state.players.length}/8`;
    }

    // Hunter Banner
    const hunterNameEl = document.getElementById('hud-hunter-name');
    if (state.phase === GAME_PHASES.BLACKOUT || state.phase === GAME_PHASES.LIGHTS_WARN) {
      hunterNameEl.textContent = '??? SNEAKING ???';
    } else if (state.hunterId) {
      const hunterObj = state.players?.find((p) => p.id === state.hunterId);
      hunterNameEl.textContent = hunterObj ? hunterObj.name : 'Unknown';
    } else {
      hunterNameEl.textContent = 'None';
    }

    // Steal Meter
    const stealMeter = document.getElementById('hud-steal-meter');
    const stealFill = document.getElementById('hud-steal-fill');
    if (this.stealerId === this.localPlayerId && this.stealProgress > 0) {
      stealMeter.classList.remove('hidden');
      stealFill.style.width = `${this.stealProgress * 100}%`;
    } else {
      stealMeter.classList.add('hidden');
    }

    // Context instructions at bottom
    const contextText = document.getElementById('hud-context-text');
    const promptKey = document.querySelector('.prompt-key');
    const isLocalHunter = this.localPlayerId === state.hunterId;

    if (state.phase === GAME_PHASES.LIGHTS_ON && isLocalHunter) {
      promptKey.textContent = 'LMB';
      contextText.textContent = 'SWING BELT (TAG SURVIVORS)';
    } else if ((state.phase === GAME_PHASES.BLACKOUT || state.phase === GAME_PHASES.LIGHTS_WARN) && !isLocalHunter) {
      promptKey.textContent = 'HOLD [E]';
      contextText.textContent = 'SNEAK CLOSE TO HUNTER & STEAL';
    } else {
      promptKey.textContent = 'WASD + SPACE';
      contextText.textContent = 'MOVE & JUMP (HIDE BEHIND PROPS)';
    }

    // Lobby buttons visibility
    const startBtn = document.getElementById('hud-btn-start');
    if (state.phase === GAME_PHASES.LOBBY) {
      startBtn.classList.remove('hidden');
    } else {
      startBtn.classList.add('hidden');
    }

    // Leaderboard list
    this._updateLeaderboard(state.players);
  }

  _updateLeaderboard(players) {
    if (!players) return;
    const list = document.getElementById('hud-leaderboard-list');
    list.innerHTML = '';

    const sorted = [...players].sort((a, b) => b.score - a.score);
    for (const p of sorted) {
      const row = document.createElement('div');
      row.className = 'player-row';
      if (p.id === this.localPlayerId) row.classList.add('local');
      if (p.id === this.hunterId) row.classList.add('hunter');
      if (p.state === PLAYER_STATES.STUNNED) row.classList.add('stunned');

      const isHunter = p.id === this.hunterId;
      row.innerHTML = `
        <span>${isHunter ? '👑 ' : ''}${p.name}</span>
        <span>${p.score} pts</span>
      `;
      list.appendChild(row);
    }
  }

  _showVictoryScreen(msg) {
    const modal = document.getElementById('game-over-modal');
    modal.classList.remove('hidden');

    const winnerName = document.getElementById('winner-name');
    winnerName.textContent = msg.winner ? msg.winner.name : 'Everyone';

    const lbContainer = document.getElementById('game-over-leaderboard');
    lbContainer.innerHTML = '';

    if (msg.leaderboard) {
      msg.leaderboard.forEach((p, idx) => {
        const item = document.createElement('div');
        item.className = 'player-row';
        if (p.id === this.localPlayerId) item.classList.add('local');
        item.innerHTML = `
          <span>#${idx + 1} ${p.name} (Tags: ${p.tagsCount || 0}, Steals: ${p.stealsCount || 0})</span>
          <strong>${p.score} pts</strong>
        `;
        lbContainer.appendChild(item);
      });
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Collect & Send Local Input
    if (this.net.connected && this.localPlayerId) {
      const input = this.controls.collectInput();
      if (input.swing && this.hunterId === this.localPlayerId) {
        const localModel = this.characters.get(this.localPlayerId);
        if (localModel) localModel.triggerSwing();
        this.belt.triggerSwing(localModel ? localModel.root.rotation.y : 0);
        sound.playBeltSwing();
      }
      this.net.sendInput(input);
    }

    // Sync Players from network interpolation
    const interpolated = this.net.getInterpolatedPlayers();
    if (interpolated) {
      // Track existing player IDs to remove disconnected characters
      const activeIds = new Set();

      for (const p of interpolated) {
        activeIds.add(p.id);

        let charModel = this.characters.get(p.id);
        if (!charModel) {
          charModel = new CharacterModel(p.skin);
          this.characters.set(p.id, charModel);
          this.arena.scene.add(charModel.root);
        }

        // Update position and rotation
        charModel.root.position.set(p.x, p.y, p.z);
        charModel.root.rotation.y = p.angle || 0;

        // Compute speed for animation
        const speed = Math.hypot(p.vx || 0, p.vz || 0);
        const isHunter = p.id === this.hunterId;
        const isStunned = p.state === PLAYER_STATES.STUNNED;
        const isStealing = this.stealerId === p.id && this.stealProgress > 0;

        // Check landing to spawn dust puffs and play landing boing
        if (!charModel.wasGrounded && p.isGrounded) {
          this.effects.spawnDustPuff(charModel.root.position);
          sound.playJump();
        }

        charModel.animate(dt, speed, p.isGrounded, p.vy || 0, isHunter, isStunned, isStealing);

        // If local player, bind Third Person Camera target
        if (p.id === this.localPlayerId) {
          if (this.thirdPersonCam.target !== charModel.root) {
            this.thirdPersonCam.setTarget(charModel.root);
          }
        }
      }

      // Remove dropped players
      for (const [id, model] of this.characters.entries()) {
        if (!activeIds.has(id)) {
          this.arena.scene.remove(model.root);
          this.characters.delete(id);
        }
      }
    }

    // Update Belt Position
    if (this.lastState && this.lastState.belt) {
      const b = this.lastState.belt;
      if (b.onPedestal) {
        this.belt.root.position.set(b.x, b.y, b.z);
        this.belt.update(dt, true);
      } else {
        const holderModel = this.characters.get(b.holderId || this.hunterId);
        if (holderModel) {
          // Snap belt to Hunter's right hand socket
          const socketWorldPos = new THREE.Vector3();
          holderModel.handSocket.getWorldPosition(socketWorldPos);
          this.belt.root.position.copy(socketWorldPos);
          this.belt.root.quaternion.copy(holderModel.root.quaternion);
          this.belt.update(dt, false);
        } else {
          this.belt.root.position.set(b.x, b.y, b.z);
          this.belt.update(dt, false);
        }
      }
    }

    // Update Third Person Camera
    this.thirdPersonCam.update(dt);

    // Update Arena lighting transitions (Lights ON / Blackout / Warning)
    this.arena.updatePhaseVisuals(this.currentPhase, this.lastState?.phaseTimer || 0, dt);

    // Update Particle Effects
    this.effects.update(dt);

    // Render Scene
    this.renderer.render(this.arena.scene, this.camera);
  }
}

// Initialize on window load
window.addEventListener('DOMContentLoaded', () => {
  new BeltPanicGame();
});
