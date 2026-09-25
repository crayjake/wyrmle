#!/usr/bin/env python3
"""Export the existing vector wyrm design; requires librsvg and ImageMagick.

The social card is an outlined SVG: rebuilding requires no installed fonts,
network access or image model. Keep full-bleed backgrounds opaque for iOS.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
ICONS = PUBLIC / 'icons'
ICONS.mkdir(exist_ok=True)
SOURCE = ROOT / 'assets/brand/wyrm-icon.svg'


def render(source: Path, target: Path, size: int | None = None):
    command = ['rsvg-convert', str(source), '-o', str(target)]
    if size:
        command += ['-w', str(size), '-h', str(size)]
    subprocess.run(command, check=True)
    # Write actual RGB PNGs, without transparency or renderer metadata.
    subprocess.run(['magick', str(target), '-alpha', 'off', '-strip',
                    '-define', 'png:color-type=2', str(target)], check=True)


shutil.copyfile(SOURCE, PUBLIC / 'favicon.svg')
for filename, size in [('wyrm-192-v2.png', 192), ('wyrm-512-v2.png', 512)]:
    render(SOURCE, ICONS / filename, size)
render(SOURCE, PUBLIC / 'apple-touch-icon-v2.png', 180)
for fallback in ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']:
    shutil.copyfile(PUBLIC / 'apple-touch-icon-v2.png', PUBLIC / fallback)
with tempfile.TemporaryDirectory(prefix='wyrmle-brand-') as directory:
    temporary = Path(directory)
    # All essential artwork fits inside the manifest maskable 80%-diameter circle.
    masked = SOURCE.read_text().replace('<rect x="6"', '<g transform="translate(2.88 2.88) scale(0.82)"><rect x="6"')
    masked = masked.replace('</svg>', '</g></svg>')
    (temporary / 'maskable.svg').write_text(masked)
    render(temporary / 'maskable.svg', ICONS / 'wyrm-maskable-512-v2.png', 512)
    small = []
    for size in [16, 32, 48]:
        png = temporary / f'{size}.png'
        render(SOURCE, png, size)
        small.append(str(png))
    subprocess.run(['magick', *small, str(PUBLIC / 'favicon.ico')], check=True)
render(ROOT / 'assets/brand/social-preview.svg', PUBLIC / 'social-preview-v1.png')
print('Exported SVG/ICO favicon, opaque Apple/manifest PNGs and 1200×630 share card.')
