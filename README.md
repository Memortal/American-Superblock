# American Superblock
### A city block you can take apart, question, and redesign.

**Four courtyard buildings. A shared residential valley. A section that opens into a V. Architecture, structure, and building systems in one browser-based design experiment.**

American Superblock by **MEMO Studio / Alireza Memarian** explores what happens when a housing proposal becomes an editable computational model. Change a parameter, cut a section, follow an egress route, inspect a unit, or generate drawings from the geometry.

**[Open the interactive model →](https://memortal.github.io/American-Superblock/)** · **[Fork your own version →](https://github.com/Memortal/American-Superblock/fork)** · [Remix guide](#remix-it-with-ai)

> GitHub Pages publishes the browser application from `main /docs`. If the link shows a 404, the repository owner must enable that source in Settings → Pages once.

## Start with a question

**What if a corridor became a valley?** Lower family housing faces a shared internal street; the open fourth level separates it from the upper housing.

**What if the section leaned outward?** Explore the applied V-section, inclined geometry, stepped inner edges, and a circular central core with four radial stair/lift groups.

**What if the model could explain itself?** Move from the urban block to a unit, its components, its routes, and its drawings.

## Inside the tool

| Explore | What you can work with |
| --- | --- |
| **Urban model** | A 660 × 660 ft site, four courtyard buildings, streets, landscape, stepped housing, offices, parking, and tunnels. |
| **Parametric architecture** | Building and level filters, V-section controls, massing/BIM/slab views, and section cuts. |
| **Detail and inspection** | Model LOD controls, unit focus, door assemblies, BIM types, and component schedules. |
| **Structure** | Columns, beams, slabs, grids, and a dedicated structural workspace. |
| **MEP** | System-specific views, routes, risers, equipment, and coordinated 3D studies alongside architecture and structure. |
| **Circulation** | Unit egress studies and a door/connection graph for investigating routes through the model. |
| **Drawing set** | Model-generated plans and sections, dimensions, levels, SVG downloads, and print/PDF output. |
| **Specifications** | A product/specification workspace linking model categories to reference requirements. |
| **Interior experiments** | The Couple Living Lab: room and furniture layouts, resident routines, and design comparison tools. |
| **Walkthrough** | Explore spatial relationships from inside the model, including keyboard navigation. |
| **Geometry and exports** | Browser IFC4 and geometry JSON export, geometry capture, element inspection, and parametric GLB previews. |

### Try this first

1. Start at **LOD 100** and orbit the whole block.
2. Open **V section · Applied** and explore the relationship between inclination and space.
3. Choose a building and cut through the model to reveal the valley and upper housing.
4. Open **Coordinated 3D**, **Structure**, or **MEP systems** to compare disciplines.
5. Open **Drawing set** to see the proposal as architectural documents.
6. Use **Focus unit**, **Unit egress**, or **Couple Living Lab** to move to the scale of daily life.

## Remix it with AI

**Fork the repository, connect the fork to your coding assistant, and give it one architectural problem to solve.** The editable source is here; you do not need the original hosting platform to run the browser model.

Try a different housing mix, a new courtyard landscape, a better circulation rule, a climate-specific section, or a clearer drawing set. Keep the geometry, the data, and the drawings connected as you experiment.

Paste this into your coding assistant:

```text
Work inside this American Superblock repository.

First inspect README.md, app/public/superblock.html, and the modules
related to my request. Explain the existing geometry and data flow.
Reuse the current model and UI; do not create a separate application.

My design experiment: [describe one change here]

Preserve the four-building site layout, stable element identities,
core connections, and existing features unless my request changes them.
Keep architecture, structure, MEP, schedules, and drawings coordinated;
flag unresolved conflicts instead of inventing validation results.

Implement the smallest useful change. Test the affected controls and
exports. Report what changed and what remains unverified.
Finally run python3 scripts/build_pages.py to refresh the GitHub Pages
version in docs, and commit the source and generated files together.
```

**Good first remixes:** redesign one unit typology; add a courtyard planting preset; compare two V-section settings; improve one drawing sheet; extend an element schedule.

## Run locally

No installation or API key is needed for the main browser model. From the repository root:

```sh
python3 -m http.server 8000 --directory app/public
```

Open **http://localhost:8000/superblock.html** in a modern browser with WebGL. The main browser dependencies are bundled.

For the separate React / TanStack / Vite application shell:

```sh
cd app
bun install --frozen-lockfile
bun run dev
```

## Publish your remix on GitHub Pages

The checked-in `docs/` directory is a deployable static copy of the model. To rebuild it for a fork named `My-Superblock`:

```sh
python3 scripts/build_pages.py --base /My-Superblock/
```

Commit the generated `docs/` files. In **Settings → Pages**, choose **Deploy from a branch**, **main**, and **/docs**, then save. After activation, commits updating that directory publish your changes. For this repository, the default build command already uses `/American-Superblock/`.

## Where to make changes

| File or directory | Role |
| --- | --- |
| `app/public/superblock.html` | Main model, scene, controls, and architectural generation. |
| `app/public/v-applied.js`, `v-section-workspace.js` | Applied V geometry and section controls. |
| `app/public/circular-core.js` | Circular central core and radial circulation groups. |
| `app/public/documentation.js` | Architectural drawing generation. |
| `app/public/*workspace.js` | Discipline-specific tools and UI. |
| `app/public/bim-registry.js` | BIM type and component registry. |
| `app/public/phase1/` | Experimental geometry companion and bundled artifacts. |
| `app/tests/` | Existing checks. |
| `scripts/build_pages.py` | Static Pages packaging and repository-path handling. |
| `app/src/`, `app/packages/` | Application shell and workspace packages. |

## Scope and credits

This is a working design research prototype, not a certified building design. Structural, MEP, accessibility, and egress studies need professional review. Some metrics still reference undeformed base plans.

GitHub Pages runs the browser model and serves bundled downloads. Live native BRep/IFC4x3 service jobs require a separate backend; Pages cannot run them. Browser IFC4 export is a separate feature.

The starting source is saved revision `d020065`, including the V-rebuild and circular-core updates. Subsequent unsaved tree, shadow, and projecting-deck requests are not part of that baseline. The original host-specific CI file is retained as a reference in `docs/higgsfield-template-ci.yml`.

**Design and computational development: MEMO Studio / Alireza Memarian.** Third-party notices remain with their respective components. Forking is a technical workflow; no additional license for original MEMO Studio code is granted by this README.
