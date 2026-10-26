import { defineConfig, type Plugin } from "vite";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const here = fileURLToPath(new URL(".", import.meta.url));
// Single source of truth for numbers and models (figures, video and this site all import it).
// Override with FLEXITAC_SHARED=/abs/path if the folders move apart.
const shared = process.env.FLEXITAC_SHARED ?? resolve(here, "../flexitac-anatomy/shared");

// Print the address in a box once the server is listening (dev and preview), so it can't get lost in the log.
// Uses the real port, which differs from 5173 when that one is already taken.
function printAddress(): Plugin {
  const banner = (httpServer: Server | null | undefined, what: string) =>
    httpServer?.once("listening", () => {
      const { port } = httpServer.address() as AddressInfo;
      const url = `http://localhost:${port}/`;
      const w = Math.max(what.length, url.length);
      const line = "─".repeat(w + 8);
      setTimeout(() => console.log(`\n  ┌${line}┐\n  │    ${what.padEnd(w)}    │\n  │    ${url.padEnd(w)}    │\n  └${line}┘\n`), 0);
    });
  return {
    name: "learn-flexitac:print-address",
    configureServer: (server) => void banner(server.httpServer as Server | null, "Learn FlexiTac is running:"),
    configurePreviewServer: (server) => void banner(server.httpServer as Server, "Learn FlexiTac (build):"),
  };
}

export default defineConfig({
  plugins: [printAddress()],
  base: "./",
  resolve: { alias: { "@shared": shared } },
  server: { fs: { allow: [here, shared] } },
  build: { target: "es2022", assetsInlineLimit: 0, chunkSizeWarningLimit: 600 },
});
