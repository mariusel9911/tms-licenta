import fs from 'fs';

// Known magic byte signatures for allowed image types
const IMAGE_SIGNATURES: Buffer[] = [
  Buffer.from([0xff, 0xd8, 0xff]),                                 // JPEG
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
  Buffer.from([0x47, 0x49, 0x46, 0x38]),                           // GIF
];
const WEBP_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
const WEBP_MARKER = Buffer.from([0x57, 0x45, 0x42, 0x50]);

export async function isValidImageFile(filePath: string): Promise<boolean> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);
    for (const sig of IMAGE_SIGNATURES) {
      if (buf.subarray(0, sig.length).equals(sig)) return true;
    }
    // WebP: bytes 0–3 = RIFF, bytes 8–11 = WEBP
    if (buf.subarray(0, 4).equals(WEBP_RIFF) && buf.subarray(8, 12).equals(WEBP_MARKER)) return true;
    return false;
  } finally {
    await handle.close();
  }
}
