const fs = require("node:fs/promises");
const path = require("node:path");

const BASE_URL = "https://www.userbeam.de/osm/maps";

const REGIONS = {
  europe: "Europe",
  asia: "Asia",
  africa: "Africa",
  "north-america": "North America",
  "central-america": "Central America",
  "south-america": "South America",
  "australia-oceania": "Australia & Oceania",
};

const ACTIVE_REGIONS = [
  "europe",
  "asia",
  "africa",
  "north-america",
  "central-america",
  "south-america",
  "australia-oceania",
];

async function fetchPage(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchMapInfo(region, country) {
  const pageUrl = `${BASE_URL}/${region}/${country}/`;
  const html = await fetchPage(pageUrl);

  const filename = html.match(/href="([a-zA-Z0-9_-]+_gmapsupp\.img)"/i)?.[1];

  const md5 = html.match(/md5sum:\s*([a-f0-9]{32})/i)?.[1];

  const size = html.match(/Size:\s*<b>([^<]+)<\/b>/i)?.[1];

  const build = html.match(/Build:\s*<b>([^<]+)<\/b>/i)?.[1];

  if (!filename || !md5) {
    throw new Error("MAP_UNAVAILABLE");
  }

  return {
    filename,
    url: new URL(filename, pageUrl).href,
    md5: md5.toLowerCase(),
    size: size?.trim() || null,
    build: build?.trim() || null,
  };
}

async function discoverCountries(region) {
  const html = await fetchPage(`${BASE_URL}/${region}/`);

  const countries = [...html.matchAll(/href="([a-zA-Z0-9_-]+)\/"/g)].map(
    (match) => match[1],
  );

  return [...new Set(countries)];
}

function formatCountry(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    const maps = [];

    const limit = process.env.MAP_LIMIT ? Number(process.env.MAP_LIMIT) : null;

    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      throw new Error("MAP_LIMIT must be a positive integer.");
    }

    for (const region of ACTIVE_REGIONS) {
      if (!REGIONS[region]) {
        throw new Error(`Unknown region: ${region}`);
      }

      console.log(`\nScanning ${REGIONS[region]}...`);

      const countries = await discoverCountries(region);
      const selected = limit ? countries.slice(0, limit) : countries;

      let successful = 0;

      for (const slug of selected) {
        try {
          const info = await fetchMapInfo(region, slug);

          maps.push({
            id: region === "europe" ? slug : `${region}-${slug}`,
            country: formatCountry(slug),
            region: REGIONS[region],
            ...info,
            status: "available",
          });

          successful++;
          console.log(`OK: ${region}/${slug}`);
        } catch (error) {
          if (error.message === "MAP_UNAVAILABLE") {
            console.log(`SKIPPED: ${region}/${slug} - no valid map`);
            successful++;
          } else {
            console.error(`FAILED: ${region}/${slug} - ${error.message}`);
          }
        }

        await sleep(1500);
      }

      if (successful !== selected.length) {
        throw new Error(
          `Incomplete ${region} catalog: ` +
            `${successful}/${selected.length}. File not saved.`,
        );
      }

      console.log(`${REGIONS[region]} completed: ${successful} maps`);
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

    console.log(`\nTotal maps: ${maps.length}`);
    console.log(`Catalog saved to: ${outputPath}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exitCode = 1;
  }
}

main();
