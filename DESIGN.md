---
name: type.
description: A quiet place to write. Two rooms, one page.
colors:
  quiet-ground: "#fafafa"
  quiet-ink: "#222"
  quiet-muted: "#737373"
  quiet-soft: "#ededed"
  quiet-panel: "#fff"
  quiet-line: "#e6e6e6"
  atelier-ground: "#302820"
  atelier-ink: "#eee5d5"
  atelier-muted: "#c1b5a5"
  atelier-panel: "#393129"
  paper: "#f5efdf"
  paper-ink: "#332c23"
  enamel: "#17201d"
  key-face: "#101712"
  aged-nickel: "#a29f8d"
  ivory-legend: "#e0d7bc"
  control-key: "#602b26"
typography:
  wordmark:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-2.5px"
  title:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.75px"
  body:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "-0.12px"
  atelier-title:
    fontFamily: "Special Elite, Courier New, monospace"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.6px"
  atelier-body:
    fontFamily: "Special Elite, Courier New, monospace"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: "0.1px"
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  menu-item: "5px"
  options-menu: "10px"
  theme-picker: "12px"
  pill: "100px"
  circle: "50%"
spacing:
  compact: "8px"
  control-gap: "12px"
  panel: "24px"
components:
  new-page-quiet:
    backgroundColor: "{colors.quiet-ink}"
    textColor: "{colors.quiet-panel}"
    rounded: "{rounded.menu-item}"
  icon-button-quiet:
    textColor: "{colors.quiet-muted}"
    rounded: "{rounded.circle}"
    size: "40px"
  icon-button-quiet-hover:
    backgroundColor: "{colors.quiet-soft}"
    textColor: "{colors.quiet-ink}"
    rounded: "{rounded.circle}"
    size: "40px"
---

# Design System: type.

## Overview

**Creative North Star: "Two rooms, one page."**

The writer’s words are the center of the interface. The quiet room gives them an open, monochrome surface; the atelier places the same native editor on warm paper above a detailed mechanical instrument. Controls remain small, calm and consistent across rooms.

This documents the existing product. The atelier refinement adds physical detail without replacing the quiet room’s identity. Its materials are restrained: dark enamel, near-black key faces, aged nickel, ivory lettering and fibrous paper. The Continental photograph supplied during refinement is a visual reference, not a product image asset.

**Key Characteristics:**

- One readable document, with utility controls at the perimeter.
- Lora for quiet writing, Special Elite for atelier writing, DM Sans for controls.
- Material depth and responsive mechanical feedback in the atelier.
- Native text editing remains usable independently of the 3D renderer.

## Colors

The quiet room uses a neutral monochrome palette. The atelier shifts the surrounding neutrals toward warm brown while keeping the paper light and its ink dark. Frontmatter records built values; lighting and procedural maps modify the rendered materials.

### Primary

Quiet ink carries the document and primary page action. In the atelier, paper ink carries the writing while atelier ink serves controls on the dark surrounding room. There is no bright interface accent.

### Neutral

Quiet ground, panel, soft and line distinguish the canvas, opaque menus, interactive states and separators. Quiet muted carries secondary labels. Atelier ground, panel and muted perform the same roles in the warm room.

Paper and ivory legends belong to physical surfaces. Enamel, key face and aged nickel distinguish the machine’s casing, concave key insets and narrow rims. The muted control-key red is confined to the machine’s special keys.

**The Material Rule.** Keep machine colors attached to their materials; do not spread nickel, parchment or control-key red into unrelated quiet-room controls.

## Typography

Lora’s regular serif establishes the quiet room and wordmark. Special Elite supplies the atelier’s typewritten character. DM Sans keeps menus, status and actions legible. Fonts are self-hosted; fallback stacks remain available, including for glyphs outside the bundled Latin faces.

The frontmatter gives desktop defaults. The writing size is adjustable, and responsive rules reduce titles and body sizes. Quiet writing uses generous leading; atelier text is slightly denser while retaining a readable central column. The atelier body stays at least 16px on narrow screens. Key legends use canvas-drawn Georgia lettering rather than the editor face.

**The Writing Rule.** Preserve the native caret, selection and editable text. Do not replace the document with a canvas texture to imitate printed ink.

## Layout

