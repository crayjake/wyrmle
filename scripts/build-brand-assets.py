#!/usr/bin/env python3
"""Export the selected W-shaped wyrm; requires librsvg and ImageMagick.

The social card is an outlined SVG: rebuilding requires no installed fonts,
network access or image model. Keep full-bleed backgrounds opaque for iOS.
"""
from pathlib import Path
import base64
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
ICONS = PUBLIC / 'icons'
ICONS.mkdir(exist_ok=True)
SOURCE = ROOT / 'assets/brand/wyrm-w-v3.png'


def render(source: Path, target: Path, size: int | None = None):
    command = ['rsvg-convert', str(source), '-o', str(target)]
    if size:
        command += ['-w', str(size), '-h', str(size)]
    subprocess.run(command, check=True)
    # Write actual RGB PNGs, without transparency or renderer metadata.
    subprocess.run(['magick', str(target), '-alpha', 'off', '-strip',
                    '-define', 'png:color-type=2', str(target)], check=True)


def export_icon(target: Path, size: int, maskable: bool = False):
    artwork_size = round(size * 0.78) if maskable else size
    command = ['magick', str(SOURCE), '-resize', f'{artwork_size}x{artwork_size}']
    if maskable:
        inset = (size - artwork_size) // 2
        # Extend the source's own background pixels so the safe-area padding
        # has no visible square seam around the approved artwork.
        command += ['-virtual-pixel', 'edge', '-set', 'option:distort:viewport',
                    f'{size}x{size}-{inset}-{inset}', '-distort', 'SRT', '0', '+repage']
    subprocess.run([*command,
                    '-alpha', 'off', '-strip', '-define', 'png:color-type=2', str(target)], check=True)


for filename, size in [('wyrm-192-v3.png', 192), ('wyrm-512-v3.png', 512)]:
    export_icon(ICONS / filename, size)
export_icon(PUBLIC / 'apple-touch-icon-v3.png', 180)
# A self-contained SVG fallback preserves the approved bitmap exactly.
encoded = base64.b64encode((ICONS / 'wyrm-512-v3.png').read_bytes()).decode('ascii')
(PUBLIC / 'favicon.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    '<title>WYRMLE W-shaped wyrm</title>'
    f'<image width="512" height="512" href="data:image/png;base64,{encoded}"/></svg>\n')
for fallback in ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']:
    shutil.copyfile(PUBLIC / 'apple-touch-icon-v3.png', PUBLIC / fallback)
export_icon(ICONS / 'wyrm-maskable-512-v3.png', 512, maskable=True)
with tempfile.TemporaryDirectory(prefix='wyrmle-brand-') as directory:
    temporary = Path(directory)
    small = []
    for size in [16, 32, 48]:
        png = temporary / f'{size}.png'
        export_icon(png, size)
        small.append(str(png))
    subprocess.run(['magick', *small, str(PUBLIC / 'favicon.ico')], check=True)
render(ROOT / 'assets/brand/social-preview.svg', PUBLIC / 'social-preview-v1.png')
print('Exported W-shaped wyrm v3 icons and 1200×630 share card.')
