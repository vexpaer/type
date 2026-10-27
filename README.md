# type.

A quiet place to write. Two rooms, one page.

**The quiet room** pairs an open monochrome canvas with Lora typography, generous line spacing, a native caret and restrained motion. **The writer’s atelier** places the same writing on textured parchment, fed into an original, animated 3D typewriter.

## The rooms

| The quiet room | Atelier reference · October 26 |
| --- | --- |
| ![Minimalist writing room](docs/screenshots/quiet-room.jpg) | ![3D typewriter and paper in the writer’s atelier](docs/screenshots/atelier.jpg) |

The atelier image is a historical WebGL capture from October 26, before the mechanical refinement below. It does not show the current shell, perspective camera or paper feed. Current verification and its limits are recorded in [the QA notes](docs/design-and-qa.md).

## Write

Open the page and start typing. The button in the bottom-right corner changes rooms without replacing the document or its selection.

- Local autosave with multiple named pages and a two-step delete action.
- Plain-text and Markdown import; UTF-8 text download and clipboard copy.
- Live Unicode-aware word counts, character counts and reading time.
- Focus mode, adjustable text size, optional synthesized key sounds and a carriage-return bell.
- Native text editing, selection, undo, spellcheck and IME composition support.
- Responsive phone, tablet and desktop layouts, keyboard navigation and reduced-motion support.
- Self-hosted fonts. No analytics, accounts, external assets or writing API.

Your writing is stored in this browser’s local storage. It is not an online backup: clearing site data or changing browsers will not carry your pages over. Use **Download .txt** to keep a copy.

## Keyboard

| Action | Shortcut |
| --- | --- |
| Download current page | Ctrl / ⌘ S |
| New page | Alt N |
| Enter / leave focus | Alt F |
| Close a panel / leave focus | Escape |
| Move between controls | Tab / Shift Tab |
| Move in a menu | Up / Down |

## Develop

Node 22 or newer.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Vite builds a completely static site into `dist/`, with relative asset URLs so it can also live under `/type/` on GitHub Pages.

### GitHub Pages

The workflow runs the build and unit tests on pushes and pull requests. Every push to `main` automatically publishes the built site to GitHub Pages; pull requests only run checks. The workflow can also be run manually from the Actions tab. The repository’s **Settings → Pages → Source** must be set to **GitHub Actions**.

### The typewriter

`src/typewriter.ts` lazy-loads with the atelier and builds the scene from local meshes and procedural textures. The machine has a continuous profiled enamel casting, a recessed keyboard, shallow concave near-black keys with thin aged-nickel rims and ivory legends, a black space bar, individual type bars, spools, two-tone ribbon, platen, paper bail, margin scale and return lever. Each type bar has its own segment pivot and reaches the same strike point. Key bodies and lettering use shared instanced meshes and one legend atlas. A gentle perspective camera frames the whole assembly on desktop and crops the machine sides on phones to preserve paper readability. Keys, type bars, ribbon, spools, carriage and return lever respond to typing with overlapping strokes and synchronized impact audio. The carriage follows the measured visual column, including soft wraps and wide glyphs, within bounded travel that keeps the native editor readable. Composition commits animate the print mechanism without choosing an unrelated letter key. Click the 3D keys or return lever to write into the same native editor. In the atelier, single-character strokes are queued until the simulated typebar makes contact (58 ms); multiple characters in flight each retain their predicted print column. The current line stays close to the platen while older lines feed upward, and the carriage travels across the available writing width. A real margin threshold rings the carriage-mounted bell. Matching type slugs have etched character faces and keys operate small exposed levers.

**Explore the 3D typewriter:** drag an empty part of the scene to orbit, or right-drag anywhere over the instrument; use the scroll wheel to zoom and double-click the scene to restore the original view. Click modeled keys to type. Keyboard selection, Backspace, undo, paste and IME input remain native editing actions, rather than enforcing Antique Typewriter’s permanent-ink deletion rules. Reduced-motion mode skips delayed strokes.\n\nThe paper is a deforming 40 × 56-segment mesh with fixed physical dimensions, a tangent wrap around the rubber platen, a thin underside, visible edge and subtle procedural fibre and bump textures. A damped, coupled bending model responds to typing, carriage returns and corner dragging. This is lightweight visual physics, not measured paper mechanics, finite-element analysis or a full rigid-body simulation. A four-corner projective transform places the native textarea over the paper’s stable central reading area, preserving normal editing and selection. Typing moves the free edges; the reading plane stays rigid.

WebGL uses dielectric clear-coated enamel, metal-specific surfaces, large window lighting, matching reflection cards, cast shadows and local contact shading. Rendering pauses at rest and in background tabs; reduced-motion mode suppresses animated feedback and corner flexing. If WebGL cannot initialize or its context is lost, an editable paper surface and dimensional CSS keyboard remain available. There is no SVG scene renderer.

## Design and verification

The established **Achromatic ledger** direction from [Leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) remains: a monochrome quiet room and a warm, tactile atelier. The latest refinement preserves that identity while rebuilding the machine and paper. See [the design system](DESIGN.md) and [the dated design and QA notes](docs/design-and-qa.md) for current evidence and verification limits.

Fonts: DM Sans, Lora and Special Elite, distributed under the SIL Open Font License; their licenses ship in `public/licenses/`. The model, interface and procedural sound effects are original code. No stock photographs or external 3D assets are used.
