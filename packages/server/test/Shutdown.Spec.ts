import { feature, scenario, background, given, when, Then, and } from "@swedevtools/livedoc-vitest";
import { expect } from "vitest";
import { WebSocket } from "ws";
import { createServer, type LiveDocServer } from "../src/index.js";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

function failAfter(milliseconds: number): Promise<never> {
    return new Promise((_, reject) => {
        const timeout = setTimeout(
            () => reject(new Error(`Timed out after ${milliseconds}ms waiting for server shutdown`)),
            milliseconds
        );
        timeout.unref();
    });
}

function waitForSocketOpen(socket: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.once("open", () => resolve());
        socket.once("error", reject);
    });
}

feature(`Server Shutdown
    @integration @websocket
    The server should close active real-time viewer connections during shutdown.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let socket: WebSocket;
    let socketClosed: Promise<void>;
    let elapsedMs = 0;

    background("Running server with WebSocket support", (ctx) => {
        given("a LiveDoc server is running on an ephemeral port", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-shutdown-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({
                port: 0,
                host: "localhost",
                dataDir: testDataDir
            });
            await server.listen();
        });

        and("a WebSocket client is connected to '/ws'", async (ctx) => {
            socket = new WebSocket(`ws://localhost:${server.getPort()}${ctx.step.values[0]}`);
            socketClosed = new Promise((resolve) => {
                socket.once("close", () => resolve());
            });
            await waitForSocketOpen(socket);
        });

        ctx.afterBackground(async () => {
            if (socket && socket.readyState !== WebSocket.CLOSED) {
                socket.terminate();
            }
            if (server?.isRunning()) {
                await server.stop();
            }
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Stopping the server with active WebSocket clients", () => {
        when("stopping the server with '1' active WebSocket connection and a '1000' millisecond timeout", async (ctx) => {
            expect(server.getWebSocketManager().getClientCount()).toBe(ctx.step.values[0]);

            const timeoutMs = ctx.step.values[1] as number;
            const started = Date.now();
            const stopPromise = server.stop();

            try {
                await Promise.race([stopPromise, failAfter(timeoutMs)]);
            } catch (error) {
                socket.terminate();
                await stopPromise;
                throw error;
            }

            elapsedMs = Date.now() - started;
        });

        Then("shutdown completes in less than '1000' milliseconds", (ctx) => {
            expect(elapsedMs).toBeLessThan(ctx.step.values[0]);
        });

        and("the server reports running is 'false'", (ctx) => {
            expect(server.isRunning()).toBe(ctx.step.values[0]);
        });

        and("the WebSocket client closes within '1000' milliseconds", async (ctx) => {
            await Promise.race([socketClosed, failAfter(ctx.step.values[0] as number)]);
            expect(socket.readyState).toBe(WebSocket.CLOSED);
        });
    });
});