The quiet room is a centered column with a maximum width of 680px, a top utility bar and a fixed bottom bar. Its title precedes the date and body; the empty page begins with placeholders rather than sample writing. Focus mode withdraws the perimeter controls while retaining an explicit exit.

The atelier shares a coordinate relationship between the machine, paper mesh and DOM editor. The native page uses a four-corner CSS homography over the paper’s central reading region; surrounding edges can curl and flex. Long writing scrolls inside the paper so the caret can remain above the platen. Keep menu surfaces opaque over text.

At 768px and 520px boundaries, header spacing contracts, secondary statistics disappear and paper padding reduces. The machine stage is contained within the room without horizontal page overflow. Short desktop viewports retain a minimum room height rather than crushing the paper. The drawer is at most 360px wide and leaves a visible edge of the page; narrow theme pickers fit within the viewport. Respect bottom safe-area padding.

## Elevation & Depth

The quiet room is predominantly flat; fine separators, tonal state changes and diffuse menu shadows establish hierarchy. Floating menus use a restrained shadow (`0 12px 44px #0000000d`); the drawer uses a broad side shadow (`10px 0 60px #0000000a`).

The atelier’s depth comes from real mesh geometry, physically based materials, environment light and cast shadows. Thin rims and shallow concave faces make individual keys distinct. Short stems, a recessed keyboard bed and concealed spring hardware keep the keyboard silhouette low. Paper has a subtly textured surface, a thin underside, a visible edge and restrained asymmetric curls. Its feed edge wraps tangentially around the rubber platen. Keep enamel mostly dielectric with a clear coat; reserve metallic reflections for exposed metal. Its central reading area remains calm enough to edit.

## Shapes

Utility icon buttons are circular; the room switch is a pill. Menus and list rows have modest rounded corners. The paper reads as a thin sheet rather than a rounded card. The machine combines one substantial enamel base and continuous profiled side cheeks with a recessed key bed, finer rods, staggered round keys and a long black space bar. Its gentle perspective camera fits fixed paper dimensions rather than stretching the paper to the viewport. Narrow screens deliberately crop the outer machine while preserving the page. Preserve the current shallow key profile and narrow metal rims.

## Components

**Writing page.** Use native, labelled title and body controls. The 3D mesh is a material surround, not a replacement input. Preserve selection and text through room changes, and clear atelier positioning when returning to the quiet room.

**Typewriter.** Individual keys and type bars, ribbon, spools, carriage and return lever respond to input. Every type bar pivots independently toward one strike point. Overlapping stroke envelopes and continuous key springs preserve rapid repeated input. The carriage follows measured visual line progress with bounded travel, including soft wraps; composition commits use neutral print feedback. Shared instanced key meshes and a legend atlas limit draw calls. Raycast keys and the lever support click-to-type; physical keyboard editing remains primary. Corner controls support pointer dragging and keyboard flexing. The paper response is a damped visual model rather than a measured material simulation.

**Motion.** Feedback follows a keystroke or a deliberate room change. Mechanical and paper motion settles; rendering sleeps at rest and in background tabs. Honor reduced motion by suppressing animated feedback and corner flexing. Do not add continuous idle movement.

**Utilities and panels.** Icons use muted ink, then a soft surface and stronger ink on hover or pressed states. Buttons retain visible keyboard focus. Menus support keyboard navigation; dialogs restore focus when closed. Focus mode, sound and room choices expose their state through accessible attributes. Synthesized sound is optional.

**Fallback.** If WebGL is unavailable or lost, keep an editable native page and show the dimensional CSS keyboard with labelled buttons. Do not depend on the machine canvas for essential writing actions. The retired SVG renderer is not part of this system.

## Do's and Don'ts

- **Do** keep the writing area readable above the machine and maintain text, selection and undo behavior when adding interactions.
- **Do** use local procedural material detail and self-hosted type rather than requiring a remote scene asset.
- **Do** preserve keyboard focus, labelled actions, reduced motion and an editable fallback.
- **Do** check narrow and short viewports for overflow, caret visibility and access to controls.
- **Don't** restore the rejected thick, bright keycaps or expose decorative springs above the keyboard bed.
- **Don't** apply the atelier’s texture and dimensional treatment to the monochrome quiet room.
- **Don't** describe browser viewport checks as real-device testing or visual paper motion as validated physical simulation.
