// Visual Effects and Comic Particles for Belt Panic!
import * as THREE from 'three';

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  spawnHitSparks(pos) {
    const count = 16;
    const colors = [0xff0055, 0xffbe0b, 0x00ffff, 0xffffff];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.OctahedronGeometry(0.12, 0);
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 4.5;
      const p = {
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 2.0 + Math.random() * 4.0,
        vz: Math.sin(angle) * speed,
        rotSpeed: (Math.random() - 0.5) * 15,
        life: 0.6,
        maxLife: 0.6,
      };

      this.scene.add(mesh);
      this.particles.push(p);
    }
  }

  spawnDustPuff(pos) {
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.SphereGeometry(0.15, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x + (Math.random() - 0.5) * 0.4, 0.1, pos.z + (Math.random() - 0.5) * 0.4);

      const p = {
        mesh,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.8 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 1.5,
        life: 0.4,
        maxLife: 0.4,
      };
      this.scene.add(mesh);
      this.particles.push(p);
    }
  }

  spawnStealTether(thiefPos, hunterPos) {
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const mesh = new THREE.Mesh(geo, mat);

    // Spawn between thief and hunter with drift
    const t = Math.random();
    mesh.position.lerpVectors(hunterPos, thiefPos, t);
    mesh.position.y += Math.sin(t * Math.PI) * 0.5;

    const p = {
      mesh,
      vx: (thiefPos.x - hunterPos.x) * 1.5,
      vy: 1.0,
      vz: (thiefPos.z - hunterPos.z) * 1.5,
      life: 0.3,
      maxLife: 0.3,
    };
    this.scene.add(mesh);
    this.particles.push(p);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.8 * dt;

      if (p.rotSpeed) {
        p.mesh.rotation.x += p.rotSpeed * dt;
        p.mesh.rotation.y += p.rotSpeed * dt;
      }

      // Scale down with age
      const ratio = p.life / p.maxLife;
      p.mesh.scale.set(ratio, ratio, ratio);
      if (p.mesh.material.transparent) {
        p.mesh.material.opacity = ratio * 0.6;
      }
    }
  }
}

