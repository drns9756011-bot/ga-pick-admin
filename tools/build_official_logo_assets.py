from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageChops


def remove_white_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    red, green, blue, _ = rgba.split()
    # Preserve only the green brand artwork. This removes the source image's
    # white canvas and faint grey rendering shadow from every exported asset.
    strongest_non_green = ImageChops.lighter(red, blue)
    green_dominance = ImageChops.subtract(green, strongest_non_green)
    alpha = green_dominance.point(
        lambda value: 0 if value < 8 else min(255, (value - 7) * 12)
    )
    rgba.putalpha(alpha)
    return rgba


def trim(image: Image.Image, padding_ratio: float = 0.035) -> Image.Image:
    # Ignore faint antialiasing/shadow pixels when calculating the crop. Small
    # favicons otherwise render the actual symbol at only a third of the canvas.
    visible_alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    bbox = visible_alpha.getbbox()
    if bbox is None:
        raise RuntimeError("Logo pixels were not detected.")
    left, top, right, bottom = bbox
    padding = max(8, int(max(right - left, bottom - top) * padding_ratio))
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


def fit(image: Image.Image, size: tuple[int, int], padding_ratio: float = 0.08) -> Image.Image:
    canvas = Image.new("RGBA", size, (255, 255, 255, 0))
    max_width = int(size[0] * (1 - padding_ratio * 2))
    max_height = int(size[1] * (1 - padding_ratio * 2))
    scale = min(max_width / image.width, max_height / image.height)
    fitted = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas.alpha_composite(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    return canvas


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: build_official_logo_assets.py SOURCE OUTPUT_DIR")

    source_path = Path(sys.argv[1])
    public_dir = Path(sys.argv[2])
    assets_dir = public_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(source_path).convert("RGBA")
    transparent = trim(remove_white_background(source))

    # The source image contains the symbol on the left and the wordmark on the right.
    symbol_source = source.crop((400, 150, 850, 650))
    symbol = trim(remove_white_background(symbol_source), 0.06)

    wide = fit(transparent, (1280, 420), 0.025)
    square = fit(symbol, (1024, 1024), 0.08)

    wide.save(assets_dir / "pickquote-official-logo.png", optimize=True)
    square.save(assets_dir / "pickquote-official-symbol.png", optimize=True)

    sizes = [16, 32, 48, 64, 192, 512]
    for size in sizes:
        icon = square.resize((size, size), Image.Resampling.LANCZOS)
        if size in (16, 32, 48, 64):
            icon.save(public_dir / f"favicon-{size}x{size}.png", optimize=True)
        if size == 32:
            icon.save(public_dir / "favicon.png", optimize=True)
            icon.save(assets_dir / "pick-logo-32.png", optimize=True)
        if size == 192:
            icon.save(assets_dir / "pick-logo-192.png", optimize=True)
        if size == 512:
            icon.save(assets_dir / "pick-logo-512.png", optimize=True)

    apple = square.resize((180, 180), Image.Resampling.LANCZOS)
    apple.save(public_dir / "apple-touch-icon.png", optimize=True)
    apple.save(assets_dir / "apple-touch-icon.png", optimize=True)

    ico_source = square.resize((256, 256), Image.Resampling.LANCZOS)
    ico_source.save(
        public_dir / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    favicon_png = io.BytesIO()
    square.resize((256, 256), Image.Resampling.LANCZOS).save(favicon_png, format="PNG", optimize=True)
    encoded = base64.b64encode(favicon_png.getvalue()).decode("ascii")
    (public_dir / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
        f'<image width="256" height="256" href="data:image/png;base64,{encoded}"/>'
        "</svg>\n",
        encoding="utf-8",
    )

    print(f"wide={wide.size} symbol={square.size}")


if __name__ == "__main__":
    main()
