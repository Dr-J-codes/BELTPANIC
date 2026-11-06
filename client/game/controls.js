// Controls and Input Handler for Belt Panic!

export class InputControls {
  constructor(canvas, cameraController) {
    this.canvas = canvas;
    this.cameraController = cameraController;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      steal: false,
    };

    this.mouseButtons = {
      swing: false,
    };

    this.isPointerLocked = false;
    this.isMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      this._handleKey(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this._handleKey(e.code, false);
    });

    // Pointer Lock and Mouse Look
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock().catch(() => {});
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.cameraController.onMouseMove(e.movementX, e.movementY);
      } else if (this.isMouseDown) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.cameraController.onMouseMove(dx, dy);
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseButtons.swing = true;
      }
      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseButtons.swing = false;
      }
      this.isMouseDown = false;
    });
  }

  _handleKey(code, isDown) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isDown;
        break;
      case 'Space':
        this.keys.jump = isDown;
        break;
      case 'KeyE':
        this.keys.steal = isDown;
        break;
      default:
        break;
    }
  }

  getMovementVector() {
    // Relative to camera yaw
    let forward = 0;
    let right = 0;

    if (this.keys.forward) forward += 1;
    if (this.keys.backward) forward -= 1;
    if (this.keys.left) right -= 1;
    if (this.keys.right) right += 1;

    // Camera yaw: camera looking direction
    const yaw = this.cameraController.yaw;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);

    // Forward angle where the camera is looking
    const camForwardAngle = Math.atan2(-sin, -cos);

    if (forward === 0 && right === 0) {
      // When stationary, face the forward direction of the camera view
      return { x: 0, z: 0, angle: camForwardAngle };
    }

    // Forward vector in world space: (-sin, -cos)
    // Right vector in world space: (cos, -sin)
    const worldX = -forward * sin + right * cos;
    const worldZ = -forward * cos - right * sin;

    const len = Math.hypot(worldX, worldZ);
    const normX = worldX / len;
    const normZ = worldZ / len;

    // Character heading angle
    const angle = Math.atan2(normX, normZ);

    return { x: normX, z: normZ, angle };
  }

  collectInput() {
    const move = this.getMovementVector();
    const swing = this.mouseButtons.swing;
    this.mouseButtons.swing = false; // consume single click swing trigger

    return {
      x: move.x,
      z: move.z,
      jump: this.keys.jump,
      swing,
      steal: this.keys.steal,
      angle: move.angle,
    };
  }
}

