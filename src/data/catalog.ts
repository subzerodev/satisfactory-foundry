import type { Catalog } from "./types.ts";
import { parseDocsJson } from "./docs-loader.ts";

/** Parse raw Docs.json text into a Catalog (JSON.parse + parseDocsJson). */
export function parseCatalogFromText(text: string): Catalog {
  return parseDocsJson(JSON.parse(text));
}
