#!/usr/bin/env python3
"""Generate placeholder pixel-art sprite PNGs for the Asteroids clone."""

import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

SPRITES_DIR = Path(__file__).resolve().parent.parent / "assets" / "sprites"
SPRITES_DIR.mkdir(parents=True, exist_ok=True)

SHIP_COLOR = (0, 204, 255)
SHIP_OUTLINE = (102, 238, 255)
FLAME_COLOR = (255, 136, 0)
FLAME_OUTLINE = (255, 204, 0)
ASTEROID_FILLS = [(136, 136, 136), (153, 153, 153), (119, 119, 119)]
ASTEROID_OUTLINE = (187, 187, 187)
BULLET_COLOR = (255, 255, 255)
EXPLOSION_COLOR = (255, 170, 0)
DEATH_COLOR = (0, 204, 255)


def draw_ship(img, draw, cx, cy, scale=1.0, with_flame=False):
    s = 20 * scale
    body = [
        (cx, cy - s),
        (cx - s * 0.7, cy + s * 0.7),
        (cx, cy + s * 0.35),
        (cx + s * 0.7, cy + s * 0.7),
    ]
    draw.polygon(body, fill=SHIP_COLOR, outline=SHIP_OUTLINE)

    if with_flame:
        flame_h = s * 0.5 + random.uniform(0, s * 0.3)
        flame = [
            (cx - s * 0.25, cy + s * 0.55),
            (cx, cy + s * 0.55 + flame_h),
            (cx + s * 0.25, cy + s * 0.55),
        ]
        draw.polygon(flame, fill=FLAME_COLOR, outline=FLAME_OUTLINE)


def generate_ship():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_ship(img, draw, 32, 30, scale=1.0)
    img.save(SPRITES_DIR / "ship.png")
    print("  ship.png")


def generate_ship_thrust():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_ship(img, draw, 32, 28, scale=1.0, with_flame=True)
    img.save(SPRITES_DIR / "ship_thrust.png")
    print("  ship_thrust.png")


def generate_asteroid(size, variant, canvas_size):
    random.seed(f"ast_{size}_{variant}")
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = canvas_size * 0.42
    num_verts = 8 + variant
    verts = []
    for i in range(num_verts):
        angle = (i / num_verts) * math.pi * 2
        r = radius * (0.7 + random.random() * 0.3)
        x = canvas_size / 2 + math.cos(angle) * r
        y = canvas_size / 2 + math.sin(angle) * r
        verts.append((x, y))

    fill = ASTEROID_FILLS[variant % 3]
    draw.polygon(verts, fill=fill, outline=ASTEROID_OUTLINE)

    filename = f"asteroid_{size}_{variant + 1}.png"
    img.save(SPRITES_DIR / filename)
    print(f"  {filename}")


def generate_asteroids():
    for v in range(3):
        generate_asteroid("large", v, 64)
    for v in range(3):
        generate_asteroid("med", v, 32)
    for v in range(3):
        generate_asteroid("small", v, 16)


def generate_bullet():
    img = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([2, 2, 5, 5], fill=BULLET_COLOR)
    img.save(SPRITES_DIR / "bullet.png")
    print("  bullet.png")


def generate_explosion_sheet():
    frame_size = 64
    num_frames = 4
    img = Image.new("RGBA", (frame_size * num_frames, frame_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for f in range(num_frames):
        cx = f * frame_size + frame_size // 2
        cy = frame_size // 2
        progress = f / (num_frames - 1)
        radius = int(5 + progress * 22)
        alpha = int(255 * (1 - progress * 0.6))

        color = (EXPLOSION_COLOR[0], EXPLOSION_COLOR[1], EXPLOSION_COLOR[2], alpha)
        outline = (255, 220, 100, alpha)

        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            fill=color,
            outline=outline,
        )

        inner_r = max(1, radius // 3)
        inner_color = (255, 255, 200, alpha)
        draw.ellipse(
            [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
            fill=inner_color,
        )

    img.save(SPRITES_DIR / "explosion_sheet.png")
    print("  explosion_sheet.png")


def generate_ship_death_sheet():
    frame_size = 64
    num_frames = 4
    img = Image.new("RGBA", (frame_size * num_frames, frame_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for f in range(num_frames):
        cx = f * frame_size + frame_size // 2
        cy = frame_size // 2
        progress = f / (num_frames - 1)
        alpha = int(255 * (1 - progress * 0.7))
        color = (DEATH_COLOR[0], DEATH_COLOR[1], DEATH_COLOR[2], alpha)
        outline = (SHIP_OUTLINE[0], SHIP_OUTLINE[1], SHIP_OUTLINE[2], alpha)

        pieces = [(-1, -1), (1, -0.5), (0, 1), (-0.8, 0.5), (0.8, 0.3)]
        spread = progress * 16

        for p in pieces:
            px = cx + p[0] * spread
            py = cy + p[1] * spread
            half = 3
            draw.rectangle(
                [px - half, py - half, px + half, py + half],
                fill=color,
                outline=outline,
            )

    img.save(SPRITES_DIR / "ship_death_sheet.png")
    print("  ship_death_sheet.png")


def generate_lives_icon():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.polygon(
        [(8, 1), (2, 14), (8, 10), (14, 14)],
        fill=SHIP_COLOR,
        outline=SHIP_OUTLINE,
    )
    img.save(SPRITES_DIR / "lives_icon.png")
    print("  lives_icon.png")


def main():
    print("Generating placeholder sprites...")
    generate_ship()
    generate_ship_thrust()
    generate_asteroids()
    generate_bullet()
    generate_explosion_sheet()
    generate_ship_death_sheet()
    generate_lives_icon()
    print(f"Done. Files written to {SPRITES_DIR}")


if __name__ == "__main__":
    main()
