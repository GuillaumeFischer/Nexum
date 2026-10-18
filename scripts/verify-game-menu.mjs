import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

await fs.mkdir("test-output", { recursive: true });
const scratch = await fs.mkdtemp(path.resolve("test-output", "game-menu-"));
await fs.mkdir(path.join(scratch, "profile"));
const options = process.argv.slice(2);
const fixture =
  options.includes("--cavern") ||
  options.includes("--ores") ||
  options.includes("--selected-art")
    ? "tests/cavern-render-electron.mjs"
    : options.includes("--transfers")
      ? "tests/transfer-quantity-electron.mjs"
      : "tests/game-menu-electron.mjs";
const appRoot = options.includes("--app-root")
  ? path.resolve(options[options.indexOf("--app-root") + 1])
  : process.cwd();
const gameRoot = options.includes("--game-root")
  ? path.resolve(options[options.indexOf("--game-root") + 1])
  : path.resolve("games/deep-miners");
const env = {
  ...process.env,
  NEXUM_MENU_SCRATCH: scratch,
  NEXUM_MENU_APP_ROOT: appRoot,
  NEXUM_MENU_GAME_ROOT: gameRoot,
  NEXUM_MENU_PREVIEW: options.includes("--preview") ? "1" : "0",
  NEXUM_MENU_HIDDEN: options.includes("--hidden") ? "1" : "0",
  NEXUM_RENDER_ORES: options.includes("--ores") ? "1" : "0",
  NEXUM_RENDER_SELECTED_ART: options.includes("--selected-art") ? "1" : "0",
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const child = spawn(
  path.resolve("node_modules/electron/dist/electron.exe"),
  [path.resolve(fixture)],
  { env, windowsHide: false, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (bytes) => {
  output += bytes;
  process.stdout.write(bytes);
});
child.stderr.on("data", (bytes) => {
  output += bytes;
});
const timeout = setTimeout(
  () => child.kill(),
  options.includes("--preview")
    ? 110000
    : options.includes("--cavern")
      ? 90000
      : 45000,
);
try {
  const [code] = await once(child, "exit");
  const result = JSON.parse(
    await fs.readFile(path.join(scratch, "report.json"), "utf8").catch(() => {
      throw Error(
        "Le contrôle du menu n’a pas produit de résultat.\n" + output,
      );
    }),
  );
  if (code !== 0 || !result.ok)
    throw Error(JSON.stringify(result) + "\n" + output);
  console.log("Rapport et captures : " + scratch);
} finally {
  clearTimeout(timeout);
}
