import fs from "node:fs/promises";
const target = "apps/launcher/assets/fonts";
await fs.mkdir(target, { recursive: true });
const response = await fetch(
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap",
  {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20000),
  },
);
if (!response.ok) throw Error("Polices indisponibles.");
let css = await response.text(),
  index = 0;
for (const match of css.matchAll(
  /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g,
)) {
  const name = "nexum-" + ++index + ".ttf",
    font = await fetch(match[1], { signal: AbortSignal.timeout(20000) });
  if (!font.ok) throw Error("Police indisponible.");
  await fs.writeFile(
    target + "/" + name,
    Buffer.from(await font.arrayBuffer()),
  );
  css = css.replace(match[0], `url('../assets/fonts/${name}')`);
}
if (index !== 8) throw Error("Le format des polices a changé.");
for (const family of ["inter", "outfit"]) {
  const r = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
  );
  if (!r.ok) throw Error("Licence indisponible.");
  await fs.writeFile(target + "/LICENSE-" + family + ".txt", await r.text());
}
await fs.writeFile("apps/launcher/ui/fonts.css", css);
console.log("Inter et Outfit incluses dans le launcher.");
