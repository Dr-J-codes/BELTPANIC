// The Flowy Rope-Like Belt 3D Mesh & Whip Animations for Belt Panic!
import * as THREE from 'three';

export class BeltModel {
  constructor() {
    this.root = new THREE.Group();
    this.animTime = 0;

    // Swing animation state
    this.isSwinging = false;
    this.swingTimer = 0;
    this.swingDuration = 0.45;
    this.swingAngle = 0;

    // Segmented Chain configuration (10 nodes for silky rope/whip dynamics)
    this.numSegments = 10;
    this.segmentLength = 0.18; // total length ~1.8m
    this.chainPoints = [];
    this.chainVelocities = [];

    for (let i = 0; i < this.numSegments; i++) {
      this.chainPoints.push(new THREE.Vector3(0, -i * this.segmentLength, 0));
      this.chainVelocities.push(new THREE.Vector3(0, 0, 0));
    }

    this._buildMesh();
  }

  _buildMesh() {
    // Materials
    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0x443300,
      emissiveIntensity: 0.35,
    });

    this.leatherMat = new THREE.MeshStandardMaterial({
      color: 0x9e121b, // Rich crimson leather strap
      roughness: 0.45,
      metalness: 0.12,
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.rubyMat = new THREE.MeshStandardMaterial({
      color: 0xff0044,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x880022,
      emissiveIntensity: 0.6,
    });

    // 1. Pedestal Display Mesh (shown when resting on the central pedestal)
    this.pedestalDisplay = new THREE.Group();
    this.root.add(this.pedestalDisplay);

    // Championship Center Buckle on Pedestal
    const pedBuckleGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.09, 8);
    pedBuckleGeo.rotateX(Math.PI / 2);
    const pedBuckle = new THREE.Mesh(pedBuckleGeo, this.goldMat);
    pedBuckle.castShadow = true;
    this.pedestalDisplay.add(pedBuckle);

    const pedGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), this.rubyMat);
    pedGem.position.z = 0.06;
    pedBuckle.add(pedGem);

    // Drooping side straps for pedestal
    const pCurveL = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.25, 0, 0),
      new THREE.Vector3(-0.6, -0.08, 0),
      new THREE.Vector3(-0.8, -0.3, 0.06),
      new THREE.Vector3(-0.9, -0.55, 0.1)
    );
    const pStrapL = new THREE.Mesh(new THREE.TubeGeometry(pCurveL, 16, 0.07, 8, false), this.leatherMat);
    pStrapL.castShadow = true;
    this.pedestalDisplay.add(pStrapL);

    const pCurveR = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.25, 0, 0),
      new THREE.Vector3(0.6, -0.08, 0),
      new THREE.Vector3(0.8, -0.3, -0.06),
      new THREE.Vector3(0.9, -0.55, -0.1)
    );
    const pStrapR = new THREE.Mesh(new THREE.TubeGeometry(pCurveR, 16, 0.07, 8, false), this.leatherMat);
    pStrapR.castShadow = true;
    this.pedestalDisplay.add(pStrapR);

    // 2. Dynamic Flowy Rope / Whip Mesh (shown when held by Hunter)
    this.whipDisplay = new THREE.Group();
    this.whipDisplay.visible = false;
    this.root.add(this.whipDisplay);

    // Handle Grip (held in player hand)
    const handleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8);
    const handleMesh = new THREE.Mesh(handleGeo, this.accentMat);
    handleMesh.position.y = 0.05;
    this.whipDisplay.add(handleMesh);

    // Flexible Dynamic Tube Geometry
    this.curve = new THREE.CatmullRomCurve3(this.chainPoints);
    this.curve.curveType = 'centripetal';
    this.tubeGeometry = new THREE.TubeGeometry(this.curve, 32, 0.055, 8, false);
    this.tubeMesh = new THREE.Mesh(this.tubeGeometry, this.leatherMat);
    this.tubeMesh.castShadow = true;
    this.whipDisplay.add(this.tubeMesh);

    // Golden Buckle attached at the swinging tip of the belt whip!
    this.tipBuckleGroup = new THREE.Group();
    this.whipDisplay.add(this.tipBuckleGroup);

    const tipBuckleGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8);
    tipBuckleGeo.rotateX(Math.PI / 2);
    const tipBuckle = new THREE.Mesh(tipBuckleGeo, this.goldMat);
    tipBuckle.castShadow = true;
    this.tipBuckleGroup.add(tipBuckle);

    const tipGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), this.rubyMat);
    tipGem.position.z = 0.05;
    tipBuckle.add(tipGem);

    // Metal Eyelet studs along the belt strap
    this.studMeshes = [];
    for (let i = 2; i < this.numSegments - 1; i += 2) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), this.accentMat);
      this.whipDisplay.add(stud);
      this.studMeshes.push({ mesh: stud, index: i });
    }

    // Motion Slash Arc Mesh (semi-transparent glowing cartoon whip arc)
    const slashGeo = new THREE.RingGeometry(1.2, 2.6, 24, 1, 0, Math.PI * 0.75);
    const slashMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    this.slashMesh = new THREE.Mesh(slashGeo, slashMat);
    this.slashMesh.rotation.x = Math.PI / 2;
    this.slashMesh.position.y = 0.8;
    this.whipDisplay.add(this.slashMesh);

    // Sparkle / Glow light
    this.glowLight = new THREE.PointLight(0xffdd44, 2.5, 5.0);
    this.glowLight.position.set(0, 0.2, 0);
    this.root.add(this.glowLight);
  }

  triggerSwing(directionAngle = 0) {
    this.isSwinging = true;
    this.swingTimer = this.swingDuration;
    this.swingAngle = directionAngle;
  }

  update(dt, onPedestal) {
    this.animTime += dt;

    if (onPedestal) {
      // PEDESTAL IDLE: Float, bob, and rotate
      this.pedestalDisplay.visible = true;
      this.whipDisplay.visible = false;

      this.root.position.y = 1.35 + Math.sin(this.animTime * 3) * 0.15;
      this.root.rotation.y += dt * 1.8;
      this.root.rotation.x = 0.14 + Math.sin(this.animTime * 2) * 0.1;
      this.root.rotation.z = 0;
      this.glowLight.intensity = 2.6 + Math.sin(this.animTime * 5) * 0.8;
      return;
    }

    // HELD IN HAND: Switch to dynamic flowy rope whip
    this.pedestalDisplay.visible = false;
    this.whipDisplay.visible = true;
    this.glowLight.intensity = 1.4;

    // Root point is fixed at hand socket (0, 0, 0 in local space)
    this.chainPoints[0].set(0, 0, 0);

    if (this.isSwinging) {
      this.swingTimer -= dt;
      if (this.swingTimer <= 0) {
        this.isSwinging = false;
        this.swingTimer = 0;
        this.slashMesh.material.opacity = 0;
      }
    }

    if (this.isSwinging) {
      // FLOWY ROPE / WHIP STRIKE KINEMATICS!
      const p = 1.0 - (this.swingTimer / this.swingDuration); // 0.0 to 1.0

      if (p < 0.25) {
        // 1. WIND-UP / COIL BACK:
        // Arm pulls back; belt strap curls backward in an S-curve
        const t = p / 0.25;
        this.slashMesh.material.opacity = 0;

        for (let i = 1; i < this.numSegments; i++) {
          const frac = i / (this.numSegments - 1);
          const coilX = -Math.sin(frac * Math.PI) * 0.35 * t;
          const coilY = -frac * 0.5 - Math.cos(frac * Math.PI * 1.5) * 0.25 * t;
          const coilZ = -frac * 0.8 * t; // coiled behind the player
          this.chainPoints[i].set(coilX, coilY, coilZ);
        }
      } else if (p < 0.72) {
        // 2. EXPLOSIVE WHIP LASH (Transverse wave propagating down the strap!)
        const t = (p - 0.25) / 0.47; // 0 to 1
        const strikeEase = Math.sin((t * Math.PI) / 2);

        // Slash trail visual
        this.slashMesh.material.opacity = Math.sin(t * Math.PI) * 0.75;
        this.slashMesh.rotation.z = -Math.PI * 0.4 + strikeEase * Math.PI * 0.9;

        // Propagate transverse wave from root (i=0) to tip (i=9)
        const waveSpeed = 16.0;
        const currentWaveFront = t * 14.0; // moves down chain

        for (let i = 1; i < this.numSegments; i++) {
          const frac = i / (this.numSegments - 1);
          const segDist = i * 1.2;

          // Wave equation: a travelling impulse that peaks and snaps!
          const wavePhase = currentWaveFront - segDist;
          const waveAmp = Math.max(0, Math.sin(wavePhase)) * Math.exp(-Math.abs(wavePhase - 1.5) * 0.4);

          // Forward whip trajectory
          const forwardReach = frac * 1.85 * strikeEase;
          const lateralArc = Math.sin(frac * Math.PI) * (1.1 - strikeEase * 1.6);
          const verticalDrop = -frac * 0.3 + waveAmp * 0.45;
          const whipSnapZ = forwardReach + waveAmp * 0.8;

          this.chainPoints[i].set(lateralArc, verticalDrop, whipSnapZ);
        }
      } else {
        // 3. RECOIL & ELASTIC SETTLE BACK:
        const t = (p - 0.72) / 0.28; // 0 to 1
        this.slashMesh.material.opacity = (1 - t) * 0.2;

        for (let i = 1; i < this.numSegments; i++) {
          const frac = i / (this.numSegments - 1);
          // Settle back to natural drooping hang
          const restY = -frac * 1.2;
          const restZ = frac * 0.3;
          const restX = Math.sin(this.animTime * 4 + frac * 2) * 0.08 * (1 - t);

          this.chainPoints[i].lerp(new THREE.Vector3(restX, restY, restZ), Math.min(1.0, 12 * dt));
        }
      }
    } else {
      // NATURAL IDLE / RUNNING ROPE PHYSICS:
      // Belt strap gently sways and ripples with movement and breathing
      this.slashMesh.material.opacity = 0;
      const sway = Math.sin(this.animTime * 3.5);
      const ripple = Math.cos(this.animTime * 5.0);

      for (let i = 1; i < this.numSegments; i++) {
        const frac = i / (this.numSegments - 1);
        const targetX = Math.sin(this.animTime * 3.0 + frac * 2.2) * 0.12 * frac;
        const targetY = -frac * 1.15 + Math.abs(sway) * 0.06;
        const targetZ = frac * 0.25 + ripple * 0.08 * frac;

        this.chainPoints[i].lerp(new THREE.Vector3(targetX, targetY, targetZ), Math.min(1.0, 14 * dt));
      }
    }

    // Update CatmullRom Curve and Dynamic Tube Geometry
    this.curve.points = this.chainPoints;
    this.tubeGeometry.dispose();
    this.tubeGeometry = new THREE.TubeGeometry(this.curve, 32, 0.055, 8, false);
    this.tubeMesh.geometry = this.tubeGeometry;

    // Snap Golden Buckle to the tip of the whip
    const tipPoint = this.chainPoints[this.numSegments - 1];
    const prevPoint = this.chainPoints[this.numSegments - 2];
    this.tipBuckleGroup.position.copy(tipPoint);

    // Orient tip buckle along whip tangent
    const dir = new THREE.Vector3().subVectors(tipPoint, prevPoint).normalize();
    if (dir.lengthSq() > 0.001) {
      this.tipBuckleGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }

    // Update metal eyelet studs positions along the strap
    for (const stud of this.studMeshes) {
      const pt = this.chainPoints[stud.index];
      stud.mesh.position.copy(pt);
    }
  }
}
