const fs = require("node:fs/promises");
const path = require("node:path");

const BASE_URL = "https://www.userbeam.de/osm/maps";

// Get information about one map
async function fetchMapInfo(region, country) {
  const pageUrl = `${BASE_URL}/${region}/${country}/`;

  const response = await fetch(pageUrl, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  const filename = html.match(/href="([a-zA-Z0-9_-]+_gmapsupp\.img)"/i)?.[1];

  const md5 = html.match(/md5sum:\s*([a-f0-9]{32})/i)?.[1];

  const size = html.match(/Size:\s*<b>([^<]+)<\/b>/i)?.[1];

  const build = html.match(/Build:\s*<b>([^<]+)</i)?.[1];

  if (!filename || !md5) {
    throw new Error("Map information not found");
  }

  return {
    filename,
    url: new URL(filename, pageUrl).href,
    md5,
    size: size?.trim() || null,
    build: build?.trim() || null,
  };
}

// Discover countries in a region
async function discoverCountries(region) {
  const url = `${BASE_URL}/${region}/`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  const countries = [...html.matchAll(/href="([a-zA-Z0-9_-]+)\/"/g)].map(
    (match) => match[1],
  );

  return [...new Set(countries)];
}

// Pause between requests
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main generator
async function main() {
  try {
    const countries = await discoverCountries("europe");

    const limit = process.env.MAP_LIMIT
      ? Number(process.env.MAP_LIMIT)
      : countries.length;

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("MAP_LIMIT must be a positive integer.");
    }

    const testCountries = countries.slice(0, limit);
    const maps = [];

    for (const slug of testCountries) {
      try {
        const info = await fetchMapInfo("europe", slug);

        maps.push({
          id: slug,
          country: slug
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          region: "Europe",
          ...info,
          status: "available",
        });

        console.log(`OK: ${slug}`);
      } catch (error) {
        console.error(`FAILED: ${slug} - ${error.message}`);
      }

      await sleep(1500);
    }

    // Prevent saving an incomplete catalog
    if (maps.length !== testCountries.length) {
      throw new Error(
        `Incomplete catalog: ${maps.length}/${testCountries.length} maps. File not saved.`,
      );
    }

    const catalog = {
      version: 1,
      maps,
    };

    const outputPath = path.join(__dirname, "..", "maps.generated.json");

    await fs.writeFile(
      outputPath,
      JSON.stringify(catalog, null, 2) + "\n",
      "utf8",
    );

    console.log(`Catalog saved to: ${outputPath}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exitCode = 1;
  }
}

main();
