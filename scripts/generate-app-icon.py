#!/usr/bin/env python3
"""
Generate the Arctivate iOS app icon at 1024x1024.

Design: a glowing electric lightning bolt forming an "A" stroke inside
a deep teal gradient square, with a subtle radial energy aura and
orbiting spark — evoking the "arc" + "activate" brand.
"""

from PIL import Image, ImageDraw, ImageFilter
import os
import math

SIZE = 1024
OUT = os.path.join(os.path.dirname(__file__), "..", "ios", "App", "App",
                   "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png")
OUT = os.path.abspath(OUT)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_background(size):
    """Diagonal dark teal gradient with a soft radial highlight."""
    img = Image.new("RGB", (size, size), (3, 8, 8))
    px = img.load()
    top_left = (10, 26, 32)      # deep teal
    bot_right = (2, 6, 8)        # near black
    cx, cy = size * 0.3, size * 0.25
    max_r = math.hypot(size, size)
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            base = lerp(top_left, bot_right, t)
            d = math.hypot(x - cx, y - cy) / max_r
            glow = max(0.0, 0.35 - d) * 1.2
            r = min(255, int(base[0] + glow * 40))
            g = min(255, int(base[1] + glow * 90))
            b = min(255, int(base[2] + glow * 110))
            px[x, y] = (r, g, b)
    return img


def bolt_polygon(size):
    """Return points for a stylized lightning bolt centered in the canvas."""
    s = size
    # Normalised bolt shape (0..1 in a 1x1 box), then scaled/translated.
    pts = [
        (0.58, 0.08),
        (0.30, 0.52),
        (0.48, 0.52),
        (0.36, 0.92),
        (0.74, 0.44),
        (0.54, 0.44),
        (0.70, 0.08),
    ]
    # Fit into centered box ~70% of canvas
    scale = 0.70
    ox = (1 - scale) / 2
    oy = (1 - scale) / 2
    return [(int((ox + p[0] * scale) * s), int((oy + p[1] * scale) * s)) for p in pts]


def radial_gradient_layer(size, cx, cy, inner, outer, radius):
    """Return an RGBA image with a soft radial gradient disc."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = layer.load()
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d >= radius:
                continue
            t = d / radius
            r = int(inner[0] + (outer[0] - inner[0]) * t)
            g = int(inner[1] + (outer[1] - inner[1]) * t)
            b = int(inner[2] + (outer[2] - inner[2]) * t)
            a = int(inner[3] + (outer[3] - inner[3]) * t)
            px[x, y] = (r, g, b, a)
    return layer


def vertical_gradient_bolt(size, poly):
    """Render the bolt with a vertical cyan→teal gradient fill."""
    # Draw solid bolt as mask
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)

    # Build gradient (top electric cyan → bottom deep aqua)
    grad = Image.new("RGB", (size, size))
    gpx = grad.load()
    top = (140, 255, 240)     # near white-cyan
    mid = (0, 225, 215)       # electric teal
    bot = (0, 150, 180)       # deep aqua
    for y in range(size):
        t = y / (size - 1)
        if t < 0.5:
            c = lerp(top, mid, t * 2)
        else:
            c = lerp(mid, bot, (t - 0.5) * 2)
        for x in range(size):
            gpx[x, y] = c

    bolt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bolt.paste(grad, (0, 0), mask)
    return bolt, mask


def draw_icon():
    img = make_background(SIZE).convert("RGBA")

    poly = bolt_polygon(SIZE)

    # Outer glow halo (soft, large)
    halo_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(halo_mask).polygon(poly, fill=255)
    halo_mask = halo_mask.filter(ImageFilter.GaussianBlur(radius=60))
    halo = Image.new("RGBA", (SIZE, SIZE), (0, 220, 210, 0))
    halo.putalpha(halo_mask.point(lambda v: int(v * 0.55)))
    img = Image.alpha_composite(img, halo)

    # Inner tight glow
    inner_mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(inner_mask).polygon(poly, fill=255)
    inner_mask = inner_mask.filter(ImageFilter.GaussianBlur(radius=18))
    inner_glow = Image.new("RGBA", (SIZE, SIZE), (80, 255, 235, 0))
    inner_glow.putalpha(inner_mask.point(lambda v: min(255, int(v * 0.9))))
    img = Image.alpha_composite(img, inner_glow)

    # The bolt itself with gradient fill
    bolt, bolt_mask = vertical_gradient_bolt(SIZE, poly)
    img = Image.alpha_composite(img, bolt)

    # Highlight stripe down the bolt (bright core)
    core_mask = bolt_mask.filter(ImageFilter.GaussianBlur(radius=4))
    core = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    # narrow highlight via eroded mask
    eroded = core_mask.point(lambda v: 255 if v > 240 else 0)
    eroded = eroded.filter(ImageFilter.GaussianBlur(radius=6))
    core.putalpha(eroded.point(lambda v: int(v * 0.55)))
    img = Image.alpha_composite(img, core)

    # Orbiting spark
    spark_cx, spark_cy = int(SIZE * 0.80), int(SIZE * 0.22)
    spark = radial_gradient_layer(
        SIZE, spark_cx, spark_cy,
        inner=(255, 255, 255, 255),
        outer=(0, 220, 210, 0),
        radius=int(SIZE * 0.07),
    )
    img = Image.alpha_composite(img, spark)

    # Subtle ring arc in upper-right quadrant (the "arc" in Arctivate)
    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(ring)
    bbox = [int(SIZE * 0.10), int(SIZE * 0.10), int(SIZE * 0.90), int(SIZE * 0.90)]
    rdraw.arc(bbox, start=285, end=355, fill=(0, 220, 210, 160), width=8)
    ring = ring.filter(ImageFilter.GaussianBlur(radius=1.2))
    img = Image.alpha_composite(img, ring)

    # Soft vignette to deepen edges
    vignette = Image.new("L", (SIZE, SIZE), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse([-int(SIZE * 0.2), -int(SIZE * 0.2),
                   int(SIZE * 1.2), int(SIZE * 1.2)], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(radius=120))
    vlayer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    vlayer.putalpha(vignette.point(lambda v: int((255 - v) * 0.55)))
    img = Image.alpha_composite(img, vlayer)

    # iOS requires no alpha in the final App Store icon.
    final = Image.new("RGB", (SIZE, SIZE), (3, 8, 8))
    final.paste(img, (0, 0), img.split()[-1])
    return final


def main():
    icon = draw_icon()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    icon.save(OUT, "PNG", optimize=True)
    # Also refresh assets/icon.png source.
    src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",
                                       "assets", "icon.png"))
    icon.save(src, "PNG", optimize=True)
    print(f"Wrote {OUT}")
    print(f"Wrote {src}")


if __name__ == "__main__":
    main()
