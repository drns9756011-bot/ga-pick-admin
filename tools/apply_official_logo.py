from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CACHE_KEY = "20260812-official-logo-v1"
PAGES = (
    PUBLIC / "index.html",
    PUBLIC / "quote" / "index.html",
    PUBLIC / "my-quote" / "index.html",
    PUBLIC / "seller" / "index.html",
    PUBLIC / "seller" / "register" / "index.html",
    PUBLIC / "brand" / "index.html",
)

HEADER_PATTERN = re.compile(
    r'<span class="brand-mark" aria-hidden="true">\s*<svg.*?</svg>\s*</span>\s*<span>.*?</span>',
    re.DOTALL,
)

HEADER_REPLACEMENT = (
    '<img class="brand-logo-image" '
    f'src="/assets/pickquote-official-logo.png?v={CACHE_KEY}" '
    'alt="픽견적 가전 견적 비교 플랫폼" />'
)

MOBILE_REPLACEMENT = (
    '<span class="mobile-flow-logo" aria-hidden="true">'
    f'<img src="/assets/pickquote-official-symbol.png?v={CACHE_KEY}" alt="" />'
    '</span>'
)


def update_page(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text, header_count = HEADER_PATTERN.subn(HEADER_REPLACEMENT, text, count=1)
    if header_count != 1:
        raise RuntimeError(f"Header logo replacement failed: {path}")

    mobile_count = text.count('<span class="mobile-flow-logo" aria-hidden="true">P</span>')
    if mobile_count != 1:
        raise RuntimeError(f"Mobile logo replacement failed: {path}")
    text = text.replace(
        '<span class="mobile-flow-logo" aria-hidden="true">P</span>',
        MOBILE_REPLACEMENT,
        1,
    )
    text = text.replace("20260804-center", CACHE_KEY)
    text = text.replace(
        "https://ga-pick.com/assets/pick-logo-512.png",
        "https://ga-pick.com/assets/pickquote-official-symbol.png",
    )
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    for page in PAGES:
        update_page(page)


if __name__ == "__main__":
    main()
