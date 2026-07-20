#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

export const TILE_SIZE = 16;
export const ATLAS_NAMES = [
  "terrain",
  "water",
  "props",
  "character",
  "ui",
  "avatar-parts",
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_INPUT = path.join(REPO_ROOT, "assets-inbox");
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "public/island/tiles");
const CONFIG_NAME = "atlas.config.json";
const MAX_ATLAS_COLUMNS = 64;
const DOM_ATLAS_NAMES = ["props", "character", "avatar-parts"];

const CATEGORY_PATTERNS = {
  water: /(?:^|[\s_./-])(water|ocean|sea|river|waterfall|wave|foam)(?:$|[\s_./-])/i,
  character:
    /(?:^|[\s_./-])(character|player|hero|avatar|npc|sprite|walk|idle|run)(?:$|[\s_./-])/i,
  terrain:
    /(?:^|[\s_./-])(terrain|ground|grass|dirt|sand|soil|path|tilemap|tileset)(?:$|[\s_./-])/i,
  props:
    /(?:^|[\s_./-])(prop|object|decor|furniture|item|tree|plant|rock|building)(?:$|[\s_./-])/i,
};
const FORBIDDEN_CHILD_ASSET =
  /(?:^|\/)(?:Enemies|Goblins|Knights|Orcs|Military(?: War Camp)?)(?:\/|$)|(?:^|[\s_./-])(?:weapon|sword|bow)(?:$|[\s_./-])/i;

function usage() {
  return `Usage: node scripts/island/build-atlas.mjs [options]

Options:
  --input <path>   Pack ZIP or extracted pack directory (default: assets-inbox/)
  --config <path>  atlas.config.json override
  --output <path>  Atlas output directory (default: public/island/tiles/)
  --check          Validate inputs and require generated files to be up to date
  --help           Show this help
`;
}

