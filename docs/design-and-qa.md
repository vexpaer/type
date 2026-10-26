# Design and QA

Current implementation and verification: **2026-10-26**. This replaces the earlier SVG-renderer notes and numeric visual scores.

## Direction

type. keeps its established identity: two rooms share one document. The quiet room is an open monochrome writing surface with Lora; the writer’s atelier uses Special Elite on warm paper above a mechanical typewriter. DM Sans remains the control face in both rooms. Page management and export stay secondary to writing. No sample document is inserted into a new installation.

The supplied Continental photograph informed the mechanical proportions and key treatment. It is a visual reference, not a bitmap asset in the product. The current keyboard uses shallow concave near-black faces, thin aged-nickel rims, ivory legends, short dark stems, a black space bar and classic staggered rows. The earlier thick, bright key treatment was replaced. [DESIGN.md](../DESIGN.md) records the built palette, typography, layout and material rules.

## Implementation

- Three.js loads when the atelier is needed. Local geometry and seeded procedural surfaces supply the machine, desk, paper and lettering; no remote model or texture is loaded.
- Keys and individual type bars, ribbon, spools, carriage and return lever respond to writing. Raycast key and lever clicks enter the same editor input pipeline as keyboard input.
- The paper uses a 40 × 56-segment mesh, a thin underside and an edge outline. Fibre and bump maps, a feed curve and curled edges give it material detail. Coupled damped bending strips advance in fixed 1/120-second steps and react to typing, Return and corner dragging. This is lightweight visual physics, not measured paper mechanics, finite-element analysis or a full rigid-body simulation.
- The title input and textarea remain native DOM controls. Their shared page follows the projected central reading area while the surrounding mesh deforms. Click-to-type and Return use a native undo bridge through `execCommand`, with a range-edit fallback when insertion is unavailable; fallback undo behavior remains browser-dependent.
- Rendering sleeps at rest and in background tabs. Reduced motion suppresses animated mechanical feedback and paper flexing. WebGL initialization failure or context loss switches to an editable paper surface with a dimensional CSS keyboard. The previous SVG scene renderer is no longer used. Generated paper fibre is retained after context loss when available; startup without WebGL does not guarantee this texture.

## Verification

The production build and all five Node tests passed. Three tests cover paper spring stability, its pinned feed edge and consistent fixed-step behavior across frame intervals.

The current WebGL scene was captured in Chromium with ANGLE SwiftShader at **1440 × 1000**, **390 × 844**, **768 × 1024** and **1366 × 768** CSS pixels. Independent visual review examined all four captures and found no remaining material visual issue. DOM checks found no horizontal overflow at those sizes. These are browser viewport checks, not physical-device tests. The README’s [atelier image](screenshots/atelier.jpg) comes from this WebGL capture; it does not show the retired SVG fallback.

Browser interaction checks passed with zero page errors:

- Mixed Chinese, Latin and emoji insertion; autosave and reload; long-document caret scrolling.
- Raycast key clicks and corner dragging; reduced-motion behavior; a usable CSS fallback after forced WebGL context loss.
- Text preservation across room changes, including a settled quiet-room layout with the atelier transform cleared.
- Return click → undo → redo, and raycast A-key click → undo → redo.

## Remaining limits

Desktop hardware-GPU frame rate, real phones and their virtual keyboards, and genuine operating-system IME composition have not been verified. Mixed CJK text insertion does not establish an IME composition pass. Native controls and composition event handling are present, but these device-specific behaviors still need direct testing. SwiftShader confirms the WebGL rendering path and interactions without establishing hardware performance.
