"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = 800;
const HEIGHT = 600;
canvas.width = WIDTH;
canvas.height = HEIGHT;

ctx.imageSmoothingEnabled = false;

const SPRITES_BASE = "assets/sprites/";

const STATE_TITLE = 0;
const STATE_PLAYING = 1;
const STATE_GAME_OVER = 2;
const STATE_LOADING = 3;
let gameState = STATE_LOADING;

const SCORE_SMALL = 100;
const SCORE_MED = 50;
const SCORE_LARGE = 20;
const EXTRA_LIFE_SCORE = 10000;

const SHIP_SIZE = 64;
const SHIP_RADIUS = 22;
const SHIP_NOSE_OFFSET = 20;
const SHIP_ROTATION_SPEED = 4.5;
const SHIP_THRUST = 300;
const SHIP_DRAG = 0.99;
const SHIP_MAX_SPEED = 500;

const BULLET_SIZE = 8;
const BULLET_SPEED = 500;
const BULLET_LIFETIME = 1.5;
const MAX_BULLETS = 4;
const BULLET_RADIUS = 3;
const FIRE_RATE = 0.2;
const BULLET_FADE_SPEED = 3;

const ASTEROID_SIZES = {
    large: { radius: 30, speed: [40, 100], nextSize: "medium", score: SCORE_LARGE, canvasSize: 64 },
    medium: { radius: 18, speed: [60, 140], nextSize: "small", score: SCORE_MED, canvasSize: 32 },
    small: { radius: 10, speed: [80, 180], nextSize: null, score: SCORE_SMALL, canvasSize: 16 },
};

const ASTEROID_SPRITE_PREFIX = { large: "large", medium: "med", small: "small" };
const ASTEROID_VARIANTS = 3;

const STARTING_ASTEROIDS = 4;
const WAVE_INCREMENT = 1;
const STARTING_LIVES = 3;
const SPAWN_SAFETY_MARGIN = 100;

const INVINCIBILITY_TIME = 3.0;
const INVINCIBILITY_FLASH_RATE = 10;

const NUM_ROTATION_FRAMES = 36;

const EXPLOSION_FRAME_SIZE = 64;
const EXPLOSION_NUM_FRAMES = 4;
const EXPLOSION_DURATION = 0.4;
const EXPLOSION_FADE_RATIO = 0.6;

const SHIP_DEATH_FRAME_SIZE = 64;
const SHIP_DEATH_NUM_FRAMES = 4;
const SHIP_DEATH_DURATION = 2.0;
const SHIP_DEATH_ANIM_SPEED = 2;

const WRAP_MARGIN = 40;
const MAX_DELTA_TIME = 0.1;

const HYPERSPACE_DEATH_CHANCE = 0.15;

const THRUST_SOUND_INTERVAL = 0.08;

const STAR_COUNT = 120;
const KNUTH_HASH = 2654435761;

const INPUT_MAP = {
    rotateLeft: ["ArrowLeft", "KeyA"],
    rotateRight: ["ArrowRight", "KeyD"],
    thrust: ["ArrowUp", "KeyW"],
    fire: ["Space", "KeyZ"],
    hyperspace: ["ShiftLeft", "ShiftRight"],
};

const SOUND_CONFIG = {
    shoot:           { type: "square",  startFreq: 880, endFreq: 220,  duration: 0.1,  volume: 0.15 },
    explosion_small: { type: "sawtooth", startFreq: 300, endFreq: 50,   duration: 0.15, volume: 0.12 },
    explosion_med:   { type: "sawtooth", startFreq: 200, endFreq: 30,   duration: 0.25, volume: 0.15 },
    explosion_large: { type: "sawtooth", startFreq: 120, endFreq: 20,   duration: 0.4,  volume: 0.2 },
    death:           { type: "sawtooth", startFreq: 400, endFreq: 30,   duration: 0.8,  volume: 0.25 },
    thrust:          { type: "sawtooth", startFreq: 60,  endFreq: null,  duration: 0.05, volume: 0.04, randomFreqRange: 20 },
};

