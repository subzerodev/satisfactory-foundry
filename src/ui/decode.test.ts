import { describe, it, expect } from "vitest";
import { decodeBytes, fileFromDrop, fileToDocsText } from "./decode.ts";

// A small JSON payload with a non-ASCII glyph, so a wrong TextDecoder would
// mangle the output and fail the identity assertion below.
const JSON_TEXT = '{"name":"Iron Ingot ×2","rate":37.5}';

function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = code >> 8;
  }
  return out;
}

function utf16be(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out[i * 2] = code >> 8;
    out[i * 2 + 1] = code & 0xff;
  }
  return out;
}

function withPrefix(prefix: number[], body: Uint8Array): Uint8Array {
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}

describe("decodeBytes", () => {
  it("decodes UTF-16 LE with BOM", () => {
    const buf = withPrefix([0xff, 0xfe], utf16le(JSON_TEXT));
    expect(decodeBytes(buf)).toBe(JSON_TEXT);
  });

  it("decodes UTF-16 BE with BOM", () => {
    const buf = withPrefix([0xfe, 0xff], utf16be(JSON_TEXT));
    expect(decodeBytes(buf)).toBe(JSON_TEXT);
  });

  it("decodes UTF-8 with BOM", () => {
    const body = new TextEncoder().encode(JSON_TEXT);
    const buf = withPrefix([0xef, 0xbb, 0xbf], body);
    expect(decodeBytes(buf)).toBe(JSON_TEXT);
  });

  it("decodes plain UTF-8 (no BOM)", () => {
    const buf = new TextEncoder().encode(JSON_TEXT);
    expect(decodeBytes(buf)).toBe(JSON_TEXT);
  });

  it("all four encodings of the same string decode identically", () => {
    const le = decodeBytes(withPrefix([0xff, 0xfe], utf16le(JSON_TEXT)));
    const be = decodeBytes(withPrefix([0xfe, 0xff], utf16be(JSON_TEXT)));
    const u8bom = decodeBytes(
      withPrefix([0xef, 0xbb, 0xbf], new TextEncoder().encode(JSON_TEXT)),
    );
    const u8 = decodeBytes(new TextEncoder().encode(JSON_TEXT));
    expect(le).toBe(be);
    expect(be).toBe(u8bom);
    expect(u8bom).toBe(u8);
  });
});

describe("fileFromDrop", () => {
  const fileA = new File(["a"], "a.json");
  const fileB = new File(["b"], "b.json");

  it("returns the first file when the drop carries files", () => {
    // Stub the minimal DataTransfer shape fileFromDrop reads (array-like files).
    expect(fileFromDrop({ files: [fileA, fileB] })).toBe(fileA);
  });

  it("returns null for a non-file drag (empty files)", () => {
    expect(fileFromDrop({ files: [] })).toBeNull();
  });

  it("returns null when files is null or absent", () => {
    expect(fileFromDrop({ files: null })).toBeNull();
    expect(fileFromDrop({})).toBeNull();
  });
});

describe("fileToDocsText", () => {
  it("decodes a UTF-16LE-with-BOM File through the BOM-sniffing core", async () => {
    // The real Docs.json encoding: a wrong (UTF-8) read would garble it, so this
    // pins that fileToDocsText routes arrayBuffer bytes → decodeBytes, not text().
    const buf = withPrefix([0xff, 0xfe], utf16le(JSON_TEXT));
    const file = new File([buf.buffer as ArrayBuffer], "Docs.json");
    expect(await fileToDocsText(file)).toBe(JSON_TEXT);
  });
});
