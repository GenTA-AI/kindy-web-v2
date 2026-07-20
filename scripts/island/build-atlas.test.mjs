import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

import {
  assertSafeZipEntries,
  buildAtlas,
  classifyPng,
  inspectSource,
  TILE_SIZE,
} from "./build-atlas.mjs";

const execFileAsync = promisify(execFile);
const BUILD_SCRIPT = fileURLToPath(new URL("./build-atlas.mjs", import.meta.url));

async function withTempDirectory(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "kindy-atlas-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("classifies common pack sheet names", () => {
  assert.equal(classifyPng("Tiles/Grass Terrain.png"), "terrain");
  assert.equal(classifyPng("Environment/Water_Waves.png"), "water");
  assert.equal(classifyPng("Sprites/Hero Idle.png"), "character");
  assert.equal(classifyPng("Objects/Tree Props.png"), "props");
  assert.equal(classifyPng("Preview.png"), null);
});

test("rejects ZIP path traversal", () => {
  assert.doesNotThrow(() => assertSafeZipEntries(["Pack/Tiles/grass.png"]));
  assert.throws(() => assertSafeZipEntries(["../outside.png"]), /Unsafe path/);
  assert.throws(() => assertSafeZipEntries(["C:\\outside.png"]), /Unsafe path/);
});

test("rejects sheets that do not align to the 16px grid", async () => {
  await withTempDirectory(async (directory) => {
    const file = path.join(directory, "bad.png");
    await sharp({
      create: { background: "#112233", channels: 4, height: TILE_SIZE, width: 17 },
    })
      .png()
      .toFile(file);
    await assert.rejects(
      inspectSource({ absolutePath: file, atlas: "terrain", file: "bad.png", id: "bad" }),
      /17x16.*16px frame size/,
    );
  });
});

test("cuts frames without scaling and compiles animation metadata", async () => {
  await withTempDirectory(async (directory) => {
    const file = path.join(directory, "water.png");
    await sharp({
      create: {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        channels: 4,
        height: TILE_SIZE,
        width: TILE_SIZE * 2,
      },
    })
      .composite([
        {
          input: {
            create: {
              background: "#123456",
              channels: 4,
              height: TILE_SIZE,
              width: TILE_SIZE,
            },
          },
          left: 0,
          top: 0,
        },
        {
          input: {
            create: {
              background: "#abcdef",
              channels: 4,
              height: TILE_SIZE,
              width: TILE_SIZE,
            },
          },
          left: TILE_SIZE,
          top: 0,
        },
      ])
      .png()
      .toFile(file);

    const source = await inspectSource({
      absolutePath: file,
      atlas: "water",
      file: "water.png",
      id: "water",
    });
    const result = await buildAtlas("water", [source], [
      {
        atlas: "water",
        frameCount: 2,
        frameDurationMs: 160,
        id: "water-idle",
        row: 0,
        source: "water",
        startColumn: 0,
      },
    ]);
    const metadata = await sharp(result.png).metadata();
    assert.equal(metadata.width, TILE_SIZE * 2);
    assert.equal(metadata.height, TILE_SIZE);
    assert.equal(result.tileCount, 2);
    const json = JSON.parse(result.json);
    assert.deepEqual(json.animations["water-idle"], {
      frameDurationMs: 160,
      frames: ["water__r000_c000", "water__r000_c001"],
      repeat: -1,
    });
    assert.equal(json.meta.pixelArt, true);
    assert.equal(json.meta.tileSize, TILE_SIZE);
  });
});

test("selects 64px premium avatar frames while preserving source coordinates", async () => {
  await withTempDirectory(async (directory) => {
    const file = path.join(directory, "avatar.png");
    await sharp({
      create: {
        background: "#345678",
        channels: 4,
        height: 128,
        width: 128,
      },
    })
      .png()
      .toFile(file);

    const source = await inspectSource({
      absolutePath: file,
      atlas: "avatar-parts",
      file: "avatar.png",
      frameSize: 64,
      id: "avatar",
      regions: [{ frameCount: 1, row: 1, startColumn: 1 }],
    });
    const result = await buildAtlas("avatar-parts", [source], []);
    const json = JSON.parse(result.json);
    assert.deepEqual(Object.keys(json.frames), ["avatar__r001_c001"]);
    assert.equal(json.meta.frameSize, 64);
    assert.deepEqual(json.meta.size, { h: 64, w: 64 });
  });
});

test("CLI builds all six runtime atlas pairs and verifies them with --check", async () => {
  await withTempDirectory(async (directory) => {
    const sourceFile = path.join(directory, "Terrain.png");
    const output = path.join(directory, "output");
    await sharp({
      create: {
        background: "#234567",
        channels: 4,
        height: TILE_SIZE,
        width: TILE_SIZE,
      },
    })
      .png()
      .toFile(sourceFile);
    await writeFile(
      path.join(directory, "atlas.config.json"),
      `${JSON.stringify(
        {
          animations: [],
          pack: {
            licenseConditions: "Use in this project; do not redistribute source art.",
            name: "Fixture Pack",
            purchaseUrl: "https://example.com/fixture-pack",
            purchasedAt: "2026-07-20",
          },
          schemaVersion: 1,
          sources: [{ atlas: "terrain", file: "Terrain.png", id: "terrain" }],
        },
        null,
        2,
      )}\n`,
    );

    const built = await execFileAsync(process.execPath, [
      BUILD_SCRIPT,
      "--input",
      directory,
      "--output",
      output,
    ]);
    assert.match(built.stdout, /Atlas build complete/);
    for (const atlas of ["terrain", "water", "props", "character", "ui", "avatar-parts"]) {
      const json = JSON.parse(await readFile(path.join(output, `${atlas}.json`), "utf8"));
      const png = await sharp(path.join(output, `${atlas}.png`)).metadata();
      assert.equal(json.meta.tileSize, TILE_SIZE);
      assert.equal(png.width % TILE_SIZE, 0);
      assert.equal(png.height % TILE_SIZE, 0);
    }
    assert.match(await readFile(path.join(output, "LICENSE.md"), "utf8"), /Fixture Pack/);

    const checked = await execFileAsync(process.execPath, [
      BUILD_SCRIPT,
      "--input",
      directory,
      "--output",
      output,
      "--check",
    ]);
    assert.match(checked.stdout, /Atlas check passed/);
  });
});
