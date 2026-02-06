import type { OpenAPIV2 } from "openapi-types";

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { request } from "undici";

import { hashOpenApiDocument } from "~/server/headscale/api/hasher";

const HASH_FILE_LOCATION = "app/openapi-operation-hashes.json";
const CANONICAL_LOCATION = "app/openapi-canonical-families.json";

const SPEC_MAP = {
  // '0.25.0': '/v0.25.0/gen/openapiv2/headscale/v1/headscale.swagger.json',
  // '0.25.1': '/v0.25.1/gen/openapiv2/headscale/v1/headscale.swagger.json',
  "0.26.0": "/v0.26.0/gen/openapiv2/headscale/v1/headscale.swagger.json",
  "0.26.1": "/v0.26.1/gen/openapiv2/headscale/v1/headscale.swagger.json",
  "0.27.0": "/v0.27.0/gen/openapiv2/headscale/v1/headscale.swagger.json",
  "0.27.1": "/v0.27.1/gen/openapiv2/headscale/v1/headscale.swagger.json",
  "0.28.0": "/v0.28.0/gen/openapiv2/headscale/v1/headscale.swagger.json",
} as const;

async function hashOpenApiOperations(specUrl: string) {
  const url = `https://raw.githubusercontent.com/juanfont/headscale${specUrl}`;
  const res = await request(url);
  if (res.statusCode !== 200) {
    console.error("Failed to fetch OpenAPI spec:", res.statusCode);
    process.exit(1);
  }

  const body = (await res.body.json()) as OpenAPIV2.Document;
  return hashOpenApiDocument(body);
}

async function collectCanonicalizedFamilies(
  newHashes: readonly (readonly [string, Record<string, string>])[],
) {
  const canonicalizedFamilies: Record<string, string[]> = {};
  for (const [version, hashes] of newHashes) {
    const signature = JSON.stringify(hashes);
    let canonical: string | null = null;

    for (const existingCanonical of Object.keys(canonicalizedFamilies)) {
      const existingSignature = JSON.stringify(
        newHashes.find(([v]) => v === existingCanonical)![1],
      );

      if (existingSignature === signature) {
        canonical = existingCanonical;
        break;
      }
    }

    if (!canonical) {
      canonicalizedFamilies[version] = [version];
      continue;
    }

    canonicalizedFamilies[canonical].push(version);
    if (
      version.localeCompare(canonical, undefined, {
        numeric: true,
        sensitivity: "base",
      }) > 0
    ) {
      canonicalizedFamilies[version] = canonicalizedFamilies[canonical];
      delete canonicalizedFamilies[canonical];
    }
  }

  for (const [canonical, family] of Object.entries(canonicalizedFamilies)) {
    canonicalizedFamilies[canonical] = family.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
  }

  return canonicalizedFamilies;
}

async function writeHashes(hashes: Record<string, Record<string, string>>) {
  const path = resolve(cwd(), HASH_FILE_LOCATION);
  await writeFile(path, `${JSON.stringify(hashes, null, 2)}\n`, "utf-8");
}

async function writeCanonicalizedFamilies(families: Record<string, string[]>) {
  const path = resolve(cwd(), CANONICAL_LOCATION);
  await writeFile(path, `${JSON.stringify(families, null, 2)}\n`, "utf-8");
}

const newHashes = await Promise.all(
  Object.entries(SPEC_MAP).map(async ([version, specUrl]) => {
    const hashes = await hashOpenApiOperations(specUrl);
    return [version, hashes] as const;
  }),
);

const canonicalizedFamilies = await collectCanonicalizedFamilies(newHashes);

console.log("Writing new OpenAPI operation hashes to file");
await writeHashes(Object.fromEntries(newHashes));
await writeCanonicalizedFamilies(canonicalizedFamilies);
