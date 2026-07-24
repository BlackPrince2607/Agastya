"""Generate Expo icon assets from assets/images/screen.png."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "images" / "screen.png"
OUT = ROOT / "assets" / "images"

# Match splash / adaptive background in app.json
BG = (5, 2, 10, 255)  # #05020a


def square_canvas(size: int, bg=BG) -> Image.Image:
    return Image.new("RGBA", (size, size), bg)


def fit_center(src: Image.Image, canvas_size: int, scale: float = 1.0) -> Image.Image:
    """Place src centered on a square canvas, scaled to `scale` of canvas."""
    canvas = square_canvas(canvas_size)
    target = max(1, int(canvas_size * scale))
    fitted = src.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    if fitted.mode != "RGBA":
        fitted = fitted.convert("RGBA")
    x = (canvas_size - fitted.width) // 2
    y = (canvas_size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    print(f"source: {SRC.name} {src.size} {src.mode}")

    # App store / Expo master icon — full bleed (logo already has dark bg)
    icon = fit_center(src, 1024, scale=1.0)
    icon_path = OUT / "icon.png"
    icon.save(icon_path, "PNG", optimize=True)
    print(f"wrote {icon_path.name} {icon.size}")

    # Android adaptive foreground — keep artwork in safe ~66% zone
    adaptive = fit_center(src, 1024, scale=0.72)
    adaptive_path = OUT / "adaptive-icon.png"
    adaptive.save(adaptive_path, "PNG", optimize=True)
    print(f"wrote {adaptive_path.name} {adaptive.size}")

    # Splash — logo centered with breathing room on dark bg
    splash = fit_center(src, 1024, scale=0.55)
    splash_path = OUT / "splash-icon.png"
    splash.save(splash_path, "PNG", optimize=True)
    print(f"wrote {splash_path.name} {splash.size}")

    # Web favicon
    fav = fit_center(src, 48, scale=1.0)
    fav_path = OUT / "favicon.png"
    fav.save(fav_path, "PNG", optimize=True)
    print(f"wrote {fav_path.name} {fav.size}")

    # Keep a clean brand asset name for in-app use
    brand = fit_center(src, 512, scale=1.0)
    brand_path = OUT / "agastya-logo.png"
    brand.save(brand_path, "PNG", optimize=True)
    print(f"wrote {brand_path.name} {brand.size}")


if __name__ == "__main__":
    main()