const EXTRA_LIFE_FREQS = [523, 659, 784, 1047];
const EXTRA_LIFE_DURATION = 0.45;
const EXTRA_LIFE_VOLUME = 0.15;

let keys = {};
let score = 0;
let lives = STARTING_LIVES;
let wave = 0;
let highScore = 0;
let nextExtraLife = EXTRA_LIFE_SCORE;

let ship = null;
let bullets = [];
let asteroids = [];
let explosions = [];
let fireCooldown = 0;

let audioCtx = null;

const sprites = {};
let shipFramesNormal = [];
let shipFramesThrust = [];
const asteroidImages = {};

let starfieldCanvas = null;

const ASSET_LIST = [
    "ship.png",
    "ship_thrust.png",
    "asteroid_large_1.png",
    "asteroid_large_2.png",
    "asteroid_large_3.png",
    "asteroid_med_1.png",
    "asteroid_med_2.png",
    "asteroid_med_3.png",
    "asteroid_small_1.png",
    "asteroid_small_2.png",
    "asteroid_small_3.png",
    "bullet.png",
    "explosion_sheet.png",
    "ship_death_sheet.png",
    "lives_icon.png",
];

function loadAssets(callback) {
    let loaded = 0;
    const total = ASSET_LIST.length;

    for (let i = 0; i < ASSET_LIST.length; i++) {
        const img = new Image();
        img.src = SPRITES_BASE + ASSET_LIST[i];
        sprites[ASSET_LIST[i]] = img;
        ((image, name) => {
            image.onload = () => {
                loaded++;
                if (loaded >= total) callback();
            };
            image.onerror = () => {
                console.warn("Failed to load: " + name);
                loaded++;
                if (loaded >= total) callback();
            };
        })(img, ASSET_LIST[i]);
    }
}

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioCtx) return;

    if (type === "extra_life") {
        playExtraLifeSound();
        return;
    }

    if (type === "thrust") {
        playThrustSound();
        return;
    }

    const config = SOUND_CONFIG[type];
    if (!config) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;

    osc.type = config.type;
    osc.frequency.setValueAtTime(config.startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(config.endFreq, t + config.duration);
    gain.gain.setValueAtTime(config.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + config.duration);
    osc.start(t);
    osc.stop(t + config.duration);
}

function playExtraLifeSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;

    osc.type = "sine";
    for (let i = 0; i < EXTRA_LIFE_FREQS.length; i++) {
        osc.frequency.setValueAtTime(EXTRA_LIFE_FREQS[i], t + i * 0.1);
    }
    gain.gain.setValueAtTime(EXTRA_LIFE_VOLUME, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + EXTRA_LIFE_DURATION);
    osc.start(t);
    osc.stop(t + EXTRA_LIFE_DURATION);
}

function playThrustSound() {
    const config = SOUND_CONFIG.thrust;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t = audioCtx.currentTime;

    osc.type = config.type;
    osc.frequency.setValueAtTime(config.startFreq + Math.random() * config.randomFreqRange, t);
    gain.gain.setValueAtTime(config.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + config.duration);
    osc.start(t);
    osc.stop(t + config.duration);
}

function isInputActive(action) {
    const codes = INPUT_MAP[action];
    for (let i = 0; i < codes.length; i++) {
        if (keys[codes[i]]) return true;
    }
    return false;
}

function consumeInput(action) {
    const codes = INPUT_MAP[action];
    for (let i = 0; i < codes.length; i++) {
        if (keys[codes[i]]) {
            keys[codes[i]] = false;
            return true;
        }
    }
    return false;
}

