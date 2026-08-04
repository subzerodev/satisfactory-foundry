/**
 * Building footprints, keyed by the catalog's `machineId` (the Docs.json-derived
 * id `CatalogRecipe.machineId` carries). Values are `{width, length}` in integer
 * DECIMETERS (dm) — every wiki dimension is a multiple of 0.1 m, so decimeters
 * capture the true size exactly with plain integers (Axis 2). Fractions never
 * enter geometry; footprints are pure integers.
 *
 * PROVENANCE — official wiki (satisfactory.wiki.gg), infobox "Dimensions" field
 * (Width × Length; Height is irrelevant to a top-down layout). Fetched/verified
 * 2026-08-04. Producer set enumerated from the BUNDLED catalog
 * (public/bundled-docs/en-US.json): the 11 machineIds referenced by recipes.
 *
 *   Smelter (smelter_mk1)            5   × 10  m → 50  × 100  dm
 *     https://satisfactory.wiki.gg/wiki/Smelter
 *   Constructor (constructor_mk1)    7.9 × 9.9 m → 79  × 99   dm
 *     https://satisfactory.wiki.gg/wiki/Constructor
 *   Assembler (assembler_mk1)        9   × 16  m → 90  × 160  dm
 *     https://satisfactory.wiki.gg/wiki/Assembler
 *   Foundry (foundry_mk1)            10  × 9   m → 100 × 90   dm
 *     https://satisfactory.wiki.gg/wiki/Foundry
 *   Refinery (oil_refinery)          10  × 22  m → 100 × 220  dm
 *     https://satisfactory.wiki.gg/wiki/Refinery
 *   Manufacturer (manufacturer_mk1)  18  × 20  m → 180 × 200  dm
 *     https://satisfactory.wiki.gg/wiki/Manufacturer
 *   Packager (packager)              8   × 8   m → 80  × 80   dm
 *     https://satisfactory.wiki.gg/wiki/Packager
 *   Blender (blender)                18  × 16  m → 180 × 160  dm
 *     https://satisfactory.wiki.gg/wiki/Blender
 *   Particle Accelerator (hadron_collider) 24 × 38 m → 240 × 380 dm
 *     https://satisfactory.wiki.gg/wiki/Particle_Accelerator
 *   Quantum Encoder (quantum_encoder) 22 × 50 m → 220 × 500  dm
 *     https://satisfactory.wiki.gg/wiki/Quantum_Encoder
 *   Converter (converter)            16  × 16  m → 160 × 160  dm
 *     https://satisfactory.wiki.gg/wiki/Converter
 *
 * Junctions (belts have NO gameplay footprint — these are the placed devices):
 *   Conveyor Splitter                4   × 4   m → 40  × 40   dm
 *     https://satisfactory.wiki.gg/wiki/Conveyor_Splitter
 *   Conveyor Merger                  4   × 4   m → 40  × 40   dm
 *     https://satisfactory.wiki.gg/wiki/Conveyor_Merger
 *
 * Every producer above was grounded from its wiki infobox this session; no
 * DEFAULT_FOOTPRINT substitution was needed for the bundled catalog. The default
 * exists for catalog drift (an id the table does not carry) — the layout draws
 * an honest 100×100 approximation and emits an `unknown-footprint` finding
 * rather than refusing to draw (Axis 3).
 */

/** A top-down building footprint in integer decimeters. */
export interface Footprint {
  width: number;
  length: number;
}

/**
 * machineId → footprint, for every producer the bundled catalog references.
 * The runtime never reads provenance; citations live in the file header above.
 */
export const FOOTPRINTS: Record<string, Footprint> = {
  smelter_mk1: { width: 50, length: 100 },
  constructor_mk1: { width: 79, length: 99 },
  assembler_mk1: { width: 90, length: 160 },
  foundry_mk1: { width: 100, length: 90 },
  oil_refinery: { width: 100, length: 220 },
  manufacturer_mk1: { width: 180, length: 200 },
  packager: { width: 80, length: 80 },
  blender: { width: 180, length: 160 },
  hadron_collider: { width: 240, length: 380 },
  quantum_encoder: { width: 220, length: 500 },
  converter: { width: 160, length: 160 },
};

/** Conveyor Splitter footprint (feed-lane junction), 4×4 m. */
export const SPLITTER_FOOTPRINT: Footprint = { width: 40, length: 40 };

/** Conveyor Merger footprint (output-lane junction), 4×4 m. */
export const MERGER_FOOTPRINT: Footprint = { width: 40, length: 40 };

/**
 * Fallback footprint for a machineId the table does not carry (catalog drift).
 * The layout applies this and emits an `unknown-footprint` finding — never an
 * exception, mirroring the solver's findings-not-throws posture.
 */
export const DEFAULT_FOOTPRINT: Footprint = { width: 100, length: 100 };
