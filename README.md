# American-Superblock

MEMO Studio’s American Superblock: an interactive computational architecture platform with parametric 3D housing, BIM geometry, structural and MEP studies, architectural documentation, and IFC export.

**Live project:** https://memo-american-superblock.higgsfield.app

## Run the architectural model locally

The main model includes bundled browser dependencies. From this repository:

```sh
python3 -m http.server 8000 --directory app/public
```

Open http://localhost:8000/superblock.html. Serve it over HTTP rather than opening a file URL.

## Full website application

The application shell uses React, TanStack Start, Vite, and Bun workspaces.

```sh
cd app
bun install --frozen-lockfile
bun run dev
```

The original hosting-specific CI configuration is retained at `docs/higgsfield-template-ci.yml` as a reference. Its custom runner is not configured for this repository. This import does not establish automatic hosting synchronization or deployment.

## Source organization

- `app/public/superblock.html`: primary interactive architectural model.
- `app/public/`: model modules, documentation, local dependencies, and assets.
- `app/public/phase1/`: experimental geometry companion.
- `app/src/` and `app/packages/`: application shell and workspace packages.
- `app/tests/`: existing project tests.

## Saved baseline

Imported from saved project commit `d02006500e93ec6c20aceba05c097baf2b8d689a`, including the V-section rebuild fix and fixed circular core with four radial stair/lift groups.

The later interrupted requests to remove projecting decks, remove shadows, and enlarge landscape trees were not saved in this baseline.

This is a computational architectural research prototype. Structural, MEP, accessibility, and egress studies require professional validation; rendered geometry is not evidence of code compliance. No native NVIDIA BRep or IFC certification is asserted.

Third-party notices and licenses are retained. This import does not assign a new license to MEMO Studio's original code.