function wrap(obj, margin) {
    if (margin === undefined) margin = WRAP_MARGIN;
    if (obj.x < -margin) obj.x += WIDTH + margin * 2;
    if (obj.x > WIDTH + margin) obj.x -= WIDTH + margin * 2;
    if (obj.y < -margin) obj.y += HEIGHT + margin * 2;
    if (obj.y > HEIGHT + margin) obj.y -= HEIGHT + margin * 2;
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function prerenderShipFrames() {
    shipFramesNormal = [];
    shipFramesThrust = [];

    const srcNormal = sprites["ship.png"];
    const srcThrust = sprites["ship_thrust.png"];

    for (let i = 0; i < NUM_ROTATION_FRAMES; i++) {
        const angle = (i / NUM_ROTATION_FRAMES) * Math.PI * 2;

        const cN = document.createElement("canvas");
        cN.width = SHIP_SIZE;
        cN.height = SHIP_SIZE;
        const cxN = cN.getContext("2d");
        cxN.imageSmoothingEnabled = false;
        cxN.translate(SHIP_SIZE / 2, SHIP_SIZE / 2);
        cxN.rotate(angle);
        cxN.drawImage(srcNormal, -srcNormal.width / 2, -srcNormal.height / 2);
        shipFramesNormal.push(cN);

        const cT = document.createElement("canvas");
        cT.width = SHIP_SIZE;
        cT.height = SHIP_SIZE;
        const cxT = cT.getContext("2d");
        cxT.imageSmoothingEnabled = false;
        cxT.translate(SHIP_SIZE / 2, SHIP_SIZE / 2);
        cxT.rotate(angle);
        cxT.drawImage(srcThrust, -srcThrust.width / 2, -srcThrust.height / 2);
        shipFramesThrust.push(cT);
    }
}

function indexAsteroidImages() {
    const sizeKeys = ["large", "medium", "small"];
    for (let s = 0; s < sizeKeys.length; s++) {
        const key = sizeKeys[s];
        asteroidImages[key] = [];
        for (let v = 1; v <= ASTEROID_VARIANTS; v++) {
            const filename = "asteroid_" + ASTEROID_SPRITE_PREFIX[key] + "_" + v + ".png";
            asteroidImages[key].push(sprites[filename]);
        }
    }
}

function prerenderStarfield() {
    starfieldCanvas = document.createElement("canvas");
    starfieldCanvas.width = WIDTH;
    starfieldCanvas.height = HEIGHT;
    const sCtx = starfieldCanvas.getContext("2d");
    sCtx.fillStyle = "#ffffff";
    for (let i = 0; i < STAR_COUNT; i++) {
        const hash = (i * KNUTH_HASH) >>> 0;
        const x = hash % WIDTH;
        const y = (hash * 7) % HEIGHT;
        const brightness = ((hash % 3) + 1) / 3;
        sCtx.globalAlpha = brightness * 0.6;
        sCtx.fillRect(x, y, 1, 1);
    }
    sCtx.globalAlpha = 1;
}

function createShip() {
    return {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        vx: 0,
        vy: 0,
        angle: 0,
        invincibleTimer: INVINCIBILITY_TIME,
        dead: false,
        deathTimer: 0,
        thrusting: false,
        thrustSoundTimer: 0,
    };
}

function createBullet(x, y, angle) {
    return {
        x: x,
        y: y,
        vx: Math.sin(angle) * BULLET_SPEED,
        vy: -Math.cos(angle) * BULLET_SPEED,
        life: BULLET_LIFETIME,
    };
}

function createAsteroid(sizeType, x, y) {
    const info = ASTEROID_SIZES[sizeType];
    const angle = Math.random() * Math.PI * 2;
    const speed = info.speed[0] + Math.random() * (info.speed[1] - info.speed[0]);
    const variant = Math.floor(Math.random() * ASTEROID_VARIANTS);
    return {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        sizeType: sizeType,
        radius: info.radius,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
        variant: variant,
    };
}

function spawnExplosion(x, y, size) {
    explosions.push({
        x: x,
        y: y,
        size: size,
        timer: 0,
        duration: EXPLOSION_DURATION,
    });
}

function spawnWave() {
    wave++;
    const count = STARTING_ASTEROIDS + (wave - 1) * WAVE_INCREMENT;
    for (let i = 0; i < count; i++) {
        let x, y;
        do {
            x = Math.random() * WIDTH;
            y = Math.random() * HEIGHT;
        } while (ship && dist({ x, y }, ship) < SPAWN_SAFETY_MARGIN);

        asteroids.push(createAsteroid("large", x, y));
    }
}

function startGame() {
    score = 0;
    lives = STARTING_LIVES;
    wave = 0;
    nextExtraLife = EXTRA_LIFE_SCORE;
    bullets = [];
    asteroids = [];
    explosions = [];
    fireCooldown = 0;
    ship = createShip();
    spawnWave();
    gameState = STATE_PLAYING;
}

function shipDeath() {
    playSound("death");
    ship.dead = true;
    ship.deathTimer = SHIP_DEATH_DURATION;
}

function respawnShip() {
    lives--;
    if (lives <= 0) {
        gameState = STATE_GAME_OVER;
        if (score > highScore) highScore = score;
        return;
    }
    ship = createShip();
}

function hyperspace() {
    ship.x = Math.random() * WIDTH;
    ship.y = Math.random() * HEIGHT;
    ship.vx = 0;
    ship.vy = 0;
    if (Math.random() < HYPERSPACE_DEATH_CHANCE) {
        shipDeath();
    }
}

function handleShipInput(dt) {
    if (isInputActive("rotateLeft")) {
        ship.angle -= SHIP_ROTATION_SPEED * dt;
    }
    if (isInputActive("rotateRight")) {
        ship.angle += SHIP_ROTATION_SPEED * dt;
    }

    ship.thrusting = isInputActive("thrust");
    if (ship.thrusting) {
        ship.vx += Math.sin(ship.angle) * SHIP_THRUST * dt;
        ship.vy -= Math.cos(ship.angle) * SHIP_THRUST * dt;

        ship.thrustSoundTimer -= dt;
        if (ship.thrustSoundTimer <= 0) {
            playSound("thrust");
            ship.thrustSoundTimer = THRUST_SOUND_INTERVAL;
        }
    }

    fireCooldown -= dt;
    if (isInputActive("fire") && fireCooldown <= 0 && bullets.length < MAX_BULLETS) {
        const noseX = ship.x + Math.sin(ship.angle) * SHIP_NOSE_OFFSET;
        const noseY = ship.y - Math.cos(ship.angle) * SHIP_NOSE_OFFSET;
        bullets.push(createBullet(noseX, noseY, ship.angle));
        fireCooldown = FIRE_RATE;
        playSound("shoot");
    }

    if (consumeInput("hyperspace")) {
        hyperspace();
    }
}

function updateShip(dt) {
    if (ship.dead) {
        ship.deathTimer -= dt;
        if (ship.deathTimer <= 0) {
            respawnShip();
        }
        return;
    }

    if (ship.invincibleTimer > 0) {
        ship.invincibleTimer -= dt;
    }

    handleShipInput(dt);

    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (speed > SHIP_MAX_SPEED) {
        ship.vx = (ship.vx / speed) * SHIP_MAX_SPEED;
        ship.vy = (ship.vy / speed) * SHIP_MAX_SPEED;
    }

    ship.vx *= Math.pow(SHIP_DRAG, dt * 60);
    ship.vy *= Math.pow(SHIP_DRAG, dt * 60);

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        wrap(b);
        b.life -= dt;
        if (b.life <= 0) {
            bullets.splice(i, 1);
        }
    }
}

