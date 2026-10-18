// Natural metal veins and crystal pockets painted as shallow wall inlays.
// Harvest identities remain in minerals.js.
export const MINERAL_INLAY_ASSET = "assets/mineral-wall-inlays.webp";
export const ORE_INLAYS = Object.freeze({
  gold: 0,
  copper: 1,
  tin: 2,
  iron: 3,
  crystal: 4,
  amethyst: 5,
  rare: 6,
});
export function drawOreVeins(c, id, x, y, px, py, plane = "cap", atlas) {
  const index = ORE_INLAYS[id];
  if (index === undefined || !atlas) return;
  const cell = atlas.width / 3,
    front = plane === "face",
    variety = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  c.save();
  c.translate(px + 32, py + (front ? 43 : 32));
  c.scale(variety - Math.floor(variety) > 0.5 ? -1 : 1, front ? 0.58 : 1);
  c.drawImage(
    atlas,
    (index % 3) * cell,
    Math.floor(index / 3) * cell,
    cell,
    cell,
    -31,
    -31,
    62,
    62,
  );
  c.restore();
}
