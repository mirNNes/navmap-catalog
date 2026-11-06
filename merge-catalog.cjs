const fs = require("node:fs");

const current = require("./maps.json");
const generated = require("./maps.generated.json");

const europeanMaps = generated.maps.map((map) => ({
  ...map,
  id: map.id === "bosnia-herzegovina" ? "bosnia" : map.id,
  country:
    map.id === "bosnia-herzegovina" ? "Bosnia and Herzegovina" : map.country,
}));

const otherMaps = current.maps.filter((map) => map.region !== "Europe");

const previousEuropeanIds = current.maps
  .filter((map) => map.region === "Europe" && map.status === "available")
  .map((map) => map.id);

const newEuropeanIds = new Set(europeanMaps.map((map) => map.id));

const missingCountries = previousEuropeanIds.filter(
  (id) => !newEuropeanIds.has(id),
);

if (missingCountries.length > 0) {
  throw new Error(
    `Missing countries: ${missingCountries.join(", ")}. Catalog not saved.`,
  );
}

const merged = {
  version: 1,
  maps: [...europeanMaps, ...otherMaps],
};

fs.writeFileSync("maps.merged.json", JSON.stringify(merged, null, 2) + "\n");

console.log(`European maps: ${europeanMaps.length}`);
console.log(`Other maps: ${otherMaps.length}`);
console.log(`Total maps: ${merged.maps.length}`);
console.log("Saved to maps.merged.json");