function updateAsteroids(dt) {
    for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.rotation += a.rotSpeed * dt;
        wrap(a);
    }
}

function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].timer += dt;
        if (explosions[i].timer >= explosions[i].duration) {
            explosions.splice(i, 1);
        }
    }
}

function checkCollisions() {
    if (!ship || ship.dead) return;

    for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        for (let ai = asteroids.length - 1; ai >= 0; ai--) {
            const a = asteroids[ai];
            if (dist(b, a) < a.radius + BULLET_RADIUS) {
                const info = ASTEROID_SIZES[a.sizeType];
                score += info.score;

                if (score >= nextExtraLife) {
                    lives++;
                    nextExtraLife += EXTRA_LIFE_SCORE;
                    playSound("extra_life");
                }

                const explosionSound = "explosion_" + a.sizeType;
                playSound(explosionSound);

                spawnExplosion(a.x, a.y, info.canvasSize);

                if (info.nextSize) {
                    for (let s = 0; s < 2; s++) {
                        asteroids.push(createAsteroid(info.nextSize, a.x, a.y));
                    }
                }

                asteroids.splice(ai, 1);
                bullets.splice(bi, 1);
                break;
            }
        }
    }

    if (ship.invincibleTimer <= 0) {
        for (let ai = 0; ai < asteroids.length; ai++) {
            const a = asteroids[ai];
            if (dist(ship, a) < a.radius + SHIP_RADIUS) {
                shipDeath();
                break;
            }
        }
    }
}

