# Design and QA

Current implementation and verification: **2026-10-28**.

## Direction

type. retains its two-room identity and native document editor. The atelier now emphasizes a coherent cast instrument: a low foundation, continuous profiled side cheeks, a recessed keyboard, thin nickel-ring keys, subdued steel type bars and clear-coated dark enamel. The quiet room keeps its monochrome layout and typography.

## Implementation

- The original local, procedural Three.js model remains self-contained. The casting uses continuous beveled profiles rather than stacked perimeter boxes. Mirrored cheek winding is corrected before material batching.
- Each of 44 type bars has a distinct segment pivot and a raised pose terminating at one print point. Resting bars sit low in a dark basket. Keys, ribbon, bars, spools, rollers, carriage and return lever have separate motion.
- Moving key bodies, insets, rims and legends use four instanced meshes. Legends share one atlas; instance IDs retain click-to-type targets. Static geometry is batched within the moving assemblies.
- Mostly dielectric enamel with a clear coat, subdued nickel and steel, matte rubber, a broad warm window light, matching reflection cards and restrained fill distinguish the materials. Cast shadows and a local chassis contact shadow ground the instrument.
- A mild perspective camera fits fixed physical paper dimensions. Phone layouts crop the outer machine instead of shrinking the writing surface excessively. Entry adds one short camera settle; there is no idle orbit or continuous animation.
- The sheet wraps tangentially around the rubber platen. A four-corner CSS homography projects the native editor onto its stable central plane. Free edges can flex without rotating the whole document on every keystroke.
- Input in the atelier now enters a short queued impression pipeline: each printable key raises its corresponding engraved type slug, the ribbon lifts, and only at the 58 ms strike does the character reach the native textarea. In-flight characters use projected caret positions, with a contact-time carriage correction that keeps the moving print column at the fixed x=0 impact line. The slug target was calibrated to the deformable paper near the platen instead of ending in empty space. In the 3D room the textarea's active line is held near the printing edge, feeding earlier lines upward on wraps and returns. This remains a DOM/native editor projected onto a mesh rather than a per-glyph ink canvas texture.
- Composition commits animate the print mechanism without arbitrarily depressing J. Browser composition/input ordering is coalesced. Native selection, undo, spellcheck and editing remain primary.
- Rendering still sleeps after motion settles and in background tabs. Reduced motion suppresses animated feedback. WebGL initialization failure or context loss retains the native page and CSS keyboard.

- A separate shift basket, articulated under-key levers, a small brass bell and hammer, engraved slugs, and interactive orbit/zoom controls were added. The bell now rings at the right margin instead of on every carriage return. Unsupported IME characters do not move a random typebar.\n- Scope differs intentionally from Antique Typewriter: there is no optional jamming simulation, correction brush, immutable ink layer or focus-paper mode. Backspace remains a standard native editor delete action; the original quiet room is unchanged.\n\n## Verification

`npm run build` (strict TypeScript and Vite), `npm test` and `git diff --check` pass. Thirteen Node tests cover statistics, paper spring behavior, overlapping mechanical timing, rapid same-key retriggers, four-corner projection, distinct type-bar pivots converging at one strike point, finite geometry, instanced-key raycasting, mirrored casting normals and camera fitting.

Camera fitting checks cover scene viewports of **1060 × 822**, **1060 × 596**, **768 × 820**, **390 × 660** and **320 × 550** pixels. These are geometry/projection checks, not browser viewport captures or physical-device tests. An offline depth-buffered geometry rendering was used to inspect silhouette, component placement and occlusion. It does not validate WebGL shaders, PBR reflections, shadow quality or frame rate.

Browser checks on the local preview verified mixed Chinese/Latin/emoji insertion, native undo, Return → undo → redo, autosave/reload, theme switching and the usable CSS fallback. The browser reports that WebGL is disabled, so it cannot exercise the current live 3D path. No current WebGL screenshot or hardware performance result is claimed. The README's October 26 atelier screenshot is explicitly historical.

## Antique-inspired upgrade checks\n\nThe pull-request GitHub Actions workflow runs Node geometry/unit tests and the strict TypeScript/Vite build. New tests cover the mechanical basket and bell, in-flight caret forecasting and the fixed strike point against the platen-wrapped paper. Manual WebGL testing is still necessary to validate perspective alignment while orbiting, visible ink/caret proximity at multiple font sizes, mouse/touch navigation, long-document editing, paste/undo and real IME behavior.\n\n## Remaining verification

Current WebGL shader/material appearance, animated raycasting and real-GPU frame rate need a WebGL-enabled browser. Real phones, virtual keyboard behavior and operating-system IME composition still require direct device testing. Mixed Unicode insertion and composition event handling do not establish a real IME pass.
