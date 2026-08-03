/**
 * BOM-sniffing text decode, ported from the planner's `decodeFile`
 * (satisfactory-planner DocsUpload.svelte:14-26), split at the bytes seam so
 * the core is unit-testable in node. Satisfactory ships Docs as per-locale
 * files encoded UTF-16 LE with a BOM; naive UTF-8 decoding garbles them. The
 * `File.arrayBuffer()` shell lives in `UploadScreen`.
 */
export function decodeBytes(buf: Uint8Array): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buf.subarray(2));
  }
  if (
    buf.length >= 3 &&
    buf[0] === 0xef &&
    buf[1] === 0xbb &&
    buf[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(buf.subarray(3));
  }
  return new TextDecoder("utf-8").decode(buf);
}
