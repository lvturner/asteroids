(function () {
    "use strict";

    var canvas = document.getElementById("gameCanvas");
    var ctx = canvas.getContext("2d");

    var WIDTH = 800;
    var HEIGHT = 600;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    ctx.imageSmoothingEnabled = false;

    var SPRITES_BASE = "assets/sprites/";

    var STATE_TITLE = 0;
    var STATE_PLAYING = 1;
    var STATE_GAME_OVER = 2;
    var STATE_LOADING = 3;
    var gameState = STATE_LOADING;

    var SCORE_SMALL = 100;
    var SCORE_MED = 50;
    var SCORE_LARGE = 20;
    var EXTRA_LIFE_SCORE = 10000;

    var SHIP_SIZE = 64;
    var SHIP_RADIUS = 22;
    var SHIP_ROTATION_SPEED = 4.5;
    var SHIP_THRUST = 300;
    var SHIP_DRAG = 0.99;
    var SHIP_MAX_SPEED = 500;

    var BULLET_SIZE = 8;
    var BULLET_SPEED = 500;
    var BULLET_LIFETIME = 1.5;
    var MAX_BULLETS = 4;
    var BULLET_RADIUS = 3;
    var FIRE_RATE = 0.2;

    var ASTEROID_SIZES = {
        large: { radius: 30, speed: [40, 100], nextSize: "medium", score: SCORE_LARGE, canvasSize: 64 },
        medium: { radius: 18, speed: [60, 140], nextSize: "small", score: SCORE_MED, canvasSize: 32 },
        small: { radius: 10, speed: [80, 180], nextSize: null, score: SCORE_SMALL, canvasSize: 16 },
    };

    var STARTING_ASTEROIDS = 4;
    var WAVE_INCREMENT = 1;
    var STARTING_LIVES = 3;
    var INVINCIBILITY_TIME = 3.0;
    var NUM_ROTATION_FRAMES = 36;

    var EXPLOSION_FRAME_SIZE = 64;
    var EXPLOSION_NUM_FRAMES = 4;
    var EXPLOSION_DURATION = 0.4;

    var SHIP_DEATH_FRAME_SIZE = 64;
    var SHIP_DEATH_NUM_FRAMES = 4;
    var SHIP_DEATH_DURATION = 2.0;
    var SHIP_DEATH_ANIM_SPEED = 2;

    var keys = {};
    var score = 0;
    var lives = STARTING_LIVES;
    var wave = 0;
    var highScore = 0;
    var nextExtraLife = EXTRA_LIFE_SCORE;

    var ship = null;
    var bullets = [];
    var asteroids = [];
    var explosions = [];
    var fireCooldown = 0;

    var audioCtx = null;

    var sprites = {};
    var shipFramesNormal = [];
    var shipFramesThrust = [];
    var asteroidImages = {};

    var ASSET_LIST = [
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
        var loaded = 0;
        var total = ASSET_LIST.length;

        for (var i = 0; i < ASSET_LIST.length; i++) {
            var img = new Image();
            img.src = SPRITES_BASE + ASSET_LIST[i];
            sprites[ASSET_LIST[i]] = img;
            (function (image, name) {
                image.onload = function () {
                    loaded++;
                    if (loaded >= total) callback();
                };
                image.onerror = function () {
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
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        var t = audioCtx.currentTime;

        switch (type) {
            case "shoot":
                osc.type = "square";
                osc.frequency.setValueAtTime(880, t);
                osc.frequency.exponentialRampToValueAtTime(220, t + 0.1);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;
            case "explosion_small":
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.start(t);
                osc.stop(t + 0.15);
                break;
            case "explosion_med":
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(200, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                osc.start(t);
                osc.stop(t + 0.25);
                break;
            case "explosion_large":
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.exponentialRampToValueAtTime(20, t + 0.4);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.start(t);
                osc.stop(t + 0.4);
                break;
            case "death":
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.8);
                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
                osc.start(t);
                osc.stop(t + 0.8);
                break;
            case "extra_life":
                osc.type = "sine";
                osc.frequency.setValueAtTime(523, t);
                osc.frequency.setValueAtTime(659, t + 0.1);
                osc.frequency.setValueAtTime(784, t + 0.2);
                osc.frequency.setValueAtTime(1047, t + 0.3);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
                osc.start(t);
                osc.stop(t + 0.45);
                break;
            case "thrust":
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(60 + Math.random() * 20, t);
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                osc.start(t);
                osc.stop(t + 0.05);
                break;
        }
    }

    function wrap(obj) {
        if (obj.x < -40) obj.x += WIDTH + 80;
        if (obj.x > WIDTH + 40) obj.x -= WIDTH + 80;
        if (obj.y < -40) obj.y += HEIGHT + 80;
        if (obj.y > HEIGHT + 40) obj.y -= HEIGHT + 80;
    }

    function dist(a, b) {
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function prerenderShipFrames() {
        shipFramesNormal.length = 0;
        shipFramesThrust.length = 0;

        var srcNormal = sprites["ship.png"];
        var srcThrust = sprites["ship_thrust.png"];

        for (var i = 0; i < NUM_ROTATION_FRAMES; i++) {
            var angle = (i / NUM_ROTATION_FRAMES) * Math.PI * 2;

            var cN = document.createElement("canvas");
            cN.width = SHIP_SIZE;
            cN.height = SHIP_SIZE;
            var cxN = cN.getContext("2d");
            cxN.imageSmoothingEnabled = false;
            cxN.translate(SHIP_SIZE / 2, SHIP_SIZE / 2);
            cxN.rotate(angle);
            cxN.drawImage(srcNormal, -srcNormal.width / 2, -srcNormal.height / 2);
            shipFramesNormal.push(cN);

            var cT = document.createElement("canvas");
            cT.width = SHIP_SIZE;
            cT.height = SHIP_SIZE;
            var cxT = cT.getContext("2d");
            cxT.imageSmoothingEnabled = false;
            cxT.translate(SHIP_SIZE / 2, SHIP_SIZE / 2);
            cxT.rotate(angle);
            cxT.drawImage(srcThrust, -srcThrust.width / 2, -srcThrust.height / 2);
            shipFramesThrust.push(cT);
        }
    }

    var ASTEROID_SPRITE_PREFIX = { large: "large", medium: "med", small: "small" };

    function indexAsteroidImages() {
        var sizeKeys = ["large", "medium", "small"];
        for (var s = 0; s < sizeKeys.length; s++) {
            var key = sizeKeys[s];
            asteroidImages[key] = [];
            for (var v = 1; v <= 3; v++) {
                var filename = "asteroid_" + ASTEROID_SPRITE_PREFIX[key] + "_" + v + ".png";
                asteroidImages[key].push(sprites[filename]);
            }
        }
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
        var info = ASTEROID_SIZES[sizeType];
        var angle = Math.random() * Math.PI * 2;
        var speed = info.speed[0] + Math.random() * (info.speed[1] - info.speed[0]);
        var variant = Math.floor(Math.random() * 3);
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
        var count = STARTING_ASTEROIDS + (wave - 1) * WAVE_INCREMENT;
        for (var i = 0; i < count; i++) {
            var x, y;
            var margin = 100;
            do {
                x = Math.random() * WIDTH;
                y = Math.random() * HEIGHT;
            } while (ship && dist({ x: x, y: y }, ship) < margin);

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
        if (Math.random() < 0.15) {
            shipDeath();
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

        if (keys["ArrowLeft"] || keys["KeyA"]) {
            ship.angle -= SHIP_ROTATION_SPEED * dt;
        }
        if (keys["ArrowRight"] || keys["KeyD"]) {
            ship.angle += SHIP_ROTATION_SPEED * dt;
        }

        ship.thrusting = keys["ArrowUp"] || keys["KeyW"];
        if (ship.thrusting) {
            ship.vx += Math.sin(ship.angle) * SHIP_THRUST * dt;
            ship.vy -= Math.cos(ship.angle) * SHIP_THRUST * dt;

            ship.thrustSoundTimer -= dt;
            if (ship.thrustSoundTimer <= 0) {
                playSound("thrust");
                ship.thrustSoundTimer = 0.08;
            }
        }

        var speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
        if (speed > SHIP_MAX_SPEED) {
            ship.vx = (ship.vx / speed) * SHIP_MAX_SPEED;
            ship.vy = (ship.vy / speed) * SHIP_MAX_SPEED;
        }

        ship.vx *= Math.pow(SHIP_DRAG, dt * 60);
        ship.vy *= Math.pow(SHIP_DRAG, dt * 60);

        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        wrap(ship);

        fireCooldown -= dt;
        if ((keys["Space"] || keys["KeyZ"]) && fireCooldown <= 0 && bullets.length < MAX_BULLETS) {
            var noseX = ship.x + Math.sin(ship.angle) * 20;
            var noseY = ship.y - Math.cos(ship.angle) * 20;
            bullets.push(createBullet(noseX, noseY, ship.angle));
            fireCooldown = FIRE_RATE;
            playSound("shoot");
        }

        if (keys["ShiftLeft"] || keys["ShiftRight"]) {
            keys["ShiftLeft"] = false;
            keys["ShiftRight"] = false;
            hyperspace();
        }
    }

    function updateBullets(dt) {
        for (var i = bullets.length - 1; i >= 0; i--) {
            var b = bullets[i];
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
        for (var i = 0; i < asteroids.length; i++) {
            var a = asteroids[i];
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.rotation += a.rotSpeed * dt;
            wrap(a);
        }
    }

    function updateExplosions(dt) {
        for (var i = explosions.length - 1; i >= 0; i--) {
            explosions[i].timer += dt;
            if (explosions[i].timer >= explosions[i].duration) {
                explosions.splice(i, 1);
            }
        }
    }

    function checkCollisions() {
        if (!ship || ship.dead) return;

        for (var bi = bullets.length - 1; bi >= 0; bi--) {
            var b = bullets[bi];
            for (var ai = asteroids.length - 1; ai >= 0; ai--) {
                var a = asteroids[ai];
                if (dist(b, a) < a.radius + BULLET_RADIUS) {
                    var info = ASTEROID_SIZES[a.sizeType];
                    score += info.score;

                    if (score >= nextExtraLife) {
                        lives++;
                        nextExtraLife += EXTRA_LIFE_SCORE;
                        playSound("extra_life");
                    }

                    if (a.sizeType === "small") {
                        playSound("explosion_small");
                    } else if (a.sizeType === "medium") {
                        playSound("explosion_med");
                    } else {
                        playSound("explosion_large");
                    }

                    spawnExplosion(a.x, a.y, ASTEROID_SIZES[a.sizeType].canvasSize);

                    if (info.nextSize) {
                        for (var s = 0; s < 2; s++) {
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
            for (var ai = 0; ai < asteroids.length; ai++) {
                var a = asteroids[ai];
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
        ctx.fillStyle = "#ffffff";
        for (var i = 0; i < 120; i++) {
            var hash = (i * 2654435761) >>> 0;
            var x = (hash % WIDTH);
            var y = ((hash * 7) % HEIGHT);
            var brightness = ((hash % 3) + 1) / 3;
            ctx.globalAlpha = brightness * 0.6;
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.globalAlpha = 1;
    }

    function drawShip() {
        if (!ship || ship.dead) return;

        if (ship.invincibleTimer > 0) {
            var flash = Math.floor(ship.invincibleTimer * 10) % 2;
            if (flash === 0) return;
        }

        var frameIdx = Math.round(
            (((ship.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
                (Math.PI * 2) *
                NUM_ROTATION_FRAMES
        ) % NUM_ROTATION_FRAMES;

        var frames = ship.thrusting ? shipFramesThrust : shipFramesNormal;
        ctx.drawImage(
            frames[frameIdx],
            ship.x - SHIP_SIZE / 2,
            ship.y - SHIP_SIZE / 2
        );
    }

    function drawShipDeath() {
        if (!ship || !ship.dead) return;
        var rawProgress = 1 - ship.deathTimer / SHIP_DEATH_DURATION;
        var progress = Math.min(1, rawProgress * SHIP_DEATH_ANIM_SPEED);
        var frameIdx = Math.min(
            SHIP_DEATH_NUM_FRAMES - 1,
            Math.floor(progress * SHIP_DEATH_NUM_FRAMES)
        );
        var sheet = sprites["ship_death_sheet.png"];
        var alpha = 1 - frameIdx / SHIP_DEATH_NUM_FRAMES;
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
        var bulletImg = sprites["bullet.png"];
        for (var i = 0; i < bullets.length; i++) {
            var b = bullets[i];
            ctx.globalAlpha = Math.min(1, b.life * 3);
            ctx.drawImage(
                bulletImg,
                b.x - BULLET_SIZE / 2,
                b.y - BULLET_SIZE / 2
            );
        }
        ctx.globalAlpha = 1;
    }

    function drawAsteroids() {
        for (var i = 0; i < asteroids.length; i++) {
            var a = asteroids[i];
            var img = asteroidImages[a.sizeType][a.variant];
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
        var sheet = sprites["explosion_sheet.png"];
        for (var i = 0; i < explosions.length; i++) {
            var e = explosions[i];
            var progress = e.timer / e.duration;
            var frameIdx = Math.min(
                EXPLOSION_NUM_FRAMES - 1,
                Math.floor(progress * EXPLOSION_NUM_FRAMES)
            );
            var drawSize = e.size;
            ctx.globalAlpha = 1 - progress * 0.6;
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

        var lifeIcon = sprites["lives_icon.png"];
        for (var i = 0; i < lives; i++) {
            ctx.drawImage(lifeIcon, 20 + i * 20, 40);
        }
    }

    function drawTitle() {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "bold 64px monospace";
        ctx.fillText("ASTEROIDS", WIDTH / 2, HEIGHT / 2 - 60);

        ctx.font = "18px monospace";
        var blink = Math.floor(Date.now() / 500) % 2;
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
        var blink = Math.floor(Date.now() / 500) % 2;
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
            case STATE_TITLE:
                break;
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

    var lastTime = 0;

    function gameLoop(timestamp) {
        var dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (dt > 0.1) dt = 0.1;
        if (dt < 0) dt = 0;

        update(dt);
        draw();

        requestAnimationFrame(gameLoop);
    }

    document.addEventListener("keydown", function (e) {
        keys[e.code] = true;

        if (e.code === "Space") {
            e.preventDefault();
            if (gameState === STATE_TITLE) {
                initAudio();
                startGame();
            } else if (gameState === STATE_GAME_OVER) {
                initAudio();
                startGame();
            }
        }
    });

    document.addEventListener("keyup", function (e) {
        keys[e.code] = false;
    });

    loadAssets(function () {
        prerenderShipFrames();
        indexAsteroidImages();
        gameState = STATE_TITLE;
    });

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
})();
