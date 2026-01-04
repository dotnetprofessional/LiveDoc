import { discoverServer } from './packages/server/src/index.ts';
import * as os from 'os';
import * as path from 'path';

async function test() {
    console.log("os.tmpdir():", os.tmpdir());
    const portFile = path.join(os.tmpdir(), 'livedoc-server.json');
    console.log("Port file path:", portFile);
    console.log("Discovering server...");
    const serverInfo = await discoverServer();
    console.log("Server info:", serverInfo);
}

test();
