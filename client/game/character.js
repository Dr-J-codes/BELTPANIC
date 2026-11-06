// Chunky 3D Cartoon Character Generator & Animator for Belt Panic!
import * as THREE from 'three';

export class CharacterModel {
  constructor(skin = { color: '#ff477e', hat: 'party', face: 'happy' }) {
    this.skin = skin;
    this.root = new THREE.Group();

    this.animTime = 0;
    this.currentAnim = 'idle';
    this.isHunter = false;
    this.isStunned = false;

    // Jump & landing dynamics
    this.wasGrounded = true;
    this.landSquashTimer = 0;
    this.verticalVel = 0;

    // Swing animation state
    this.swingTimer = 0;
    this.maxSwingDuration = 0.45;

    // Facial animation state
    this.blinkTimer = 2.0 + Math.random() * 2.5;
    this.blinkDuration = 0.12;
    this.isBlinking = false;

    this._buildMesh();
  }

  _buildMesh() {
    const mainColor = new THREE.Color(this.skin.color || '#ff477e');
    const bellyColor = mainColor.clone().offsetHSL(0, -0.08, 0.16); // lighter cute belly

    // Materials - toy vinyl / Fall Guys jellybean aesthetic
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.28,
      metalness: 0.08,
    });

    this.bellyMat = new THREE.MeshStandardMaterial({
      color: bellyColor,
      roughness: 0.32,
      metalness: 0.04,
    });

    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x111116 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.65 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x3d0c11 });
    const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.4 });
    const shoeUpperMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.5 });
    const browMat = new THREE.MeshBasicMaterial({ color: 0x222222 });

    // Torso (chunky rounded bean)
    this.torso = new THREE.Group();
    this.torso.position.y = 0.65;
    this.root.add(this.torso);

    const bodyGeo = new THREE.SphereGeometry(0.5, 20, 20);
    bodyGeo.scale(1.0, 1.22, 0.96);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.torso.add(bodyMesh);

    // Belly patch (cute soft contrasting belly)
    const bellyGeo = new THREE.SphereGeometry(0.39, 16, 16);
    bellyGeo.scale(0.86, 0.95, 0.28);
    const bellyMesh = new THREE.Mesh(bellyGeo, this.bellyMat);
    bellyMesh.position.set(0, -0.04, 0.38);
    this.torso.add(bellyMesh);

    // Cute belly button / stitch
    const buttonGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8);
    buttonGeo.rotateX(Math.PI / 2);
    const buttonMesh = new THREE.Mesh(buttonGeo, new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.3 }));
    buttonMesh.position.set(0, -0.12, 0.46);
    this.torso.add(buttonMesh);

    // Head (oversized rounded friendly head)
    this.head = new THREE.Group();
    this.head.position.set(0, 0.74, 0.04);
    this.torso.add(this.head);

    const headGeo = new THREE.SphereGeometry(0.56, 20, 20);
    headGeo.scale(1.12, 1.02, 1.06);
    const headMesh = new THREE.Mesh(headGeo, this.bodyMat);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.head.add(headMesh);

    // Cute Chubby Ear Nubs
    const earGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const earL = new THREE.Mesh(earGeo, this.bodyMat);
    earL.position.set(-0.58, 0.32, 0);
    earL.castShadow = true;
    const earR = new THREE.Mesh(earGeo, this.bodyMat);
    earR.position.set(0.58, 0.32, 0);
    earR.castShadow = true;
    this.head.add(earL, earR);

    // Eyes with Dual Specular Catchlights (Pixar/Toy look!)
    this.eyeL = this._createEye(eyeWhiteMat, eyePupilMat, glintMat);
    this.eyeL.position.set(-0.21, 0.09, 0.49);
    this.head.add(this.eyeL);

    this.eyeR = this._createEye(eyeWhiteMat, eyePupilMat, glintMat);
    this.eyeR.position.set(0.21, 0.09, 0.49);
    this.head.add(this.eyeR);

    // Cute Animated Eyebrows
    const browGeo = new THREE.BoxGeometry(0.16, 0.04, 0.02);
    this.browL = new THREE.Mesh(browGeo, browMat);
    this.browL.position.set(-0.21, 0.26, 0.5);
    this.browL.rotation.z = 0.08;
    this.head.add(this.browL);

    this.browR = new THREE.Mesh(browGeo, browMat);
    this.browR.position.set(0.21, 0.26, 0.5);
    this.browR.rotation.z = -0.08;
    this.head.add(this.browR);

    // Cute Expressive 3D Mouth
    this.mouthGroup = new THREE.Group();
    this.mouthGroup.position.set(0, -0.11, 0.51);
    this.head.add(this.mouthGroup);

    // Default Happy Smile Curve
    const mouthCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.14, 0.04, 0),
      new THREE.Vector3(0, -0.06, 0),
      new THREE.Vector3(0.14, 0.04, 0)
    );
    const mouthTubeGeo = new THREE.TubeGeometry(mouthCurve, 10, 0.028, 8, false);
    this.mouthMesh = new THREE.Mesh(mouthTubeGeo, mouthMat);
    this.mouthGroup.add(this.mouthMesh);

    // Cute Open Mouth Mesh (visible during jumps / screams)
    const openMouthGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.04, 12);
    openMouthGeo.rotateX(Math.PI / 2);
    this.openMouthMesh = new THREE.Mesh(openMouthGeo, mouthMat);
    this.openMouthMesh.visible = false;
    this.mouthGroup.add(this.openMouthMesh);

    // Cute Little Tooth
    const toothGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.position.set(0, 0.03, 0.02);
    this.openMouthMesh.add(tooth);

    // Cute Rosy Cheeks
    const cheekGeo = new THREE.CircleGeometry(0.09, 10);
    const cheekL = new THREE.Mesh(cheekGeo, blushMat);
    cheekL.position.set(-0.36, -0.05, 0.48);
    cheekL.rotation.y = -0.32;
    this.head.add(cheekL);

    const cheekR = new THREE.Mesh(cheekGeo, blushMat);
    cheekR.position.set(0.36, -0.05, 0.48);
    cheekR.rotation.y = 0.32;
    this.head.add(cheekR);

    // Hat Group
    this.hatGroup = new THREE.Group();
    this.hatGroup.position.set(0, 0.54, 0);
    this.head.add(this.hatGroup);
    this._attachHat(this.skin.hat || 'party');

    // Arms with Cute Rounded Hands / Mittens
    const limbMat = this.bodyMat;

    // Left Arm & Mitten Hand
    this.armL = new THREE.Group();
    this.armL.position.set(-0.56, 0.25, 0);
    this._buildArm(this.armL, limbMat, false);
    this.torso.add(this.armL);

    // Right Arm (Belt holder socket) & Mitten Hand
    this.armR = new THREE.Group();
    this.armR.position.set(0.56, 0.25, 0);
    this._buildArm(this.armR, limbMat, true);
    this.torso.add(this.armR);

    // Hand belt socket (located at right mitten palm)
    this.handSocket = new THREE.Group();
    this.handSocket.position.set(0, -0.44, 0.12);
    this.armR.add(this.handSocket);

    // Legs with Chunky Sneakers
    this.legL = new THREE.Group();
    this.legL.position.set(-0.25, -0.4, 0);
    this._buildLeg(this.legL, limbMat, shoeUpperMat, soleMat);
    this.torso.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.25, -0.4, 0);
    this._buildLeg(this.legR, limbMat, shoeUpperMat, soleMat);
    this.torso.add(this.legR);

    // Dizzy Stars (for Stun state)
    this.dizzyGroup = new THREE.Group();
    this.dizzyGroup.position.set(0, 1.45, 0);
    this.dizzyGroup.visible = false;
    this.head.add(this.dizzyGroup);

    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const starGeo = new THREE.OctahedronGeometry(0.12, 0);
    for (let i = 0; i < 4; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      const angle = (i * Math.PI * 2) / 4;
      star.position.set(Math.cos(angle) * 0.48, Math.sin(angle * 2) * 0.12, Math.sin(angle) * 0.48);
      this.dizzyGroup.add(star);
    }

    // Hunter Crown / Aura indicator
    this.hunterAura = new THREE.Group();
    this.hunterAura.position.set(0, 1.55, 0);
    this.hunterAura.visible = false;
    this.head.add(this.hunterAura);

    const haloGeo = new THREE.TorusGeometry(0.52, 0.07, 8, 24);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.hunterAura.add(haloMesh);

    // Dynamic Shadow Blob
    const shadowGeo = new THREE.CircleGeometry(0.68, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.y = 0.02;
    this.root.add(this.shadowMesh);
  }

  _buildArm(armGroup, limbMat, isRight) {
    // Upper arm
    const armGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.36, 10);
    const armMesh = new THREE.Mesh(armGeo, limbMat);
    armMesh.position.y = -0.18;
    armMesh.castShadow = true;
    armGroup.add(armMesh);

    // Cute Mitten Hand
    const handGeo = new THREE.SphereGeometry(0.13, 12, 12);
    handGeo.scale(1.0, 1.15, 0.9);
    const handMesh = new THREE.Mesh(handGeo, limbMat);
    handMesh.position.y = -0.38;
    handMesh.castShadow = true;
    armGroup.add(handMesh);

    // Cute Thumb Nub
    const thumbGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const thumbMesh = new THREE.Mesh(thumbGeo, limbMat);
    thumbMesh.position.set(isRight ? -0.1 : 0.1, -0.36, 0.08);
    armGroup.add(thumbMesh);
  }

  _buildLeg(legGroup, limbMat, shoeUpperMat, soleMat) {
    // Upper leg
    const legGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.34, 10);
    const legMesh = new THREE.Mesh(legGeo, limbMat);
    legMesh.position.y = -0.17;
    legMesh.castShadow = true;
    legGroup.add(legMesh);

    // Chunky Cartoon Sneaker Upper
    const shoeGeo = new THREE.SphereGeometry(0.18, 12, 12);
    shoeGeo.scale(1.05, 0.85, 1.4);
    const shoeMesh = new THREE.Mesh(shoeGeo, shoeUpperMat);
    shoeMesh.position.set(0, -0.34, 0.08);
    shoeMesh.castShadow = true;
    legGroup.add(shoeMesh);

    // Sneaker Toe Cap (white rubber cap)
    const toeGeo = new THREE.SphereGeometry(0.12, 10, 10);
    toeGeo.scale(1.0, 0.75, 0.9);
    const toeMesh = new THREE.Mesh(toeGeo, soleMat);
    toeMesh.position.set(0, -0.35, 0.22);
    legGroup.add(toeMesh);

    // White Rubber Sole Rim
    const soleGeo = new THREE.BoxGeometry(0.28, 0.08, 0.44);
    const soleMesh = new THREE.Mesh(soleGeo, soleMat);
    soleMesh.position.set(0, -0.42, 0.08);
    soleMesh.castShadow = true;
    legGroup.add(soleMesh);
  }

  _createEye(whiteMat, pupilMat, glintMat) {
    const eye = new THREE.Group();

    // Eye White
    const whiteGeo = new THREE.SphereGeometry(0.13, 12, 12);
    whiteGeo.scale(1.0, 1.35, 0.45);
    const white = new THREE.Mesh(whiteGeo, whiteMat);
    eye.add(white);
    eye.whiteMesh = white;

    // Pupil
    const pupilGeo = new THREE.SphereGeometry(0.075, 10, 10);
    pupilGeo.scale(1.0, 1.25, 0.3);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, -0.01, 0.07);
    eye.add(pupil);

    // Specular Catchlight 1 (big glint)
    const glint1Geo = new THREE.CircleGeometry(0.026, 8);
    const glint1 = new THREE.Mesh(glint1Geo, glintMat);
    glint1.position.set(0.025, 0.035, 0.095);
    eye.add(glint1);

    // Specular Catchlight 2 (cute small secondary glint)
    const glint2Geo = new THREE.CircleGeometry(0.013, 6);
    const glint2 = new THREE.Mesh(glint2Geo, glintMat);
    glint2.position.set(-0.02, -0.025, 0.095);
    eye.add(glint2);

    return eye;
  }

  _attachHat(hatType) {
    while (this.hatGroup.children.length > 0) {
      this.hatGroup.remove(this.hatGroup.children[0]);
    }

    if (hatType === 'party') {
      const coneGeo = new THREE.ConeGeometry(0.24, 0.65, 12);
      coneGeo.translate(0, 0.32, 0);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, roughness: 0.28 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.z = -0.15;
      cone.castShadow = true;
      this.hatGroup.add(cone);

      const pomGeo = new THREE.SphereGeometry(0.09, 10, 10);
      const pomMat = new THREE.MeshStandardMaterial({ color: 0xff007f, roughness: 0.4 });
      const pom = new THREE.Mesh(pomGeo, pomMat);
      pom.position.set(-0.08, 0.68, 0);
      pom.castShadow = true;
      this.hatGroup.add(pom);
    } else if (hatType === 'crown') {
      const crownGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.3, 6, 1, true);
      crownGeo.translate(0, 0.15, 0);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.18, metalness: 0.75 });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.castShadow = true;
      this.hatGroup.add(crown);

      // Jewels on crown points
      const jewelMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
      for (let i = 0; i < 6; i++) {
        const jMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), jewelMat);
        const ang = (i * Math.PI * 2) / 6;
        jMesh.position.set(Math.cos(ang) * 0.33, 0.3, Math.sin(ang) * 0.33);
        this.hatGroup.add(jMesh);
      }
    } else if (hatType === 'propeller') {
      const capGeo = new THREE.SphereGeometry(0.36, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.3 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.castShadow = true;
      this.hatGroup.add(cap);

      const propBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      propBar.position.y = 0.4;
      this.hatGroup.add(propBar);

      this.propellerBlades = new THREE.Group();
      this.propellerBlades.position.y = 0.48;
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffbe0b, roughness: 0.3 });
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.09), bladeMat);
      const blade2 = blade1.clone();
      blade2.rotation.y = Math.PI / 2;
      this.propellerBlades.add(blade1, blade2);
      this.hatGroup.add(this.propellerBlades);
    } else if (hatType === 'chef') {
      const puffGeo = new THREE.CylinderGeometry(0.44, 0.32, 0.48, 14);
      puffGeo.translate(0, 0.24, 0);
      const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const puff = new THREE.Mesh(puffGeo, puffMat);
      puff.castShadow = true;
      this.hatGroup.add(puff);
    } else if (hatType === 'horns') {
      const hornGeo = new THREE.ConeGeometry(0.13, 0.42, 10);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.25 });
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.36, 0.16, 0);
      hornL.rotation.z = 0.5;
      hornL.castShadow = true;
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.36, 0.16, 0);
      hornR.rotation.z = -0.5;
      hornR.castShadow = true;
      this.hatGroup.add(hornL, hornR);
    } else if (hatType === 'beanie') {
      const beanieGeo = new THREE.SphereGeometry(0.42, 14, 12, 0, Math.PI * 2, 0, Math.PI / 1.68);
      const beanieMat = new THREE.MeshStandardMaterial({ color: 0x8338ec, roughness: 0.6 });
      const beanie = new THREE.Mesh(beanieGeo, beanieMat);
      beanie.position.y = 0.06;
      beanie.castShadow = true;
      this.hatGroup.add(beanie);
    }
  }

  setSkin(skin) {
    this.skin = skin;
    const col = new THREE.Color(skin.color || '#ff477e');
    this.bodyMat.color.copy(col);
    this.bellyMat.color.copy(col.clone().offsetHSL(0, -0.08, 0.16));
    this._attachHat(skin.hat || 'party');
  }

  triggerSwing() {
    this.swingTimer = this.maxSwingDuration;
  }

  animate(dt, speed, isGrounded, vy = 0, isHunter = false, isStunned = false, isStealing = false) {
    this.animTime += dt;
    this.isHunter = isHunter;
    this.isStunned = isStunned;
    this.verticalVel = vy;

    this.dizzyGroup.visible = isStunned;
    this.hunterAura.visible = isHunter;

    // Hat spinning
    if (this.propellerBlades) {
      this.propellerBlades.rotation.y += dt * 16;
    }

    // 1. Natural Cartoon Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      if (this.blinkTimer <= -this.blinkDuration) {
        this.isBlinking = false;
        this.blinkTimer = 2.5 + Math.random() * 3.5;
      }
    }
    const blinkScale = this.isBlinking ? 0.1 : 1.0;
    this.eyeL.scale.y = blinkScale;
    this.eyeR.scale.y = blinkScale;

    // 2. Eyebrow expressions
    if (isStunned) {
      this.browL.rotation.z = Math.sin(this.animTime * 10) * 0.4;
      this.browR.rotation.z = -Math.sin(this.animTime * 10) * 0.4;
    } else if (isHunter) {
      this.browL.rotation.z = -0.3; // determined / fierce
      this.browR.rotation.z = 0.3;
    } else if (!isGrounded) {
      this.browL.rotation.z = 0.25; // wide-eyed excited
      this.browR.rotation.z = -0.25;
    } else {
      this.browL.rotation.z = 0.08;
      this.browR.rotation.z = -0.08;
    }

    // 3. Mouth shape
    if (!isGrounded || this.swingTimer > 0) {
      this.mouthMesh.visible = false;
      this.openMouthMesh.visible = true; // Excited open mouth!
    } else {
      this.mouthMesh.visible = true;
      this.openMouthMesh.visible = false;
    }

    // 4. Stunned / Hit Animation
    if (isStunned) {
      this.dizzyGroup.rotation.y += dt * 4.5;
      this.torso.rotation.z = Math.sin(this.animTime * 7) * 0.3;
      this.torso.rotation.x = 0.38 + Math.sin(this.animTime * 5) * 0.12;
      this.head.rotation.y = Math.sin(this.animTime * 9) * 0.35;
      this.armL.rotation.x = -1.3 + Math.sin(this.animTime * 9) * 0.35;
      this.armR.rotation.x = -1.3 + Math.cos(this.animTime * 9) * 0.35;
      this.legL.rotation.x = 0.45;
      this.legR.rotation.x = -0.45;
      this.torso.scale.set(1.0, 1.0, 1.0);
      return;
    }

    // 5. Jump & Landing Dynamics (Enhanced Squash & Stretch!)
    if (this.wasGrounded && !isGrounded) {
      // Just took off into jump!
      this.landSquashTimer = 0;
    } else if (!this.wasGrounded && isGrounded) {
      // Just landed! Trigger bouncy landing squash!
      this.landSquashTimer = 0.22;
    }
    this.wasGrounded = isGrounded;

    if (!isGrounded) {
      // IN AIR JUMP ANIMATION:
      if (vy > 1.5) {
        // ASCENT: Vertical Stretch! Arms reach up high, legs tuck up!
        this.torso.scale.set(0.84, 1.35, 0.84);
        this.armL.rotation.x = -2.6;
        this.armR.rotation.x = -2.6;
        this.armL.rotation.z = 0.25;
        this.armR.rotation.z = -0.25;
        this.legL.rotation.x = -0.55;
        this.legR.rotation.x = -0.55;
        this.torso.rotation.x = -0.15;
      } else if (vy < -1.5) {
        // DESCENT / FALL: Arms splay wide, legs paddle ready to touch ground!
        this.torso.scale.set(0.95, 1.15, 0.95);
        this.armL.rotation.x = -1.8;
        this.armR.rotation.x = -1.8;
        this.armL.rotation.z = 0.75;
        this.armR.rotation.z = -0.75;
        this.legL.rotation.x = 0.35;
        this.legR.rotation.x = 0.35;
        this.torso.rotation.x = 0.12;
      } else {
        // APEX FLOAT: Funny cartoon flutter / bicycle pedal kicks!
        this.torso.scale.set(1.08, 0.95, 1.08);
        const flutter = Math.sin(this.animTime * 20);
        this.legL.rotation.x = flutter * 0.7;
        this.legR.rotation.x = -flutter * 0.7;
        this.armL.rotation.x = -2.0 + flutter * 0.3;
        this.armR.rotation.x = -2.0 - flutter * 0.3;
        this.torso.rotation.x = 0;
      }
      return;
    }

    // On Ground: Check Landing Squash Bounce
    if (this.landSquashTimer > 0) {
      this.landSquashTimer -= dt;
      const progress = 1.0 - (this.landSquashTimer / 0.22);
      // Elastic damped bounce
      const squashFactor = Math.sin(progress * Math.PI) * (1.0 - progress * 0.5);
      const sy = 1.0 - squashFactor * 0.42;
      const sxz = 1.0 + squashFactor * 0.32;

      this.torso.scale.set(sxz, sy, sxz);
      this.torso.position.y = 0.65 - squashFactor * 0.18;
      this.armL.rotation.z = 0.4 + squashFactor * 0.5;
      this.armR.rotation.z = -0.4 - squashFactor * 0.5;
      return;
    }

    // Reset scales
    this.torso.scale.set(1.0, 1.0, 1.0);
    this.torso.rotation.x = 0;
    this.torso.rotation.z = 0;

    // 6. Belt Swing (Athletic Whip-Crack Strike Animation!)
    if (this.swingTimer > 0) {
      this.swingTimer -= dt;
      const p = 1.0 - Math.max(0, this.swingTimer / this.maxSwingDuration);

      if (p < 0.28) {
        // ANTICIPATION / COIL BACK: Hunter winds up, torso twists back
        const coil = p / 0.28;
        this.armR.rotation.x = -1.2 - coil * 1.4; // arm raised high & back
        this.armR.rotation.y = 0.6 * coil;
        this.armR.rotation.z = 0.5 * coil;
        this.armL.rotation.x = -0.8; // left arm out for balance
        this.armL.rotation.y = -0.4;
        this.torso.rotation.y = -0.55 * coil; // twist torso
        this.torso.rotation.x = -0.15 * coil;
      } else if (p < 0.75) {
        // EXPLOSIVE FORWARD WHIP-SLASH: Arm whips forward in diagonal strike!
        const whip = (p - 0.28) / 0.47;
        // Ease-in fast strike
        const easeWhip = Math.sin((whip * Math.PI) / 2);
        this.armR.rotation.x = -2.6 + easeWhip * 2.8; // whips down & forward
        this.armR.rotation.y = 0.6 - easeWhip * 1.5;
        this.armR.rotation.z = 0.5 - easeWhip * 1.1;
        this.torso.rotation.y = -0.55 + easeWhip * 1.1; // full body follow-through
        this.torso.rotation.x = -0.15 + easeWhip * 0.35;
        this.head.rotation.y = -0.2 * (1 - easeWhip);
      } else {
        // RECOIL & RECOVERY: Spring back elastically
        const rec = (p - 0.75) / 0.25;
        this.armR.rotation.x = 0.2 - rec * 0.2;
        this.armR.rotation.y = -0.9 + rec * 0.9;
        this.armR.rotation.z = -0.6 + rec * 0.6;
        this.torso.rotation.y = 0.55 - rec * 0.55;
        this.torso.rotation.x = 0.2 - rec * 0.2;
      }
      return;
    }

    // 7. Steal Channeling Animation
    if (isStealing) {
      this.armL.rotation.x = -1.6 + Math.sin(this.animTime * 14) * 0.18;
      this.armR.rotation.x = -1.6 + Math.cos(this.animTime * 14) * 0.18;
      this.armL.rotation.y = 0.25;
      this.armR.rotation.y = -0.25;
      this.torso.rotation.x = 0.28;
      return;
    }

    // 8. Run / Waddle Animation (Cute Stumble Guys Bouncy Waddling)
    if (speed > 0.5) {
      const freq = 12.5;
      const wobble = Math.sin(this.animTime * freq);

      this.legL.rotation.x = wobble * 0.88;
      this.legR.rotation.x = -wobble * 0.88;

      this.armL.rotation.x = -wobble * 0.92;
      this.armR.rotation.x = wobble * 0.92;
      this.armL.rotation.z = 0.2;
      this.armR.rotation.z = -0.2;

      this.torso.position.y = 0.65 + Math.abs(Math.sin(this.animTime * freq)) * 0.14;
      this.torso.rotation.z = Math.sin(this.animTime * (freq / 2)) * 0.14; // cute torso waddle
      this.head.rotation.y = -Math.sin(this.animTime * (freq / 2)) * 0.12;
    } else {
      // 9. Idle Breathing Bob
      const breath = Math.sin(this.animTime * 2.4);
      this.torso.position.y = 0.65 + breath * 0.035;
      this.torso.scale.set(1.0 + breath * 0.02, 1.0 - breath * 0.02, 1.0 + breath * 0.02);

      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      this.armL.rotation.x = Math.sin(this.animTime * 2.0) * 0.09;
      this.armR.rotation.x = -Math.sin(this.animTime * 2.0) * 0.09;
      this.armL.rotation.z = 0.18;
      this.armR.rotation.z = -0.18;
      this.head.rotation.y = Math.sin(this.animTime * 1.2) * 0.08;
    }
  }
}
