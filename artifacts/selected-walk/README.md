# Selected animation integration

The production game uses footless A and reveal option 1: original scrambled letters and original tile bounce. The continuous route is lives → enemy → refills → tiles → lives. Special tiles use blue Hit, green Life (square icon) and red Revive outlines.

`qa.json` records local Chromium checks at 375×629 and 320×568 with DPR 3, plus reduced-motion and viewport-resize cases. Full-animation checks confirm the expected reveal order, no hidden frames between stages, initial/final piece centers matching the static life meter, and visible pieces remaining on screen. Screenshots use CSS pixels, not enlarged DPR captures.

These checks emulate mobile viewport dimensions; they do not measure frame delivery on physical iPhone Safari hardware.
