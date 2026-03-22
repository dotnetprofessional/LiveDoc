/**
 * Generates valid PNG images for screenshot attachment tests.
 * Uses only Node.js built-ins (zlib) — no external dependencies.
 */
import { deflateSync } from "zlib";

function crc32(buf: Buffer): number {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, c]);
}

/**
 * Generate a valid PNG that looks like a UI screenshot.
 * Blue header bar, white body, gray border — 200×100 pixels.
 * Returns base64-encoded PNG data.
 */
export function generateScreenshot(width = 200, height = 100): string {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 2;  // color type: RGB

    const rowSize = 1 + width * 3; // filter byte + RGB per pixel
    const raw = Buffer.alloc(rowSize * height);

    for (let y = 0; y < height; y++) {
        const offset = y * rowSize;
        raw[offset] = 0; // filter: none
        for (let x = 0; x < width; x++) {
            const px = offset + 1 + x * 3;
            const isBorder = x < 2 || x >= width - 2 || y < 2 || y >= height - 2;
            const isHeader = y >= 2 && y < 28;
            const isTextBlock = isHeader && y >= 10 && y < 20 && x >= 10 && x < 80 && (x % 8 < 5);

            if (isBorder) {
                raw[px] = 180; raw[px + 1] = 180; raw[px + 2] = 180;
            } else if (isTextBlock) {
                raw[px] = 255; raw[px + 1] = 255; raw[px + 2] = 255;
            } else if (isHeader) {
                raw[px] = 59; raw[px + 1] = 130; raw[px + 2] = 246;
            } else {
                raw[px] = 250; raw[px + 1] = 250; raw[px + 2] = 250;
            }
        }
    }

    const png = Buffer.concat([
        signature,
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", deflateSync(raw)),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);

    return png.toString("base64");
}
