# Test images

Synthetic photos used for manually verifying
`src/lib/receiptEnhance.ts` via `src/Pages/DevReceiptScanTestPage.tsx`
(`#/dev/receipt-scan-test`) — see
[architecture/receipt-enhance.md](../../architecture/receipt-enhance.md).
Not real receipts (no receipt photos are checked into the repo); generated
with Pillow so the exercised scenario is obvious from the filename and
reproducible without needing a real photo.

- `angled-receipt.jpg` — a light rectangle with horizontal ruled lines,
  rotated ~8° on a noisy dark background. Exercises the boundary-detection
  + perspective-crop path (`detectReceiptBoundary` should find a
  4-point quad here, `cropToQuad` should deskew it).
- `no-boundary.jpg` — uniform noisy gray, no distinct rectangle. Exercises
  the no-confident-boundary fallback path (`detectReceiptBoundary` should
  return `null`; the dev page should fall back to the full image's
  corners, inset via `insetQuad` for easier dragging).

Regenerate/extend with a script like:

```python
from PIL import Image, ImageDraw
import random

W, H = 1200, 1600
bg = Image.new("RGB", (W, H), (60, 65, 70))
draw = ImageDraw.Draw(bg)
random.seed(42)
for _ in range(4000):
    x, y = random.randint(0, W - 1), random.randint(0, H - 1)
    c = random.randint(30, 90)
    draw.point((x, y), fill=(c, c, c))

receipt = Image.new("RGB", (700, 1100), (250, 250, 245))
rdraw = ImageDraw.Draw(receipt)
for i in range(15, 1080, 40):
    rdraw.line([(30, i), (670, i)], fill=(180, 180, 180), width=3)
rdraw.text((250, 40), "RECEIPT", fill=(20, 20, 20))

rotated = receipt.rotate(8, expand=True, fillcolor=(60, 65, 70))
bg.paste(rotated, (230, 220), None)
bg.save("angled-receipt.jpg", quality=90)
```