function parseArgs(argv) {
  const options = {
    check: false,
    config: null,
    input: DEFAULT_INPUT,
    inputWasExplicit: false,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      options.check = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (["--input", "--config", "--output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a path.`);
      }
      const key = argument.slice(2);
      options[key] = path.resolve(value);
      if (argument === "--input") options.inputWasExplicit = true;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(root, predicate) {
  const found = [];
  if (!(await pathExists(root))) return found;

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (entry.name === "__MACOSX" || entry.name.startsWith("._")) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() && predicate(absolutePath)) {
        found.push(absolutePath);
      }
    }
  }

  await visit(root);
  return found;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `${command} exited with ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
          ),
        );
      }
    });
  });
}

export function assertSafeZipEntries(entries) {
  for (const rawEntry of entries) {
    const entry = rawEntry.replaceAll("\\", "/");
    if (!entry) continue;
    const segments = entry.split("/");
    if (
      entry.startsWith("/") ||
      /^[a-z]:\//i.test(entry) ||
      segments.some((segment) => segment === "..")
    ) {
      throw new Error(`Unsafe path in ZIP: ${rawEntry}`);
    }
  }
}

async function extractZips(zipPaths) {
  const extractionRoot = await mkdtemp(path.join(tmpdir(), "kindy-island-atlas-"));
  for (const zipPath of zipPaths) {
    const listing = await runCommand("unzip", ["-Z1", zipPath]);
    assertSafeZipEntries(listing.split(/\r?\n/));
    await runCommand("unzip", ["-qq", zipPath, "-d", extractionRoot]);
  }
  return extractionRoot;
}

async function resolvePackInput(options) {
  if (!(await pathExists(options.input))) {
    if (options.inputWasExplicit) throw new Error(`Input does not exist: ${options.input}`);
    return null;
  }
  const inputStats = await stat(options.input);
  if (inputStats.isFile()) {
    if (path.extname(options.input).toLowerCase() !== ".zip") {
      throw new Error(`Input file must be a ZIP: ${options.input}`);
    }
    const extractedRoot = await extractZips([options.input]);
    return {
      cleanupRoot: extractedRoot,
      configRoot: path.dirname(options.input),
      packRoot: extractedRoot,
    };
  }
  if (!inputStats.isDirectory()) {
    throw new Error(`Input is not a directory or ZIP: ${options.input}`);
  }

  const zipFiles = (await readdir(options.input, { withFileTypes: true }))
    .filter(
      (entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".zip",
    )
    .map((entry) => path.join(options.input, entry.name))
    .sort((left, right) => left.localeCompare(right, "en"));

  if (zipFiles.length > 0) {
    const extractedRoot = await extractZips(zipFiles);
    return {
      cleanupRoot: extractedRoot,
      configRoot: options.input,
      packRoot: extractedRoot,
    };
  }

  const directPngs = await collectFiles(
    options.input,
    (filePath) => path.extname(filePath).toLowerCase() === ".png",
  );
  if (directPngs.length > 0 || options.inputWasExplicit) {
    return { cleanupRoot: null, configRoot: options.input, packRoot: options.input };
  }
  return null;
}

async function findConfig(packInput, explicitConfig) {
  if (explicitConfig) {
    if (!(await pathExists(explicitConfig))) {
      throw new Error(`Config does not exist: ${explicitConfig}`);
    }
    return explicitConfig;
  }

  const sidecarConfig = path.join(packInput.configRoot, CONFIG_NAME);
  if (sidecarConfig && (await pathExists(sidecarConfig))) return sidecarConfig;

  const configs = await collectFiles(
    packInput.packRoot,
    (filePath) => path.basename(filePath) === CONFIG_NAME,
  );
  if (configs.length === 0) return null;
  if (configs.length > 1) {
    throw new Error(
      `Found multiple ${CONFIG_NAME} files. Select one with --config:\n${configs
        .map((filePath) => `- ${filePath}`)
        .join("\n")}`,
    );
  }
  return configs[0];
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Atlas config must be a JSON object.");
  }
  if (config.schemaVersion !== 1) {
    throw new Error("atlas.config.json schemaVersion must be 1.");
  }
  if (!config.pack || typeof config.pack !== "object") {
    throw new Error("atlas.config.json must contain pack metadata.");
  }

  const pack = {
    name: requireNonEmptyString(config.pack.name, "pack.name"),
    purchaseUrl: requireNonEmptyString(config.pack.purchaseUrl, "pack.purchaseUrl"),
    licenseConditions: requireNonEmptyString(
      config.pack.licenseConditions,
      "pack.licenseConditions",
    ),
    purchasedAt: requireNonEmptyString(config.pack.purchasedAt, "pack.purchasedAt"),
  };
  let purchaseUrl;
  try {
    purchaseUrl = new URL(pack.purchaseUrl);
  } catch {
    throw new Error("pack.purchaseUrl must be a valid URL.");
  }
  if (!["http:", "https:"].includes(purchaseUrl.protocol)) {
    throw new Error("pack.purchaseUrl must use http or https.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.purchasedAt)) {
    throw new Error("pack.purchasedAt must use YYYY-MM-DD format.");
  }
  const purchasedDate = new Date(`${pack.purchasedAt}T00:00:00Z`);
  if (
    Number.isNaN(purchasedDate.valueOf()) ||
    purchasedDate.toISOString().slice(0, 10) !== pack.purchasedAt
  ) {
    throw new Error("pack.purchasedAt is not a valid date.");
  }

  let sources = null;
  if (config.sources !== undefined) {
    if (!Array.isArray(config.sources) || config.sources.length === 0) {
      throw new Error("sources must be a non-empty array when provided.");
    }
    const seenIds = new Set();
    sources = config.sources.map((source, index) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error(`sources[${index}] must be an object.`);
      }
      const id = requireNonEmptyString(source.id, `sources[${index}].id`);
      const file = requireNonEmptyString(source.file, `sources[${index}].file`);
      const atlas = requireNonEmptyString(source.atlas, `sources[${index}].atlas`);
      if (!ATLAS_NAMES.includes(atlas)) {
        throw new Error(`sources[${index}].atlas must be one of ${ATLAS_NAMES.join(", ")}.`);
      }
      if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
        throw new Error(`sources[${index}].id may only contain letters, numbers, _ and -.`);
      }
      if (seenIds.has(id)) throw new Error(`Duplicate source id: ${id}`);
      seenIds.add(id);
      const frameSize = source.frameSize ?? TILE_SIZE;
      if (
        !Number.isInteger(frameSize) ||
        frameSize < TILE_SIZE ||
        frameSize % TILE_SIZE !== 0
      ) {
        throw new Error(
          `sources[${index}].frameSize must be a positive multiple of ${TILE_SIZE}.`,
        );
      }

      let regions = null;
      if (source.regions !== undefined) {
        if (!Array.isArray(source.regions) || source.regions.length === 0) {
          throw new Error(`sources[${index}].regions must be a non-empty array.`);
        }
        regions = source.regions.map((region, regionIndex) => {
          if (!region || typeof region !== "object" || Array.isArray(region)) {
            throw new Error(`sources[${index}].regions[${regionIndex}] must be an object.`);
          }
          for (const field of ["row", "startColumn", "frameCount"]) {
            if (!Number.isInteger(region[field]) || region[field] < 0) {
              throw new Error(
                `sources[${index}].regions[${regionIndex}].${field} must be a non-negative integer.`,
              );
            }
          }
          if (region.frameCount < 1) {
            throw new Error(
              `sources[${index}].regions[${regionIndex}].frameCount must be at least 1.`,
            );
          }
          return {
            frameCount: region.frameCount,
            row: region.row,
            startColumn: region.startColumn,
          };
        });
      }
      return { atlas, file, frameSize, id, regions };
    });
  }

  const animations = config.animations ?? [];
  if (!Array.isArray(animations)) throw new Error("animations must be an array.");
  const seenAnimationIds = new Set();
  const normalizedAnimations = animations.map((animation, index) => {
    if (!animation || typeof animation !== "object" || Array.isArray(animation)) {
      throw new Error(`animations[${index}] must be an object.`);
    }
    const id = requireNonEmptyString(animation.id, `animations[${index}].id`);
    const atlas = requireNonEmptyString(animation.atlas, `animations[${index}].atlas`);
    const source = requireNonEmptyString(animation.source, `animations[${index}].source`);
    if (!ATLAS_NAMES.includes(atlas)) {
      throw new Error(`animations[${index}].atlas must be one of ${ATLAS_NAMES.join(", ")}.`);
    }
    if (seenAnimationIds.has(`${atlas}:${id}`)) {
      throw new Error(`Duplicate animation id in ${atlas}: ${id}`);
    }
    seenAnimationIds.add(`${atlas}:${id}`);
    for (const field of ["row", "startColumn", "frameCount", "frameDurationMs"]) {
      if (!Number.isInteger(animation[field]) || animation[field] < 0) {
        throw new Error(`animations[${index}].${field} must be a non-negative integer.`);
      }
    }
    if (animation.frameCount < 1) {
      throw new Error(`animations[${index}].frameCount must be at least 1.`);
    }
    if (animation.frameDurationMs < 1) {
      throw new Error(`animations[${index}].frameDurationMs must be at least 1.`);
    }
    return {
      atlas,
      frameCount: animation.frameCount,
      frameDurationMs: animation.frameDurationMs,
      id,
      row: animation.row,
      source,
      startColumn: animation.startColumn,
    };
  });

  return { animations: normalizedAnimations, pack, sources };
}

export function classifyPng(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  for (const atlas of ["water", "character", "terrain", "props"]) {
    if (CATEGORY_PATTERNS[atlas].test(normalized)) return atlas;
  }
  return null;
}

function sourceIdFromPath(relativePath) {
  const withoutExtension = relativePath.slice(0, -path.extname(relativePath).length);
  const id = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return id || "sheet";
}

function resolveInside(root, relativePath, field) {
  if (path.isAbsolute(relativePath)) throw new Error(`${field} must be relative to the pack root.`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${field} escapes the pack root: ${relativePath}`);
  }
  return resolved;
}

