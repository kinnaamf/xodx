export async function decodeMeshResponse(response) {
  if (!response.ok) throw new Error(`Mesh download failed: HTTP ${response.status}`);
  let packed = await response.arrayBuffer();
  const bytes = new Uint8Array(packed);
  // Fetch already decodes Content-Encoding; only decompress a gzip file body.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    packed = await new Response(
      new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer();
  }
  if (packed.byteLength < 8) throw new Error('Mesh header is missing');
  const view = new DataView(packed);
  const vertexCount = view.getUint32(0, true);
  const indexCount = view.getUint32(4, true);
  if (!vertexCount || !indexCount || indexCount % 3 ||
      packed.byteLength !== 8 + vertexCount * 12 + indexCount * 4) {
    throw new Error('Invalid mesh data');
  }
  return packed;
}
