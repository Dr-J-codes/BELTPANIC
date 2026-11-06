# 👑 BELT PANIC!

A colourful, goofy, cartoonish 3D multiplayer party game inspired by *Fall Guys* and *Stumble Guys*.

---

## 🎮 Game Concept

All players spawn inside an enclosed 3D arena. In the exact centre sits a pedestal bearing the legendary **Golden Belt**.
- **The Belt Rush**: Players rush to grab the belt. The first player to touch it becomes the **HUNTER**.
- **☀️ Lights ON (Hunt Phase)**:
  - Room lights are fully ON.
  - The Hunter chases survivors and swings the belt with **Left Click** to tag and stun them.
  - Survivors dodge, jump, and hide behind lockers, crates, pillars, and tables.
- **🌑 Blackout (Reverse Hunt Phase)**:
  - The lights switch OFF!
  - Hunter loses visibility.
  - Survivors sneak up to the Hunter and **hold [E] for 1 second** to **STEAL THE BELT**!
  - The stealer becomes the pending Hunter in secret.
- **⚠️ Lights Return**:
  - A warning buzzer sounds and emergency lights flicker for 2 seconds.
  - Lights slam back ON and reveal the **NEW HUNTER**!
  - The frantic chase begins anew!

---

## 🕹️ Controls

| Action | Control |
|---|---|
| **Move** | `W`, `A`, `S`, `D` or Arrow Keys |
| **Look / Rotate Camera** | Mouse (Strict Third-Person Camera with obstacle collision) |
| **Jump** | `Space` |
| **Swing Belt** *(Hunter)* | `Left Mouse Button` |
| **Steal Belt** *(Blackout)* | Hold `E` for 1s within 2.4m of Hunter |

---

## 🚀 Quick Start

### 1. Start the Game Server
```bash
npm start
```
The authoritative multiplayer server will run at:
👉 **http://localhost:3000**

### 2. Play
Open `http://localhost:3000` in your browser:
- Enter your nickname.
- Click **"PLAY NOW"** to join an online multiplayer match.
- Or click **"PLAY WITH BOTS"** to instantly jump into a lively match filled with goofy AI bots.
- Customise your chunky character's skin colour, hats (👑 Crown, 🥳 Party, 🚁 Propeller, 👨‍🍳 Chef, 😈 Horns, 🧢 Beanie) in the **"CUSTOMISE"** screen with a live 3D rotating preview!

### 3. Run Automated Tests
```bash
npm test
```
Executes the comprehensive automated multiplayer test suite with 4 simultaneous simulated WebSocket clients testing belt pickups, hit arcs, stun mechanics, blackout stealth stealing, lights return reveals, and hunter disconnect safety.

---

## 🛠️ Architecture

- **Engine**: Three.js (WebGL 3D graphics, procedural chunky characters, dynamic arena lighting, comic particle effects).
- **Camera**: Strict 3rd-person follow camera with spherical raycast collision avoidance (never clips through walls or props).
- **Audio Engine**: Procedural Web Audio API sound synthesizer (whacks, swooshes, star chimes, buzzers, party soundtrack). Zero external asset dependencies.
- **Backend**: Node.js + Authoritative WebSocket server (`ws`) with tick rate synchronization, lag compensation, and hit/steal validation.
- **Bot AI**: Autonomous goofy AI agents with pathfinding, chasing, evasion, stealth belt-stealing, and panic jumping.

