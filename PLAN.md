# Asteroids Clone — Build Plan

## Tech Stack
- Single `index.html` + `game.js` + `style.css`
- Vanilla JS + HTML5 Canvas (no frameworks)
- Pixel-art friendly: `imageSmoothingEnabled = false`
- Pre-rendered rotation frames generated at startup from a single ship sprite
- Web Audio API for sound effects
- Classic Asteroids controls (Arrow keys + Space + Shift)

---

## Art Assets Needed

All sprites should be PNG with transparent backgrounds.

| Asset | Size | Count | Notes |
|-------|------|-------|-------|
| `ship.png` | 64x64 | 1 | Facing UP (0°), crisp pixel art |
| `ship_thrust.png` | 64x64 | 1 | Same ship with engine flame visible |
| `asteroid_large_1/2/3.png` | 64x64 | 3 | Irregular rocky shapes, variety in silhouette |
| `asteroid_med_1/2/3.png` | 32x32 | 3 | Smaller versions, similar style |
| `asteroid_small_1/2/3.png` | 16x16 | 3 | Tiny chunks |
| `bullet.png` | 8x8 | 1 | Small glowing dot/line |
| `explosion_sheet.png` | 64x64 | 1 | 4-6 frame spritesheet (horizontal strip) for asteroid pop |
| `ship_death_sheet.png` | 64x64 | 1 | 4-6 frame spritesheet for ship destruction |
| `lives_icon.png` | 16x16 | 1 | Mini ship icon for HUD |

**Total: ~17 PNG files**

---

## Audio Assets Needed

| Asset | Format | Notes |
|-------|--------|-------|
| `shoot.ogg` | OGG/WAV | Short pew/laser |
| `explosion_large.ogg` | OGG/WAV | Deep boom |
| `explosion_med.ogg` | OGG/WAV | Medium pop |
| `explosion_small.ogg` | OGG/WAV | Small crack |
| `thrust.ogg` | OGG/WAV | Looping rumble |
| `death.ogg` | OGG/WAV | Dramatic explosion |
| `extra_life.ogg` | OGG/WAV | Positive jingle |

**Total: 7 audio files**

---

## File Structure

```
asteroids/
├── index.html
├── style.css
├── game.js
├── assets/
│   ├── sprites/
│   │   ├── ship.png
│   │   ├── ship_thrust.png
│   │   ├── asteroid_large_1.png
│   │   ├── asteroid_large_2.png
│   │   ├── asteroid_large_3.png
│   │   ├── asteroid_med_1.png
│   │   ├── asteroid_med_2.png
│   │   ├── asteroid_med_3.png
│   │   ├── asteroid_small_1.png
│   │   ├── asteroid_small_2.png
│   │   ├── asteroid_small_3.png
│   │   ├── bullet.png
│   │   ├── explosion_sheet.png
│   │   ├── ship_death_sheet.png
│   │   └── lives_icon.png
│   └── audio/
│       ├── shoot.ogg
│       ├── explosion_large.ogg
│       ├── explosion_med.ogg
│       ├── explosion_small.ogg
│       ├── thrust.ogg
│       ├── death.ogg
│       └── extra_life.ogg
```

---

## Build Plan (Implementation Order)

### Phase 1 — Skeleton
1. `index.html` with canvas, CSS for centering/dark background
2. `game.js` — game loop with `requestAnimationFrame`, delta time, game state machine (`TITLE`, `PLAYING`, `GAME_OVER`)

### Phase 2 — Core Rendering
3. Asset loader — preload all images, `imageSmoothingEnabled = false`
4. Pre-render rotation frames: at startup, draw `ship.png` onto an offscreen canvas at 36 angles (10° steps), store as array of ImageData/canvases
5. Ship rendering with rotation frame lookup

### Phase 3 — Ship & Physics
6. Input handler — Arrow Left/Right (rotate), Arrow Up (thrust), Space (shoot), Shift (hyperspace)
7. Ship entity — position, velocity, rotation angle, drag/friction, screen wrapping (toroidal)
8. Thrust toggles between `ship.png` and `ship_thrust.png` frames

### Phase 4 — Bullets
9. Bullet entity — spawns from ship nose, fixed speed, 2-second lifetime, max 4 on screen
10. Bullet pool for recycling

### Phase 5 — Asteroids
11. Asteroid entity — position, velocity, slow rotation, screen wrapping
12. Wave spawner — starts with 4 large asteroids, increases each wave
13. Split logic — large→2 medium, medium→2 small, small→destroyed

### Phase 6 — Collision Detection
14. Circle-based collision (radius per entity type)
15. Ship↔Asteroid, Bullet↔Asteroid checks
16. Ship invincibility frames on respawn (flashing effect)

### Phase 7 — Scoring & HUD
17. Score: small=100, medium=50, large=20
18. Lives system (start with 3)
19. HUD rendering — score top-left, lives top-right (mini ship icons), wave indicator

### Phase 8 — Effects
20. Explosion animation playback on asteroid/ship destruction
21. Particle debris (optional — could just use the explosion spritesheet)
22. Starfield background (rendered once to offscreen canvas, slight parallax or static)

### Phase 9 — Sound
23. Web Audio API sound engine — load short WAV/OGG clips
24. SFX playback: shoot, explosions (3 sizes), thrust (looping), death, extra life
25. Volume control and sound ducking

### Phase 10 — Polish
26. Title screen — "ASTEROIDS" text, "PRESS SPACE TO START"
27. Game over screen with final score
28. Extra life at 10,000 points
29. Hyperspace (random teleport with small death risk)

---

## Game States
- `TITLE` → `PLAYING` → `GAME_OVER` → back to `TITLE`

## Controls
| Key | Action |
|-----|--------|
| Arrow Left | Rotate ship left |
| Arrow Right | Rotate ship right |
| Arrow Up | Thrust forward |
| Space | Fire bullet |
| Shift | Hyperspace (random teleport) |