async function resolveSources(packRoot, configuredSources) {
  if (configuredSources) {
    const resolved = [];
    for (const source of configuredSources) {
      const normalizedFile = source.file.replaceAll("\\", "/");
      if (FORBIDDEN_CHILD_ASSET.test(normalizedFile)) {
        throw new Error(`Forbidden child-facing combat asset selected: ${source.file}`);
      }
      const absolutePath = resolveInside(packRoot, source.file, `source ${source.id}.file`);
      if (!(await pathExists(absolutePath))) {
        throw new Error(`Source PNG does not exist: ${source.file}`);
      }
      if (path.extname(absolutePath).toLowerCase() !== ".png") {
        throw new Error(`Source must be a PNG: ${source.file}`);
      }
      resolved.push({ ...source, absolutePath });
    }
    return resolved;
  }

  const pngs = await collectFiles(
    packRoot,
    (filePath) => path.extname(filePath).toLowerCase() === ".png",
  );
  if (pngs.length === 0) throw new Error("The pack contains no PNG files.");
  const unclassified = [];
  const seenIds = new Map();
  const sources = [];
  for (const absolutePath of pngs) {
    const relativePath = path.relative(packRoot, absolutePath).split(path.sep).join("/");
    const atlas = classifyPng(relativePath);
    if (!atlas) {
      unclassified.push(relativePath);
      continue;
    }
    const idBase = sourceIdFromPath(relativePath);
    const occurrence = (seenIds.get(idBase) ?? 0) + 1;
    seenIds.set(idBase, occurrence);
    sources.push({
      absolutePath,
      atlas,
      file: relativePath,
      frameSize: TILE_SIZE,
      id: occurrence === 1 ? idBase : `${idBase}_${occurrence}`,
      regions: null,
    });
  }
  if (unclassified.length > 0) {
    throw new Error(
      `Could not classify these PNGs. Add an explicit sources list to ${CONFIG_NAME}:\n${unclassified
        .map((filePath) => `- ${filePath}`)
        .join("\n")}`,
    );
  }
  return sources;
}

