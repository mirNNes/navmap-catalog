const fs = require("node:fs");

const catalog = JSON.parse(fs.readFileSync("maps.merged.json", "utf8"));

const ids = new Set();
let available = 0;
let comingSoon = 0;
let errors = 0;

for (const map of catalog.maps) {
  if (!map.id || ids.has(map.id)) {
    console.error("Missing or duplicate ID:", map.id);
    errors++;
  }

  ids.add(map.id);

  if (map.status === "coming_soon") {
    comingSoon++;
    continue;
  }

  if (map.status !== "available") {
    console.error("Invalid status:", map.id);
    errors++;
    continue;
  }

  available++;

  if (!/^[a-f0-9]{32}$/i.test(map.md5 || "")) {
    console.error("Invalid MD5:", map.id);
    errors++;
  }

  if (!/^https:\/\/www\.userbeam\.de\/osm\/maps\//.test(map.url || "")) {
    console.error("Invalid URL:", map.id);
    errors++;
  }

  if (!/^[a-zA-Z0-9_-]+\.img$/.test(map.filename || "")) {
    console.error("Invalid filename:", map.id);
    errors++;
  }
}

console.log("Available:", available);
console.log("Coming soon:", comingSoon);
console.log("Errors:", errors);

if (errors > 0 || available === 0) {
  console.error("Catalog validation FAILED");
  process.exitCode = 1;
} else {
  console.log("Catalog validation PASSED");
}
