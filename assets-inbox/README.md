# Purchased pixel pack inbox

This directory is the private input boundary for the island atlas pipeline. Do
not commit the purchased ZIP, extracted source art, proof of purchase, or other
vendor-only files.

## Add a pack

1. Put exactly one purchased `.zip` file directly in `assets-inbox/`.
2. Add `assets-inbox/atlas.config.json` using the schema below. Paths in
   `sources` are relative to the root of the extracted ZIP.
3. Run `node scripts/island/build-atlas.mjs`.
4. Run `node scripts/island/build-atlas.mjs --check` and the repository
   validation commands.

The script inspects every selected PNG with `sharp`. Width and height must both
be exact multiples of 16 pixels. It never rescales artwork or introduces a new
palette; it only cuts 16×16 cells and packs them onto transparent 16px-aligned
atlases. ZIP entries containing absolute paths or `..` traversal are rejected.

When `sources` is omitted, PNGs are classified from common path/file words into
`terrain`, `water`, `props`, and `character`. Any unclassified PNG makes the
build fail so previews or unusually named sheets are never silently shipped.
Use an explicit `sources` list to select pack sheets and intentionally ignore
preview images.

## Configuration

```json
{
  "schemaVersion": 1,
  "pack": {
    "name": "Exact vendor pack name",
    "purchaseUrl": "https://vendor.example/pack-page",
    "licenseConditions": "Project use allowed; redistribution of source files prohibited.",
    "purchasedAt": "2026-07-20"
  },
  "sources": [
    {
      "id": "terrain-main",
      "file": "Pack/Tiles/Terrain.png",
      "atlas": "terrain"
    },
    {
      "id": "water-main",
      "file": "Pack/Tiles/Water.png",
      "atlas": "water"
    },
    {
      "id": "props-main",
      "file": "Pack/Objects/Props.png",
      "atlas": "props"
    },
    {
      "id": "hero-main",
      "file": "Pack/Characters/Hero.png",
      "atlas": "character"
    }
  ],
  "animations": [
    {
      "id": "water-idle",
      "atlas": "water",
      "source": "water-main",
      "row": 0,
      "startColumn": 0,
      "frameCount": 4,
      "frameDurationMs": 160
    }
  ]
}
```

Each animation is a horizontal run of frames in one source row. The generated
atlas JSON records the ordered frame names, per-frame duration, and infinite
repeat (`-1`). Add separate entries for water, swaying grass, or character
cycles. An animation may only reference a source assigned to the same atlas.

The build writes these committed runtime artifacts:

- `public/island/tiles/terrain.png` and `terrain.json`
- `public/island/tiles/water.png` and `water.json`
- `public/island/tiles/props.png` and `props.json`
- `public/island/tiles/character.png` and `character.json`
- `public/island/tiles/LICENSE.md`, generated from `pack`

Use `--input path/to/pack.zip` to select a ZIP explicitly, or `--input` with an
already extracted directory while tuning mappings. Use `--config` and `--output`
only when testing alternate locations. With no pack present, build and check
both exit successfully and print setup guidance.

Run the focused unit tests without a commercial pack:

```bash
node --test scripts/island/build-atlas.test.mjs
```

