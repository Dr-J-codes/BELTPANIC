// Strict Third-Person Camera with Collision Detection for Belt Panic!
import * as THREE from 'three';
import { ARENA } from '../../server/constants.js';

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = null; // Character root / position to follow

    // Camera orbit parameters
    this.yaw = 0; // horizontal angle
    this.pitch = 0.28; // vertical angle (radians)
    this.defaultDistance = 5.5; // ideal distance behind player
    this.currentDistance = 5.5;
    this.minDistance = 1.8;
    this.maxDistance = 7.0;

    this.heightOffset = 1.4; // look-at target height above character base

    this.currentLookAt = new THREE.Vector3();
    this.currentCamPos = new THREE.Vector3();

    // Reusable temp vectors for collision raycasting
    this.rayOrigin = new THREE.Vector3();
    this.desiredPos = new THREE.Vector3();
    this.rayDir = new THREE.Vector3();

    this.mouseSensitivity = 0.0028;
  }

  setTarget(targetGroup) {
    this.target = targetGroup;
    if (this.target) {
      this.currentLookAt.copy(this.target.position).add(new THREE.Vector3(0, this.heightOffset, 0));
      this._computeDesiredPosition(this.desiredPos, this.defaultDistance);
      this.currentCamPos.copy(this.desiredPos);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  onMouseMove(deltaX, deltaY) {
    this.yaw -= deltaX * this.mouseSensitivity;
    this.pitch += deltaY * this.mouseSensitivity;

    // Clamp pitch so camera stays behind/above and doesn't flip or hit floor
    const minPitch = -0.15; // slightly looking up
    const maxPitch = 1.15; // ~65 degrees looking down
    this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
  }

  update(dt) {
    if (!this.target) return;

    // Smooth target follow point (eye/chest level of character)
    const targetLookAt = new THREE.Vector3(
      this.target.position.x,
      this.target.position.y + this.heightOffset,
      this.target.position.z
    );

    const lerpSpeed = 14.0 * dt;
    this.currentLookAt.lerp(targetLookAt, Math.min(1.0, lerpSpeed));

    // Calculate desired position in spherical coords
    this._computeDesiredPosition(this.desiredPos, this.defaultDistance);

    // Camera Collision Detection: prevent passing through arena walls and obstacles
    const safeDistance = this._checkCameraCollision(this.currentLookAt, this.desiredPos);
    this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, safeDistance, Math.min(1.0, 20.0 * dt));

    this._computeDesiredPosition(this.desiredPos, this.currentDistance);

    // Smooth camera position
    this.currentCamPos.lerp(this.desiredPos, Math.min(1.0, lerpSpeed));
    this.camera.position.copy(this.currentCamPos);

    // Always keep character in view
    this.camera.lookAt(this.currentLookAt);
  }

  _computeDesiredPosition(outVec, distance) {
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const offsetX = sinYaw * cosPitch * distance;
    const offsetY = sinPitch * distance;
    const offsetZ = cosYaw * cosPitch * distance;

    outVec.set(
      this.currentLookAt.x + offsetX,
      this.currentLookAt.y + offsetY,
      this.currentLookAt.z + offsetZ
    );
  }

  _checkCameraCollision(origin, desired) {
    let maxDist = this.defaultDistance;

    this.rayDir.subVectors(desired, origin).normalize();
    const margin = 0.35; // safe margin from wall

    // 1. Arena Outer Wall collisions (-20 to 20)
    const bound = ARENA.HALF_SIZE - margin;
    const wallPlanes = [
      { normal: new THREE.Vector3(1, 0, 0), d: -bound }, // left x = -bound
      { normal: new THREE.Vector3(-1, 0, 0), d: -bound }, // right x = bound
      { normal: new THREE.Vector3(0, 0, 1), d: -bound }, // back z = -bound
      { normal: new THREE.Vector3(0, 0, -1), d: -bound }, // front z = bound
    ];

    for (const plane of wallPlanes) {
      const denom = plane.normal.dot(this.rayDir);
      if (Math.abs(denom) > 0.0001) {
        const t = -(plane.normal.dot(origin) + plane.d) / denom;
        if (t > 0 && t < maxDist) {
          maxDist = Math.max(this.minDistance, t - margin);
        }
      }
    }

    // Floor collision
    if (desired.y < 0.4) {
      const t = (0.4 - origin.y) / this.rayDir.y;
      if (t > 0 && t < maxDist) {
        maxDist = Math.max(this.minDistance, t);
      }
    }

    // 2. Obstacles (boxes & cylinders)
    for (const obs of ARENA.OBSTACLES) {
      if (obs.type === 'cylinder') {
        // Line-cylinder 2D intersection
        const ox = origin.x - obs.x;
        const oz = origin.z - obs.z;
        const dx = this.rayDir.x;
        const dz = this.rayDir.z;
        const r = obs.radius + margin;

        const a = dx * dx + dz * dz;
        const b = 2 * (ox * dx + oz * dz);
        const c = ox * ox + oz * oz - r * r;
        const disc = b * b - 4 * a * c;

        if (disc >= 0 && a > 0.0001) {
          const sqrtDisc = Math.sqrt(disc);
          const t1 = (-b - sqrtDisc) / (2 * a);
          if (t1 > 0 && t1 < maxDist) {
            const hitY = origin.y + this.rayDir.y * t1;
            if (hitY >= 0 && hitY <= obs.height) {
              maxDist = Math.max(this.minDistance, t1 - margin);
            }
          }
        }
      } else if (obs.type === 'box') {
        const halfX = obs.sx / 2 + margin;
        const halfZ = obs.sz / 2 + margin;
        const minX = obs.x - halfX;
        const maxX = obs.x + halfX;
        const minZ = obs.z - halfZ;
        const maxZ = obs.z + halfZ;
        const maxY = obs.sy;

        // Bounding box ray intersection
        let tmin = 0;
        let tmax = maxDist;

        if (Math.abs(this.rayDir.x) > 0.0001) {
          let tx1 = (minX - origin.x) / this.rayDir.x;
          let tx2 = (maxX - origin.x) / this.rayDir.x;
          if (tx1 > tx2) [tx1, tx2] = [tx2, tx1];
          tmin = Math.max(tmin, tx1);
          tmax = Math.min(tmax, tx2);
        }
        if (Math.abs(this.rayDir.z) > 0.0001) {
          let tz1 = (minZ - origin.z) / this.rayDir.z;
          let tz2 = (maxZ - origin.z) / this.rayDir.z;
          if (tz1 > tz2) [tz1, tz2] = [tz2, tz1];
          tmin = Math.max(tmin, tz1);
          tmax = Math.min(tmax, tz2);
        }

        if (tmax >= tmin && tmin > 0 && tmin < maxDist) {
          const hitY = origin.y + this.rayDir.y * tmin;
          if (hitY >= 0 && hitY <= maxY) {
            maxDist = Math.max(this.minDistance, tmin - margin);
          }
        }
      }
    }

    return Math.min(maxDist, this.defaultDistance);
  }
}