function checkWaveComplete() {
    if (asteroids.length === 0 && gameState === STATE_PLAYING) {
        if (ship && !ship.dead) {
            spawnWave();
        }
    }
}

function drawStarfield() {
    ctx.drawImage(starfieldCanvas, 0, 0);
}

function drawShip() {
    if (!ship || ship.dead) return;

    if (ship.invincibleTimer > 0) {
        const flash = Math.floor(ship.invincibleTimer * INVINCIBILITY_FLASH_RATE) % 2;
        if (flash === 0) return;
    }

    const frameIdx = Math.round(
        (((ship.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
            (Math.PI * 2) *
            NUM_ROTATION_FRAMES
    ) % NUM_ROTATION_FRAMES;

    const frames = ship.thrusting ? shipFramesThrust : shipFramesNormal;
    ctx.drawImage(
        frames[frameIdx],
        ship.x - SHIP_SIZE / 2,
        ship.y - SHIP_SIZE / 2
    );
}

function drawShipDeath() {
    if (!ship || !ship.dead) return;
    const rawProgress = 1 - ship.deathTimer / SHIP_DEATH_DURATION;
    const progress = Math.min(1, rawProgress * SHIP_DEATH_ANIM_SPEED);
    const frameIdx = Math.min(
        SHIP_DEATH_NUM_FRAMES - 1,
        Math.floor(progress * SHIP_DEATH_NUM_FRAMES)
    );
    const sheet = sprites["ship_death_sheet.png"];
    const alpha = 1 - frameIdx / SHIP_DEATH_NUM_FRAMES;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
        sheet,
        frameIdx * SHIP_DEATH_FRAME_SIZE, 0,
        SHIP_DEATH_FRAME_SIZE, SHIP_DEATH_FRAME_SIZE,
        ship.x - SHIP_DEATH_FRAME_SIZE / 2,
        ship.y - SHIP_DEATH_FRAME_SIZE / 2,
        SHIP_DEATH_FRAME_SIZE,
        SHIP_DEATH_FRAME_SIZE
    );
    ctx.globalAlpha = 1;
}

function drawBullets() {
    const bulletImg = sprites["bullet.png"];
    for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        ctx.globalAlpha = Math.min(1, b.life * BULLET_FADE_SPEED);
        ctx.drawImage(
            bulletImg,
            b.x - BULLET_SIZE / 2,
            b.y - BULLET_SIZE / 2
        );
    }
    ctx.globalAlpha = 1;
}

function drawAsteroids() {
    for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        const img = asteroidImages[a.sizeType][a.variant];
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);
        ctx.drawImage(
            img,
            -img.width / 2,
            -img.height / 2
        );
        ctx.restore();
    }
}

