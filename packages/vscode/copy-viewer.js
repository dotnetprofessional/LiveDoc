const fs = require('fs-extra');
const path = require('path');

const srcDir = path.resolve(__dirname, '../viewer/dist/webview');
const destDir = path.resolve(__dirname, 'dist/viewer');

async function copyViewer() {
    try {
        if (!fs.existsSync(srcDir)) {
            console.warn(`Viewer build not found at ${srcDir}. Skipping copy.`);
            return;
        }
        await fs.ensureDir(destDir);
        await fs.copy(srcDir, destDir);
        console.log(`Viewer copied to ${destDir}`);
    } catch (err) {
        console.error('Error copying viewer:', err);
        process.exit(1);
    }
}

copyViewer();
