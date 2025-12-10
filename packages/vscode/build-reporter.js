const esbuild = require('esbuild');
const path = require('path');

async function build() {
    try {
        await esbuild.build({
            entryPoints: [path.join(__dirname, 'src/reporter/index.tsx')],
            bundle: true,
            outfile: path.join(__dirname, 'out/reporter/index.js'),
            platform: 'browser',
            target: 'es2020',
            loader: { '.tsx': 'tsx', '.ts': 'ts' },
            define: { 'process.env.NODE_ENV': '"production"' },
            sourcemap: true,
            minify: true,
        });
        console.log('Reporter built successfully');
    } catch (e) {
        console.error('Build failed', e);
        process.exit(1);
    }
}

build();
