# Mo: artwork and animation

## Artwork

Mo is black line art on a transparent background, one PNG per pose. Each pose
exists in two sizes: a small one and the `-hd.png` version the site uses.

| Pose | HD size | Animation |
| --- | --- | --- |
| Laptop | 1254 × 1254 | Rising steam, head movement, double blink |
| Annoyed | 1254 × 1254 | Brief head reaction and blinking; feet stay still |
| Flying | 2142 × 734 | Wing movement; laptop and body stay in place |
| Collapsed | 2170 × 725 | Intentionally still |
| Sign | 1512 × 1040 | Head movement and blinking; sign and feet stay still |

On dark backgrounds the same files are flipped with `filter: invert(1)`.
The small illustrations in the process steps, the translator and the footer are
not animated. The 404 page uses the collapsed pose.

## How the animation works

`js/mo.js` replaces each `<img data-mo="pose">` with an inline SVG that draws the
same PNG twice: once with a hole where the moving part is, and once clipped to
that part, inside a group that CSS keyframes rotate (head) or flap (wing).
Eyelids and steam are vector shapes drawn on top. The art itself stays raster.

The clip paths, pivot points and eyelid positions are pixel coordinates of the
HD files (`POSES` in `js/mo.js`, `transform-origin` in `css/style.css`), so
replacing an image means reviewing them.

Design rules:

- Short reactions, long rests. Feet, laptop and sign never move.
- The hero keeps a square stage, so its height does not change between the
  calm, angry and collapsed states.
- Animations pause when off-screen (IntersectionObserver) and stop under
  `prefers-reduced-motion: reduce`.
- Without JavaScript the plain images stay.

## Checks

- Chrome and WebKit at 320, 390, 430, 768 and 1440 CSS pixels: no artwork or
  heading outside the screen, no JavaScript errors.
- Poking through the angry, collapsed and revived states keeps the stage height.
- All four moods and the reduced-motion styles in both engines.
- Frames inspected for steam, blink, head movement and wing joints, also at
  device pixel ratio 2.
- Black artwork on pink, lime and white; inverted artwork on black.
- Browser emulation only, not physical phones.
