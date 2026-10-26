# Design and QA

## Direction

Taste Skill v2 application run: **Achromatic ledger**, seed `20376927`. Palette and typography were kept from the brief. No redraws.

The job is to start writing immediately. The text is the largest object; page management and export stay secondary. A native textarea preserves the operating system’s editing and IME behavior. No sample documents are inserted into a new installation.

The central idea: the same page moves between an open writing surface and a tactile machine. The first room uses DM Sans for controls and Lora for writing; the atelier uses DM Sans for controls and Special Elite for writing. The two rooms share one source of document state.

The vintage scene uses shadows, material textures and a warm light falloff because physical parchment and a 3D typewriter are explicit requirements. These exceptions are documented beside the relevant rules. Monospace fallback faces serve the requested typewriter lettering. There are no retrieved images to credit.

## Browser verification

The managed cloud browser was used through its supported CUA interface. Desktop and responsive iframe viewports at 390, 768 and 1440 CSS pixels were reviewed. These are responsive layout checks, not physical-device or virtual-keyboard tests.

Verified flows: entering a title and body; updating counts; retaining a long mixed Chinese/English document through refresh and theme switching; creating and reopening pages; opening and closing the drawer; entering and leaving focus mode; adjusting text size; using physical-key input and Return; downloading a UTF-8 text file; preserving a usable writing area above the platen.

The final production build was also opened through Vite Preview, and its built asset URLs were verified.

The cloud browser disables WebGL. The same scene’s SVG fallback and key animations were visually inspected. WebGL code passes TypeScript and the production build, but its GPU lighting, shadows and frame rate require verification in a WebGL-enabled browser. Real Chinese keyboard composition and mobile virtual keyboard behavior require device testing.

Taste Skill’s source lint was run. Its direct Chrome inspector cannot be used under this environment’s browser-control policy; supported CUA screenshots and read-only DOM measurements were used instead. No inspector pass is claimed.

## Critique

ROUND 1
Seen in one second: an open page, or an old mechanical typewriter with parchment.
Idea (one sentence): the writer’s own words stay in place while the writing instrument changes.
Live thing: typing, switching rooms, key feedback and the returning paper.
Layout words by section: shell=quiet perimeter / work=single readable column / atelier=paper over the machine.
Scores: design 7.5 · usability 7.5 · creativity 7.5 · content 8.0 → overall 7.6
Caps applied: application-screen conventions; physical-object materials are brief-required exceptions.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Desktop atelier: paper extended behind the machine and hid the caret. Its height is now projected from the actual platen position.
2. Desktop software renderer: rendering the complete scene on every key blocked input. It now renders at rest/resize and animates vector keys independently.
3. Phone atelier: the deliberately wide model created horizontal overflow. The writing-room boundary now clips the oversized model; the paper keeps its own scrolling area.

ROUND 2
Seen in one second: a writing environment with a tactile alternative, not a marketing page.
Idea (one sentence): changing the instrument changes the feeling, while keeping the writing intact.
Live thing: the current document moves between rooms without a reset.
Layout words by section: shell=light utility controls / work=writing-first / atelier=projected paper and mechanical object.
Scores: design 7.8 · usability 8.0 · creativity 7.5 · content 8.0 → overall 7.8
Caps applied: GPU rendering remains unverified in this environment; no award-level quality claim.
Remaining limitation: the SVG fallback has flatter lighting and simpler mechanical motion than WebGL, and small-screen keyboard behavior needs a physical-device check.
