const fs = require("node:fs");

const current = require("./maps.json");
const generated = require("./maps.generated.json");

function validateCatalog(catalog, name) {
  if (!catalog || !Array.isArray(catalog.maps)) {
    throw new Error(`${name}: invalid catalog`);
  }

  const ids = new Set();

  for (const map of catalog.maps) {
    if (!map.id || !map.country || !map.region || !map.status) {
      throw new Error(`${name}: incomplete map entry`);
    }

    if (ids.has(map.id)) {
      throw new Error(`${name}: duplicate ID ${map.id}`);
    }

    ids.add(map.id);
  }
}

validateCatalog(current, "Current catalog");
validateCatalog(generated, "Generated catalog");

const updated = generated.maps.map((map) => ({
  ...map,
  id: map.id === "bosnia-herzegovina" ? "bosnia" : map.id,
  country:
    map.id === "bosnia-herzegovina" ? "Bosnia and Herzegovina" : map.country,
}));

validateCatalog({ maps: updated }, "Normalized catalog");

const generatedIds = new Set(updated.map((map) => map.id));

const missingMaps = current.maps.filter(
  (map) =>
    map.region === "Europe" &&
    map.status === "available" &&
    !generatedIds.has(map.id),
);

if (missingMaps.length > 0) {
  throw new Error(
    `Missing European maps: ${missingMaps.map((m) => m.id).join(", ")}`,
  );
}

const mergedById = new Map(current.maps.map((map) => [map.id, map]));

for (const map of updated) {
  mergedById.set(map.id, map);
}

const merged = {
  version: 1,
  maps: [...mergedById.values()],
};

validateCatalog(merged, "Merged catalog");

fs.writeFileSync(
  "maps.merged.json",
  JSON.stringify(merged, null, 2) + "\n",
  "utf8",
);

console.log(`Previous maps: ${current.maps.length}`);
console.log(`Updated maps: ${updated.length}`);
console.log(`Total maps: ${merged.maps.length}`);
console.log("Saved to maps.merged.json");
