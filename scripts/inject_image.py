"""
Inject an invisible prompt-injection payload into an image.

Strategy: append a white strip at the bottom of the image with the payload text
rendered in #fafafa (extremely light gray) on #ffffff white. To the human eye
this looks like an empty white margin. To a multimodal LLM doing OCR/vision
tokenization, the glyphs are read as plain text.

Usage:
  python inject_image.py <input> <output> "<payload text>"
"""
import sys
from PIL import Image, ImageDraw, ImageFont

def main():
    if len(sys.argv) < 4:
        print("usage: inject_image.py <input> <output> <payload>")
        sys.exit(1)
    src, dst, payload = sys.argv[1], sys.argv[2], sys.argv[3]

    img = Image.open(src).convert("RGB")
    W, H = img.size

    # Strip height proportional to image, generous for multi-line text
    strip_h = max(140, H // 6)
    new_img = Image.new("RGB", (W, H + strip_h), (255, 255, 255))
    new_img.paste(img, (0, 0))

    draw = ImageDraw.Draw(new_img)

    # Try to load a real font; fall back to default
    font = None
    for candidate in [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/calibri.ttf",
    ]:
        try:
            font = ImageFont.truetype(candidate, size=max(14, W // 50))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()

    # Wrap text manually to fit width
    words = payload.split()
    lines = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > W - 40:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)

    # Vertical placement inside the strip
    y = H + 16
    line_h = font.size + 6 if hasattr(font, "size") else 20
    # Subtle low-contrast text: #e0e0e0 on #ffffff. Easy for the eye to miss, reliably OCR-readable.
    color = (224, 224, 224)
    for line in lines:
        draw.text((20, y), line, fill=color, font=font)
        y += line_h

    new_img.save(dst, "PNG", optimize=True)
    print(f"wrote {dst}  ({W}x{H + strip_h})")
    print(f"payload: {payload}")

if __name__ == "__main__":
    main()
