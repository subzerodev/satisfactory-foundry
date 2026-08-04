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

/**
 * Read a picked/dropped File to its decoded text through the BOM-sniffing core
 * (Stage 5 item 2). This is the single decode-and-delegate seam consolidating
 * the two formerly-inline copies (App re-upload, UploadScreen) plus the new drop
 * path — each call site supplies its OWN upload sink, so UploadScreen stays
 * store-free (onUpload prop) and App keeps its uploadDocsText. NEVER file.text():
 * that decodes UTF-8 unconditionally and garbles real UTF-16LE Docs.json.
 */
export async function fileToDocsText(file: File): Promise<string> {
  return decodeBytes(new Uint8Array(await file.arrayBuffer()));
}

/**
 * The first File from a drop's DataTransfer, or null when the drag carried no
 * file (Stage 5 item 2). Multiple files → the first, matching the single-file
 * `<input>` posture. Typed against the minimal shape it reads so it is
 * node-testable with a stub — the real DataTransfer.files is a FileList, which
 * is array-like and length-indexable, exactly what this reads.
 */
export function fileFromDrop(dt: {
  files?: ArrayLike<File> | null;
}): File | null {
  const files = dt.files;
  if (files === null || files === undefined || files.length === 0) {
    return null;
  }
  return files[0] ?? null;
}
