import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

await fs.mkdir("test-output", { recursive: true });
const scratch = await fs.mkdtemp(path.resolve("test-output", "startup-"));
const source = process.argv[2] === "--source";
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const executable = path.resolve(
  source
    ? "node_modules/electron/dist/electron.exe"
    : process.argv[2] || "release/win-unpacked/" + pkg.productName + ".exe",
);
const report = path.join(scratch, "startup.json"),
  env = {
    ...process.env,
    ATELIER_DATA_DIR: scratch,
    ATELIER_STARTUP_CHECK: report,
  };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
let child,
  timer,
  output = "";
try {
  child = spawn(
    executable,
    [...(source ? [process.cwd()] : []), "--enable-logging=stderr"],
    { env, windowsHide: false, stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const exited = once(child, "exit");
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      child.kill();
      reject(
        Error(
          "La fenêtre du launcher ne s’est pas ouverte en 20 secondes.\n" +
            output,
        ),
      );
    }, 20000);
  });
  const [code] = await Promise.race([exited, timeout]);
  clearTimeout(timer);
  const result = JSON.parse(
    await fs.readFile(report, "utf8").catch(() => {
      throw Error(
        "Le launcher s’est arrêté sans fenêtre utilisable.\n" + output,
      );
    }),
  );
  if (code !== 0 || !result.ok)
    throw Error(
      "Échec du démarrage : " + JSON.stringify(result) + "\n" + output,
    );
  console.log(JSON.stringify(result));
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null) {
    const done = once(child, "exit");
    child.kill();
    await done;
  }
  // Keep the isolated profile and report for diagnosis; never use a player's data.
}
