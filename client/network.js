// Multiplayer WebSocket Network Client for Belt Panic!

export function getBackendHttpUrl() {
  // 1. URL search parameter: ?server=https://my-backend.onrender.com
  const urlParam = new URLSearchParams(window.location.search).get('server');
  if (urlParam) return urlParam.replace(/\/+$/, '');

  // 2. Saved user server URL from Settings
  const stored = localStorage.getItem('beltpanic_server_url');
  if (stored && stored.trim()) return stored.trim().replace(/\/+$/, '');

  // 3. Vite environment variable set on Vercel: VITE_BACKEND_URL
  const envUrl = import.meta.env?.VITE_BACKEND_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');

  // 4. Localhost development fallback
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  // 5. Default origin fallback
  return `${window.location.protocol}//${window.location.host}`;
}

export function getBackendWsUrl() {
  const httpUrl = getBackendHttpUrl();
  let wsUrl = httpUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + wsUrl;
  }
  if (!wsUrl.endsWith('/ws')) {
    wsUrl = wsUrl.replace(/\/+$/, '') + '/ws';
  }
  return wsUrl;
}

export class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.localPlayerId = null;
    this.currentRoomId = null;
    this.pingMs = 0;
    this.lastPingTime = 0;
    this.serverWsUrl = '';

    this.stateBuffer = []; // snapshots for interpolation
    this.listeners = new Map();
  }

  connect(customUrl = null) {
    return new Promise((resolve, reject) => {
      this.serverWsUrl = customUrl || getBackendWsUrl();
      console.log(`[Network] Connecting to authoritative server at: ${this.serverWsUrl}`);

      let connectionTimedOut = false;
      const timeoutId = setTimeout(() => {
        connectionTimedOut = true;
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error('Connection timed out. (If using Render Free tier, the server may take ~30-60s to wake up from idle!)'));
        }
      }, 15000);

      try {
        this.ws = new WebSocket(this.serverWsUrl);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('WebSocket creation error:', err);
        return reject(err);
      }

      this.ws.onopen = () => {
        clearTimeout(timeoutId);
        if (connectionTimedOut) return;
        this.connected = true;
        this._startPingLoop();
        this._emit('connected', { url: this.serverWsUrl });
        resolve();
      };

      this.ws.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error('WebSocket connection error:', err);
        reject(new Error('Could not connect to game server. Please verify your Render server URL is awake!'));
      };

      this.ws.onclose = () => {
        clearTimeout(timeoutId);
        this.connected = false;
        this._emit('disconnected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };
    });
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  _emit(eventName, data) {
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      for (const cb of handlers) {
        cb(data);
      }
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  joinRoom(roomId, playerName, skin) {
    this.send('JOIN_ROOM', { roomId, name: playerName, skin });
  }

  sendInput(input) {
    this.send('PLAYER_INPUT', { input });
  }

  startMatch() {
    this.send('START_MATCH');
  }

  addBots(count = 3) {
    this.send('ADD_BOTS', { count });
  }

  leaveRoom() {
    this.send('LEAVE_ROOM');
    this.localPlayerId = null;
    this.currentRoomId = null;
    this.stateBuffer = [];
  }

  clearBots() {
    this.send('CLEAR_BOTS');
  }

  _startPingLoop() {
    setInterval(() => {
      if (this.connected) {
        this.lastPingTime = performance.now();
        this.send('PING', { timestamp: this.lastPingTime });
      }
    }, 2000);
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'JOINED_SUCCESS':
        this.localPlayerId = msg.playerId;
        this.currentRoomId = msg.roomId;
        this._emit('joined', msg);
        break;

      case 'PONG':
        this.pingMs = Math.round(performance.now() - this.lastPingTime);
        this._emit('ping', this.pingMs);
        break;

      case 'STATE_UPDATE':
        this._pushSnapshot(msg);
        this._emit('state', msg);
        break;

      case 'PHASE_CHANGE':
        this._emit('phase_change', msg);
        break;

      case 'BELT_PICKED_UP':
        this._emit('belt_picked_up', msg);
        break;

      case 'BELT_SWING':
        this._emit('belt_swing', msg);
        break;

      case 'PLAYER_TAGGED':
        this._emit('player_tagged', msg);
        break;

      case 'BELT_STOLEN':
        this._emit('belt_stolen', msg);
        break;

      case 'MATCH_OVER':
        this._emit('match_over', msg);
        break;

      case 'HUNTER_DISCONNECTED':
        this._emit('hunter_disconnected', msg);
        break;

      case 'PLAYER_JOINED':
        this._emit('player_joined', msg.player);
        break;

      case 'PLAYER_LEFT':
        this._emit('player_left', msg.playerId);
        break;

      case 'RETURNED_TO_LOBBY':
        this._emit('returned_to_lobby', msg);
        break;

      default:
        break;
    }
  }

  _pushSnapshot(snapshot) {
    snapshot.receiveTime = performance.now();
    this.stateBuffer.push(snapshot);
    if (this.stateBuffer.length > 20) {
      this.stateBuffer.shift();
    }
  }

  getInterpolatedPlayers() {
    if (this.stateBuffer.length === 0) return null;
    if (this.stateBuffer.length === 1) return this.stateBuffer[0].players;

    // Render slightly behind server time for smooth interpolation (~100ms)
    const renderTime = performance.now() - 100;

    // Find the two snapshots surrounding renderTime
    let older = this.stateBuffer[0];
    let newer = this.stateBuffer[this.stateBuffer.length - 1];

    for (let i = 0; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i].receiveTime <= renderTime && this.stateBuffer[i + 1].receiveTime >= renderTime) {
        older = this.stateBuffer[i];
        newer = this.stateBuffer[i + 1];
        break;
      }
    }

    const duration = newer.receiveTime - older.receiveTime;
    const factor = duration > 0 ? Math.min(1, Math.max(0, (renderTime - older.receiveTime) / duration)) : 1;

    // Create map of interpolated positions
    const olderMap = new Map(older.players.map((p) => [p.id, p]));
    const result = [];

    for (const np of newer.players) {
      const op = olderMap.get(np.id);
      if (op) {
        // Lerp position
        const interp = {
          ...np,
          x: op.x + (np.x - op.x) * factor,
          y: op.y + (np.y - op.y) * factor,
          z: op.z + (np.z - op.z) * factor,
          // Shortest angle slerp
          angle: this._lerpAngle(op.angle, np.angle, factor),
        };
        result.push(interp);
      } else {
        result.push(np);
      }
    }

    return result;
  }

  _lerpAngle(a, b, t) {
    let diff = (b - a) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }
}