function drawExplosions() {
    const sheet = sprites["explosion_sheet.png"];
    for (let i = 0; i < explosions.length; i++) {
        const e = explosions[i];
        const progress = e.timer / e.duration;
        const frameIdx = Math.min(
            EXPLOSION_NUM_FRAMES - 1,
            Math.floor(progress * EXPLOSION_NUM_FRAMES)
        );
        const drawSize = e.size;
        ctx.globalAlpha = 1 - progress * EXPLOSION_FADE_RATIO;
        ctx.drawImage(
            sheet,
            frameIdx * EXPLOSION_FRAME_SIZE, 0,
            EXPLOSION_FRAME_SIZE, EXPLOSION_FRAME_SIZE,
            e.x - drawSize / 2,
            e.y - drawSize / 2,
            drawSize,
            drawSize
        );
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px monospace";
    ctx.textAlign = "left";
    ctx.fillText(String(score).padStart(6, "0"), 20, 30);

    ctx.textAlign = "right";
    ctx.font = "14px monospace";
    ctx.fillText("HI " + String(highScore).padStart(6, "0"), WIDTH - 20, 30);

    const lifeIcon = sprites["lives_icon.png"];
    for (let i = 0; i < lives; i++) {
        ctx.drawImage(lifeIcon, 20 + i * 20, 40);
    }
}

function drawTitle() {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 64px monospace";
    ctx.fillText("ASTEROIDS", WIDTH / 2, HEIGHT / 2 - 60);

    ctx.font = "18px monospace";
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText("PRESS SPACE TO START", WIDTH / 2, HEIGHT / 2 + 20);
    }

    ctx.font = "14px monospace";
    ctx.fillStyle = "#666666";
    ctx.fillText("ARROWS: MOVE   SPACE: SHOOT   SHIFT: HYPERSPACE", WIDTH / 2, HEIGHT / 2 + 70);
}

function drawGameOver() {
    ctx.fillStyle = "#ff3333";
    ctx.textAlign = "center";
    ctx.font = "bold 48px monospace";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px monospace";
    ctx.fillText("SCORE: " + score, WIDTH / 2, HEIGHT / 2 + 10);

    if (score >= highScore && score > 0) {
        ctx.fillStyle = "#ffcc00";
        ctx.font = "18px monospace";
        ctx.fillText("NEW HIGH SCORE!", WIDTH / 2, HEIGHT / 2 + 45);
    }

    ctx.font = "16px monospace";
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText("PRESS SPACE TO PLAY AGAIN", WIDTH / 2, HEIGHT / 2 + 80);
    }
}

function drawLoading() {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "24px monospace";
    ctx.fillText("LOADING...", WIDTH / 2, HEIGHT / 2);
}

function update(dt) {
    switch (gameState) {
        case STATE_PLAYING:
            updateShip(dt);
            updateBullets(dt);
            updateAsteroids(dt);
            updateExplosions(dt);
            checkCollisions();
            checkWaveComplete();
            break;
        case STATE_GAME_OVER:
            updateExplosions(dt);
            updateAsteroids(dt);
            break;
    }
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    switch (gameState) {
        case STATE_LOADING:
            drawLoading();
            break;
        case STATE_TITLE:
            drawStarfield();
            drawTitle();
            break;
        case STATE_PLAYING:
            drawStarfield();
            drawAsteroids();
            drawBullets();
            drawShip();
            drawShipDeath();
            drawExplosions();
            drawHUD();
            break;
        case STATE_GAME_OVER:
            drawStarfield();
            drawAsteroids();
            drawExplosions();
            drawHUD();
            drawGameOver();
            break;
    }
}

let lastTime = performance.now();

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (dt > MAX_DELTA_TIME) dt = MAX_DELTA_TIME;
    if (dt < 0) dt = 0;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
    keys[e.code] = true;

    if (e.code === "Space") {
        e.preventDefault();
        if (gameState === STATE_TITLE || gameState === STATE_GAME_OVER) {
            initAudio();
            startGame();
        }
    }
});

document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
});

loadAssets(() => {
    prerenderShipFrames();
    indexAsteroidImages();
    prerenderStarfield();
    gameState = STATE_TITLE;
});

requestAnimationFrame(gameLoop);
