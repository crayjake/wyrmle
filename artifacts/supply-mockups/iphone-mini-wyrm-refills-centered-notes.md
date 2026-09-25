# Right refill mini-letter alignment investigation

This is a DOM-only mockup of archived DESPAIR v7 after TILE → DAD → WHERE → ANGRY. No production component or rule changed.

The mini squares are 16 × 16 CSS px with a 1px border. Their letters use the same Cutive Mono family as the game tiles, at 13px with a 13px line box. Both Latin fonts loaded before capture; no failed requests occurred.

The previous grid layout centered the glyph advance box. Cutive Mono gives S and P different side bearings: the visible S was 0.5 CSS px right of center, and P was 0.5px left. The old shared translateY(-.02em) also moved both letters up 0.26px unnecessarily. The corrected mockup uses the loaded font's actual ink bounds to center each glyph: S shifts left 0.5px; P shifts right 0.5px; both remove the upward nudge. A DPR3 raster check puts remaining center differences within one device pixel.

The -css.png exports have 375 image pixels across, matching the CSS viewport width; the other exports have 1125 pixels across because device pixel ratio is 3. Use the CSS exports for a normal-size layout comparison. Image viewers can still scale an image, so these are not evidence of physical on-phone size.

Both 375 × 629 (browser content) and 375 × 812 (full-screen content) are provided. They are Chromium emulation with the Playwright iPhone 13 Mini profile, not physical iPhone Safari captures. The board's before/after bounds remain identical at each viewport, and overflow is zero.

The refill values are the actual raw queue remainder: 72 other letters, S × 6, P × 1. They are not a promise that all those letters can be reached with the remaining life budget; this is a separate rules/display question.

Reproduction: /tmp/wyrmle-iphone-mini-wyrm-refills-centered.mjs. Detailed bounding boxes and font metrics are in the matching JSON file.
