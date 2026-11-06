// 3D Arena Scene and Environment for Belt Panic!
import * as THREE from 'three';
import { ARENA, GAME_PHASES } from '../../server/constants.js';

export class ArenaScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x161326);
    this.scene.fog = new THREE.FogExp2(0x161326, 0.015);

    this.lights = {};
    this.ceilingFixtures = [];
    this.warningFlickerTime = 0;

    this._buildLighting();
    this._buildFloorAndWalls();
    this._buildPedestal();
    this._buildProps();
  }

  _buildLighting() {
    // Ambient light (base level)
    this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.lights.ambient);

    // Main stadium directional light (bright sunlight / arena floodlight)
    this.lights.main = new THREE.DirectionalLight(0xfff4e0, 1.4);
    this.lights.main.position.set(15, 25, 12);
    this.lights.main.castShadow = true;
    this.lights.main.shadow.mapSize.width = 1024;
    this.lights.main.shadow.mapSize.height = 1024;
    this.lights.main.shadow.camera.near = 0.5;
    this.lights.main.shadow.camera.far = 60;
    const d = 24;
    this.lights.main.shadow.camera.left = -d;
    this.lights.main.shadow.camera.right = d;
    this.lights.main.shadow.camera.top = d;
    this.lights.main.shadow.camera.bottom = -d;
    this.lights.main.shadow.bias = -0.001;
    this.scene.add(this.lights.main);

    // Central spotlight shining directly onto the belt pedestal
    this.lights.pedestalSpot = new THREE.SpotLight(0xfffae6, 3.5, 30, Math.PI / 6, 0.4, 1);
    this.lights.pedestalSpot.position.set(0, 12, 0);
    this.lights.pedestalSpot.target.position.set(0, 0, 0);
    this.scene.add(this.lights.pedestalSpot);
    this.scene.add(this.lights.pedestalSpot.target);

    // Warning alarm flashing light
    this.lights.alarm = new THREE.PointLight(0xff1122, 0, 30);
    this.lights.alarm.position.set(0, 9, 0);
    this.scene.add(this.lights.alarm);
  }

  _buildFloorAndWalls() {
    const size = ARENA.HALF_SIZE * 2;

    // Floor with checkerboard party-grid pattern
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#3a3e5e';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);

    const floorTexture = new THREE.CanvasTexture(canvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(16, 16);

    const floorGeo = new THREE.PlaneGeometry(size, size);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.6,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Wall Materials
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a4e69,
      roughness: 0.7,
      metalness: 0.1,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xffb703, // bright yellow trim
      roughness: 0.4,
    });

    const wallHeight = ARENA.WALL_HEIGHT;
    const wallGeoX = new THREE.BoxGeometry(size, wallHeight, 1.0);
    const wallGeoZ = new THREE.BoxGeometry(1.0, wallHeight, size);

    // North wall
    const wallN = new THREE.Mesh(wallGeoX, wallMat);
    wallN.position.set(0, wallHeight / 2, -ARENA.HALF_SIZE - 0.5);
    wallN.receiveShadow = true;
    this.scene.add(wallN);

    // South wall
    const wallS = new THREE.Mesh(wallGeoX, wallMat);
    wallS.position.set(0, wallHeight / 2, ARENA.HALF_SIZE + 0.5);
    wallS.receiveShadow = true;
    this.scene.add(wallS);

    // West wall
    const wallW = new THREE.Mesh(wallGeoZ, wallMat);
    wallW.position.set(-ARENA.HALF_SIZE - 0.5, wallHeight / 2, 0);
    wallW.receiveShadow = true;
    this.scene.add(wallW);

    // East wall
    const wallE = new THREE.Mesh(wallGeoZ, wallMat);
    wallE.position.set(ARENA.HALF_SIZE + 0.5, wallHeight / 2, 0);
    wallE.receiveShadow = true;
    this.scene.add(wallE);

    // Wall top trim banners
    const trimTopGeo = new THREE.BoxGeometry(size + 2, 0.4, 1.4);
    const trimN = new THREE.Mesh(trimTopGeo, trimMat);
    trimN.position.set(0, wallHeight, -ARENA.HALF_SIZE - 0.5);
    this.scene.add(trimN);
    const trimS = new THREE.Mesh(trimTopGeo, trimMat);
    trimS.position.set(0, wallHeight, ARENA.HALF_SIZE + 0.5);
    this.scene.add(trimS);

    // Funny Arena Posters
    this._addPoster('DON\'T DROP THE BELT!', -12, 3.5, -ARENA.HALF_SIZE + 0.05, 0, '#ff0055');
    this._addPoster('WATCH OUT FOR HUNTERS!', 12, 3.5, -ARENA.HALF_SIZE + 0.05, 0, '#06d6a0');
    this._addPoster('SNEAK & STEAL!', -ARENA.HALF_SIZE + 0.05, 3.5, 0, Math.PI / 2, '#ffd166');
    this._addPoster('BELT PANIC ARENA', ARENA.HALF_SIZE - 0.05, 3.5, 0, -Math.PI / 2, '#8338ec');
  }

  _addPoster(text, x, y, z, rotY, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Poster background
    ctx.fillStyle = bgColor;
    ctx.roundRect(10, 10, 492, 236, 24);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const posterGeo = new THREE.PlaneGeometry(5.0, 2.5);
    const posterMat = new THREE.MeshBasicMaterial({ map: texture });
    const poster = new THREE.Mesh(posterGeo, posterMat);
    poster.position.set(x, y, z);
    poster.rotation.y = rotY;
    this.scene.add(poster);
  }

  _buildPedestal() {
    const pedGroup = new THREE.Group();
    pedGroup.position.set(ARENA.PEDESTAL.x, 0, ARENA.PEDESTAL.z);

    // Stepped circular podium
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d348b, roughness: 0.4 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xff006e, roughness: 0.3 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xffbe0b, roughness: 0.2, metalness: 0.5 });

    // Lower tier
    const lowerGeo = new THREE.CylinderGeometry(ARENA.PEDESTAL.radius, ARENA.PEDESTAL.radius + 0.4, 0.45, 32);
    lowerGeo.translate(0, 0.225, 0);
    const lowerMesh = new THREE.Mesh(lowerGeo, baseMat);
    lowerMesh.receiveShadow = true;
    lowerMesh.castShadow = true;
    pedGroup.add(lowerMesh);

    // Upper tier
    const upperGeo = new THREE.CylinderGeometry(ARENA.PEDESTAL.radius - 0.6, ARENA.PEDESTAL.radius - 0.4, 0.55, 32);
    upperGeo.translate(0, 0.45 + 0.275, 0);
    const upperMesh = new THREE.Mesh(upperGeo, topMat);
    upperMesh.receiveShadow = true;
    upperMesh.castShadow = true;
    pedGroup.add(upperMesh);

    // Gold decorative rim
    const rimGeo = new THREE.TorusGeometry(ARENA.PEDESTAL.radius - 0.55, 0.08, 12, 32);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, 1.0, 0);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    pedGroup.add(rimMesh);

    // Center star decal on pedestal top
    const starGeo = new THREE.CircleGeometry(1.2, 16);
    starGeo.rotateX(-Math.PI / 2);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffbe0b });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.y = 1.01;
    pedGroup.add(starMesh);

    this.scene.add(pedGroup);
  }

  _buildProps() {
    // Shared Materials
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x06d6a0, roughness: 0.3 });
    const lockerMat1 = new THREE.MeshStandardMaterial({ color: 0x118ab2, roughness: 0.4 });
    const lockerMat2 = new THREE.MeshStandardMaterial({ color: 0xff477e, roughness: 0.4 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
    const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xc89d67, roughness: 0.8 });
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x5a3e1b, roughness: 0.5 });
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x22223b, roughness: 0.5 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.6 });
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.5 });

    for (const obs of ARENA.OBSTACLES) {
      if (obs.type === 'cylinder' && obs.name.startsWith('Pillar')) {
        // Chunky colourful pillar
        const pilGeo = new THREE.CylinderGeometry(obs.radius, obs.radius, obs.height, 24);
        pilGeo.translate(0, obs.height / 2, 0);
        const pilMesh = new THREE.Mesh(pilGeo, pillarMat);
        pilMesh.position.set(obs.x, 0, obs.z);
        pilMesh.castShadow = true;
        pilMesh.receiveShadow = true;
        this.scene.add(pilMesh);

        // Pillar ring accents
        const ringGeo = new THREE.TorusGeometry(obs.radius + 0.05, 0.08, 8, 24);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.position.set(obs.x, 2.0, obs.z);
        const ring2 = ring1.clone();
        ring2.position.set(obs.x, 4.5, obs.z);
        this.scene.add(ring1, ring2);
      } else if (obs.type === 'box' && obs.name.startsWith('Locker')) {
        // Bank of lockers
        const mat = obs.name.includes('West') ? lockerMat1 : lockerMat2;
        const lockerGeo = new THREE.BoxGeometry(obs.sx, obs.sy, obs.sz);
        lockerGeo.translate(0, obs.sy / 2, 0);
        const lockerMesh = new THREE.Mesh(lockerGeo, mat);
        lockerMesh.position.set(obs.x, 0, obs.z);
        lockerMesh.castShadow = true;
        lockerMesh.receiveShadow = true;
        this.scene.add(lockerMesh);

        // Locker door vents & handles
        for (let i = -obs.sz / 2 + 0.8; i <= obs.sz / 2 - 0.8; i += 1.5) {
          const ventGeo = new THREE.BoxGeometry(obs.sx + 0.05, 0.15, 0.8);
          const ventMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
          const vent = new THREE.Mesh(ventGeo, ventMat);
          vent.position.set(obs.x, obs.sy * 0.75, obs.z + i);
          this.scene.add(vent);
        }
      } else if (obs.type === 'box' && obs.name.startsWith('Crate')) {
        // Stacked Wooden and Cardboard crates
        const crateGroup = new THREE.Group();
        crateGroup.position.set(obs.x, 0, obs.z);

        const isCardboard = obs.name.includes('East') || obs.name.includes('South');
        const cMat = isCardboard ? cardboardMat : crateMat;

        const mainCrate = new THREE.Mesh(new THREE.BoxGeometry(obs.sx, obs.sy, obs.sz), cMat);
        mainCrate.position.y = obs.sy / 2;
        mainCrate.castShadow = true;
        mainCrate.receiveShadow = true;
        crateGroup.add(mainCrate);

        // Smaller crate on top for playful asymmetry
        const topCrate = new THREE.Mesh(new THREE.BoxGeometry(obs.sx * 0.65, obs.sy * 0.65, obs.sz * 0.65), isCardboard ? crateMat : cardboardMat);
        topCrate.position.set(0.2, obs.sy + (obs.sy * 0.65) / 2, -0.1);
        topCrate.rotation.y = 0.3;
        topCrate.castShadow = true;
        crateGroup.add(topCrate);

        this.scene.add(crateGroup);
      } else if (obs.type === 'box' && obs.name.startsWith('Table')) {
        // Table with room to duck/hide behind
        const tableGroup = new THREE.Group();
        tableGroup.position.set(obs.x, 0, obs.z);

        // Table top
        const topGeo = new THREE.BoxGeometry(obs.sx, 0.25, obs.sz);
        const topMesh = new THREE.Mesh(topGeo, tableMat);
        topMesh.position.y = obs.sy - 0.125;
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        tableGroup.add(topMesh);

        // 4 Legs
        const legGeo = new THREE.CylinderGeometry(0.12, 0.12, obs.sy - 0.25, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
        const hx = obs.sx / 2 - 0.3;
        const hz = obs.sz / 2 - 0.3;
        [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(lx, (obs.sy - 0.25) / 2, lz);
          leg.castShadow = true;
          tableGroup.add(leg);
        });

        this.scene.add(tableGroup);
      } else if (obs.type === 'box' && obs.name.startsWith('Shelf')) {
        // Shelf unit
        const shelfGeo = new THREE.BoxGeometry(obs.sx, obs.sy, obs.sz);
        shelfGeo.translate(0, obs.sy / 2, 0);
        const shelfMesh = new THREE.Mesh(shelfGeo, shelfMat);
        shelfMesh.position.set(obs.x, 0, obs.z);
        shelfMesh.castShadow = true;
        shelfMesh.receiveShadow = true;
        this.scene.add(shelfMesh);
      } else if (obs.type === 'cylinder' && obs.name.startsWith('Plant')) {
        // Giant potted plant
        const plantGroup = new THREE.Group();
        plantGroup.position.set(obs.x, 0, obs.z);

        // Clay Pot
        const potGeo = new THREE.CylinderGeometry(obs.radius * 0.9, obs.radius * 0.65, 1.4, 16);
        potGeo.translate(0, 0.7, 0);
        const pot = new THREE.Mesh(potGeo, potMat);
        pot.castShadow = true;
        plantGroup.add(pot);

        // Chunky Foliage (spherical clusters)
        const leafGeo = new THREE.SphereGeometry(obs.radius * 0.9, 8, 8);
        leafGeo.scale(1.0, 1.2, 1.0);
        const foliage1 = new THREE.Mesh(leafGeo, plantMat);
        foliage1.position.set(0, 2.0, 0);
        foliage1.castShadow = true;
        plantGroup.add(foliage1);

        const foliage2 = foliage1.clone();
        foliage2.position.set(0.3, 2.4, 0.2);
        foliage2.scale.set(0.7, 0.7, 0.7);
        plantGroup.add(foliage2);

        this.scene.add(plantGroup);
      }
    }

    // Ceiling Lights fixtures suspended from ceiling
    const lampPositions = [
      [-10, 6.2, -10],
      [10, 6.2, -10],
      [-10, 6.2, 10],
      [10, 6.2, 10],
    ];
    for (const [lx, ly, lz] of lampPositions) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      rod.position.set(lx, ly + 0.75, lz);
      this.scene.add(rod);

      const bulbGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xffffea,
        emissive: 0xfff4c2,
        emissiveIntensity: 1.0,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(lx, ly, lz);
      this.ceilingFixtures.push(bulb);
      this.scene.add(bulb);
    }
  }

  updatePhaseVisuals(phase, phaseTimer, dt) {
    if (phase === GAME_PHASES.LIGHTS_ON || phase === GAME_PHASES.RUSH || phase === GAME_PHASES.LOBBY) {
      // FULL LIGHTS ON!
      this.lights.ambient.intensity = 0.75;
      this.lights.ambient.color.setHex(0xffffff);
      this.lights.main.intensity = 1.4;
      this.lights.pedestalSpot.intensity = 3.5;
      this.lights.alarm.intensity = 0;
      this.scene.fog.color.setHex(0x161326);
      this.scene.fog.density = 0.015;

      for (const bulb of this.ceilingFixtures) {
        bulb.material.emissiveIntensity = 1.0;
      }
    } else if (phase === GAME_PHASES.BLACKOUT) {
      // BLACKOUT PHASE: Moody dim lighting for stealth navigation
      this.lights.ambient.intensity = 0.08;
      this.lights.ambient.color.setHex(0x3a4066);
      this.lights.main.intensity = 0.02;
      this.lights.pedestalSpot.intensity = 0.3;
      this.lights.alarm.intensity = 0;
      this.scene.fog.color.setHex(0x0a0814);
      this.scene.fog.density = 0.035;

      for (const bulb of this.ceilingFixtures) {
        bulb.material.emissiveIntensity = 0.05;
      }
    } else if (phase === GAME_PHASES.LIGHTS_WARN) {
      // WARNING STROBE / FLICKER: 2 seconds before lights return!
      this.warningFlickerTime += dt * 12;
      const flicker = Math.sin(this.warningFlickerTime) > 0 ? 1 : 0;

      this.lights.ambient.intensity = 0.15 + flicker * 0.35;
      this.lights.ambient.color.setHex(0xff3355);
      this.lights.main.intensity = flicker * 0.6;
      this.lights.alarm.intensity = flicker * 4.0;
      this.scene.fog.color.setHex(0x2a0814);

      for (const bulb of this.ceilingFixtures) {
        bulb.material.emissiveIntensity = flicker * 1.5;
      }
    }
  }
}

