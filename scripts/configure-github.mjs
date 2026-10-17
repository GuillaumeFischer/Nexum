import fs from "node:fs/promises";
import { githubDistribution } from "../packages/core/config.mjs";
const [owner, repo] = process.argv.slice(2),
  distribution = { owner, repo, branch: "main" };
if (!githubDistribution(distribution))
  throw Error("Usage : npm run configure:github -- compte depot");
await fs.writeFile("distribution.json", JSON.stringify(distribution, null, 2));
const p = JSON.parse(await fs.readFile("package.json", "utf8"));
p.repository = { type: "git", url: `https://github.com/${owner}/${repo}.git` };
p.build.publish = { provider: "github", owner, repo };
await fs.writeFile("package.json", JSON.stringify(p, null, 2));
console.log("Dépôt configuré : " + owner + "/" + repo);
