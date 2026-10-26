# type.

A quiet place to write. Two rooms, one page.

**The quiet room** pairs an open monochrome canvas with Lora typography, generous line spacing, a native caret and restrained motion. **The writer’s atelier** places the same writing on textured parchment, fed into an original, animated 3D typewriter.

## The rooms

| The quiet room | The writer’s atelier |
| --- | --- |
| ![Minimalist writing room](docs/screenshots/quiet-room.jpg) | ![3D typewriter and paper in the writer’s atelier](docs/screenshots/atelier.jpg) |

The atelier screenshot was captured in WebGL-enabled Chromium using ANGLE SwiftShader. It shows the current 3D scene, including its lighting, shadows and paper mesh; it is not a hardware-GPU performance benchmark.

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

`src/typewriter.ts` lazy-loads with the atelier and builds the scene from local meshes and procedural textures. The machine has an enamel body, shallow concave near-black keys with thin aged-nickel rims and ivory legends, a black space bar, individual type bars, spools, two-tone ribbon, platen, paper bail, margin scale and return lever. Keys, type bars, ribbon, spools, carriage and return lever respond to typing. Click the 3D keys or return lever to write into the same native editor.

The paper is a deforming 40 × 56-segment mesh with a thin underside, visible edge and procedural fibre and bump textures. A damped, coupled bending model responds to typing, carriage returns and corner dragging. This is lightweight visual physics, not measured paper mechanics, finite-element analysis or a full rigid-body simulation. The native textarea stays over the paper’s central reading area, preserving normal editing and selection.

WebGL uses physically based materials, environment lighting and shadows. Rendering pauses at rest and in background tabs; reduced-motion mode suppresses animated feedback and corner flexing. If WebGL cannot initialize or its context is lost, an editable paper surface and dimensional CSS keyboard remain available. There is no SVG scene renderer.

## Design and verification

The established **Achromatic ledger** direction from [Leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) remains: a monochrome quiet room and a warm, tactile atelier. The latest refinement preserves that identity while rebuilding the machine and paper. See [the design system](DESIGN.md) and [the dated design and QA notes](docs/design-and-qa.md) for current evidence and verification limits.

Fonts: DM Sans, Lora and Special Elite, distributed under the SIL Open Font License; their licenses ship in `public/licenses/`. The model, interface and procedural sound effects are original code. No stock photographs or external 3D assets are used.
