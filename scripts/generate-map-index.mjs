import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");

const mapsDirectory = path.join(projectDirectory, "public", "maps");
const outputFile = path.join(projectDirectory, "src", "maps-index.json");

const supportedExtensions = new Set([
  ".txt",
]);

function getMapName(filename) {
  return path.basename(filename, path.extname(filename));
}

function generateMapIndex() {
  if (!fs.existsSync(mapsDirectory)) {
    fs.mkdirSync(mapsDirectory, { recursive: true });
  }

  const files = fs
    .readdirSync(mapsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) =>
      supportedExtensions.has(path.extname(filename).toLowerCase())
    )
    .sort((a, b) => a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    }));

  const maps = files.map((filename) => ({
    name: getMapName(filename),
    title: getMapName(filename)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    image: `/maps/${encodeURIComponent(filename)}`,
    url: `/${encodeURIComponent(getMapName(filename))}`,
  }));

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  fs.writeFileSync(
    outputFile,
    JSON.stringify(maps, null, 2) + "\n",
    "utf8"
  );

  console.log(`Found ${maps.length} map image(s).`);

  for (const map of maps) {
    console.log(`  - ${map.title}: ${map.image}`);
  }

  console.log(`Map index written to ${path.relative(projectDirectory, outputFile)}.`);
}

generateMapIndex();