export async function inspectSource(source) {
  const metadata = await sharp(source.absolutePath).metadata();
  if (metadata.format !== "png") throw new Error(`${source.file} is not a PNG.`);
  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${source.file}.`);
  }
  const frameSize = source.frameSize ?? TILE_SIZE;
  if (metadata.width % frameSize !== 0 || metadata.height % frameSize !== 0) {
    throw new Error(
      `${source.file} is ${metadata.width}x${metadata.height}; both dimensions must align to its ${frameSize}px frame size.`,
    );
  }
  const columns = metadata.width / frameSize;
  const rows = metadata.height / frameSize;
  const cells = [];
  const seenCells = new Set();
  const regions = source.regions ?? Array.from({ length: rows }, (_, row) => ({
    frameCount: columns,
    row,
    startColumn: 0,
  }));
  for (const region of regions) {
    if (region.row >= rows || region.startColumn + region.frameCount > columns) {
      throw new Error(
        `Selected region row ${region.row}, columns ${region.startColumn}..${region.startColumn + region.frameCount - 1} exceeds ${source.file} (${columns}x${rows} frames).`,
      );
    }
    for (let offset = 0; offset < region.frameCount; offset += 1) {
      const cell = { column: region.startColumn + offset, row: region.row };
      const key = `${cell.row},${cell.column}`;
      if (seenCells.has(key)) throw new Error(`Duplicate selected frame in ${source.file}: ${key}`);
      seenCells.add(key);
      cells.push(cell);
    }
  }
  return {
    ...source,
    cells,
    columns,
    frameSize,
    height: metadata.height,
    rows,
    width: metadata.width,
  };
}

function frameId(sourceId, row, column) {
  return `${sourceId}__r${String(row).padStart(3, "0")}_c${String(column).padStart(3, "0")}`;
}

function compileAnimations(atlas, animations, sources) {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const compiled = {};
  for (const animation of animations.filter((entry) => entry.atlas === atlas)) {
    const source = sourceMap.get(animation.source);
    if (!source) {
      throw new Error(`Animation ${atlas}/${animation.id} references unknown source ${animation.source}.`);
    }
    if (source.atlas !== atlas) {
      throw new Error(
        `Animation ${atlas}/${animation.id} references ${source.id}, which belongs to ${source.atlas}.`,
      );
    }
    if (
      animation.row >= source.rows ||
      animation.startColumn + animation.frameCount > source.columns
    ) {
      throw new Error(
        `Animation ${atlas}/${animation.id} exceeds ${source.file} (${source.columns}x${source.rows} tiles).`,
      );
    }
    const selectedFrames = new Set(source.cells.map(({ column, row }) => `${row},${column}`));
    for (let offset = 0; offset < animation.frameCount; offset += 1) {
      const key = `${animation.row},${animation.startColumn + offset}`;
      if (!selectedFrames.has(key)) {
        throw new Error(
          `Animation ${atlas}/${animation.id} references ${source.id} frame ${key}, which is not selected.`,
        );
      }
    }
    compiled[animation.id] = {
      frameDurationMs: animation.frameDurationMs,
      frames: Array.from({ length: animation.frameCount }, (_, offset) =>
        frameId(source.id, animation.row, animation.startColumn + offset),
      ),
      repeat: -1,
    };
  }
  return compiled;
}

export async function buildAtlas(atlas, allSources, animations) {
  const sources = allSources.filter((source) => source.atlas === atlas);
  const frameSizes = new Set(sources.map((source) => source.frameSize));
  if (frameSizes.size > 1) {
    throw new Error(`${atlas} sources must use one shared frameSize.`);
  }
  const frameSize = sources[0]?.frameSize ?? TILE_SIZE;
  const tiles = [];
  for (const source of sources) {
    for (const { column, row } of source.cells) {
      const buffer = await sharp(source.absolutePath)
        .extract({
          height: frameSize,
          left: column * frameSize,
          top: row * frameSize,
          width: frameSize,
        })
        .png()
        .toBuffer();
      tiles.push({ buffer, column, row, source });
    }
  }

  const tileCount = tiles.length;
  const columns = tileCount === 0 ? 1 : Math.min(MAX_ATLAS_COLUMNS, Math.ceil(Math.sqrt(tileCount)));
  const rows = tileCount === 0 ? 1 : Math.ceil(tileCount / columns);
  const width = columns * frameSize;
  const height = rows * frameSize;
  const composites = tiles.map((tile, index) => ({
    input: tile.buffer,
    left: (index % columns) * frameSize,
    top: Math.floor(index / columns) * frameSize,
  }));
  const png = await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height,
      width,
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const frames = {};
  tiles.forEach((tile, index) => {
    const x = (index % columns) * frameSize;
    const y = Math.floor(index / columns) * frameSize;
    frames[frameId(tile.source.id, tile.row, tile.column)] = {
      frame: { h: frameSize, w: frameSize, x, y },
      rotated: false,
      source: { column: tile.column, file: tile.source.file, row: tile.row },
      sourceSize: { h: frameSize, w: frameSize },
      spriteSourceSize: { h: frameSize, w: frameSize, x: 0, y: 0 },
      trimmed: false,
    };
  });

  const json = {
    animations: compileAnimations(atlas, animations, allSources),
    frames,
    meta: {
      app: "scripts/island/build-atlas.mjs",
      format: "RGBA8888",
      image: `${atlas}.png`,
      frameSize,
      gridSize: TILE_SIZE,
      pixelArt: true,
      scale: "1",
      size: { h: height, w: width },
      tileSize: TILE_SIZE,
    },
  };
  return { json: `${JSON.stringify(json, null, 2)}\n`, png, tileCount };
}

function escapeMarkdownCell(value) {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, "<br>");
}

function renderLicense(pack) {
  return `# Island Tile Pack License Record

| Field | Record |
| --- | --- |
| Pack name | ${escapeMarkdownCell(pack.name)} |
| Purchase source | ${escapeMarkdownCell(pack.purchaseUrl)} |
| License conditions | ${escapeMarkdownCell(pack.licenseConditions)} |
| Purchase date | ${escapeMarkdownCell(pack.purchasedAt)} |

The PNG and JSON files in this directory are derived from the purchased pack above.
They may be used and redistributed only as permitted by that pack's license. This
record is not a replacement for the original license text or proof of purchase.
`;
}

async function expectedOutputs(packRoot, config) {
  const resolvedSources = await resolveSources(packRoot, config.sources);
  const sources = [];
  for (const source of resolvedSources) sources.push(await inspectSource(source));

  const outputs = new Map();
  const summary = [];
  const runtimeAtlas = {};
  for (const atlas of ATLAS_NAMES) {
    const built = await buildAtlas(atlas, sources, config.animations);
    outputs.set(`${atlas}.png`, built.png);
    outputs.set(`${atlas}.json`, Buffer.from(built.json));
    if (DOM_ATLAS_NAMES.includes(atlas)) {
      const data = JSON.parse(built.json);
      runtimeAtlas[atlas] = {
        frames: Object.fromEntries(
          Object.entries(data.frames).map(([name, { frame }]) => [name, frame]),
        ),
        image: data.meta.image,
        size: data.meta.size,
      };
    }
    summary.push(`${atlas}: ${built.tileCount} tiles`);
  }
  outputs.set("runtime-atlas.json", Buffer.from(`${JSON.stringify(runtimeAtlas)}\n`));
  outputs.set("LICENSE.md", Buffer.from(renderLicense(config.pack)));
  return { outputs, summary, sources };
}

async function writeOutputs(outputRoot, outputs) {
  await mkdir(outputRoot, { recursive: true });
  for (const [fileName, contents] of outputs) {
    await writeFile(path.join(outputRoot, fileName), contents);
  }
}

async function checkOutputs(outputRoot, outputs) {
  const differences = [];
  for (const [fileName, expected] of outputs) {
    const outputPath = path.join(outputRoot, fileName);
    if (!(await pathExists(outputPath))) {
      differences.push(`${fileName} is missing`);
      continue;
    }
    const actual = await readFile(outputPath);
    if (!actual.equals(expected)) differences.push(`${fileName} is stale`);
  }
  if (differences.length > 0) {
    throw new Error(
      `Generated atlas outputs are not up to date:\n${differences
        .map((difference) => `- ${difference}`)
        .join("\n")}\nRun node scripts/island/build-atlas.mjs to rebuild them.`,
    );
  }
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const packInput = await resolvePackInput(options);
  if (!packInput) {
    process.stdout.write(
      "No pixel pack found in assets-inbox/. The atlas pipeline is ready; see assets-inbox/README.md.\n",
    );
    return;
  }

  try {
    const configPath = await findConfig(packInput, options.config);
    if (!configPath) {
      throw new Error(
        `A pack was found, but ${CONFIG_NAME} is missing. Add purchase/license metadata and optional source mappings; see assets-inbox/README.md.`,
      );
    }
    const rawConfig = JSON.parse(await readFile(configPath, "utf8"));
    const config = validateConfig(rawConfig);
    const built = await expectedOutputs(packInput.packRoot, config);

    if (options.check) {
      await checkOutputs(options.output, built.outputs);
      process.stdout.write(`Atlas check passed (${built.summary.join(", ")}).\n`);
    } else {
      await writeOutputs(options.output, built.outputs);
      process.stdout.write(`Atlas build complete (${built.summary.join(", ")}).\n`);
    }
  } finally {
    if (packInput.cleanupRoot) {
      await rm(packInput.cleanupRoot, { force: true, recursive: true });
    }
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Atlas build failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
