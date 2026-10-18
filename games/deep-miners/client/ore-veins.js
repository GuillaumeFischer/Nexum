// World-only mineral inlays. Inventory icons and harvest identities stay in
// minerals.js; these shallow fragments belong to the wall's own surface.
export const ORE_INLAYS = Object.freeze({
  gold: { dark: "#76521c", base: "#d9a337", light: "#ffe39a" },
  crystal: { dark: "#1b686e", base: "#43b6bd", light: "#a1f0eb" },
  amethyst: { dark: "#573575", base: "#a26ac4", light: "#e1b1f3" },
  copper: { dark: "#713a25", base: "#c57743", light: "#f3b880" },
  tin: { dark: "#555f64", base: "#a6afb0", light: "#e4e6d9" },
  iron: { dark: "#483b33", base: "#8d6b52", light: "#c8a184" },
  rare: { dark: "#3c304e", base: "#77608f", light: "#d1a8df" },
});
const noise = (x, y, k) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 71.7) * 43758.5453;
  return n - Math.floor(n);
};

export function drawOreVeins(c, id, x, y, px, py, plane = "cap") {
  const palette = ORE_INLAYS[id];
  if (!palette) return;
  const seed = Object.keys(ORE_INLAYS).indexOf(id) * 137;
  const grain = (k) => noise(x + seed, y, k);
  const front = plane === "face";
  const opacity = c.globalAlpha;
  const project = (xx, yy) => [px + xx, py + (front ? 28 + yy * 0.49 : yy)];
  c.save();
  // Rock seams continue between the inclusions, rather than outlining a pile.
  const seam = Array.from({ length: 5 }, (_, i) => [
    8 + i * 12,
    18 + i * 5 + (grain(i + 90) - 0.5) * 13,
  ]);
  c.beginPath();
  seam.forEach(([xx, yy], i) =>
    i ? c.lineTo(...project(xx, yy)) : c.moveTo(...project(xx, yy)),
  );
  c.strokeStyle = "#090a0ab0";
  c.lineWidth = 1.6;
  c.stroke();
  c.strokeStyle = palette.dark;
  c.lineWidth = 0.6;
  c.stroke();
  for (let i = 0; i < 20; i++) {
    const xx = 9 + grain(i * 7 + 1) * 45,
      yy = 8 + grain(i * 7 + 2) * 47;
    const radius = 2.1 + grain(i * 7 + 3) * 3.8;
    const points = [
      [-1, -0.4],
      [-0.2, -0.55],
      [0.85, -0.38],
      [1, 0.25],
      [0.15, 0.48],
      [-0.85, 0.35],
    ].map(([dx, dy], k) =>
      project(
        xx + dx * radius,
        yy + dy * radius * (0.78 + grain(i * 13 + k) * 0.4),
      ),
    );
    c.beginPath();
    points.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b)));
    c.closePath();
    // A dark cut edge with restrained upper glints gives shallow, embedded ore.
    c.fillStyle = palette.dark;
    c.fill();
    c.strokeStyle = "#10100ed9";
    c.lineWidth = 1.5;
    c.stroke();
    c.save();
    c.clip();
    const [cx, cy] = project(xx, yy),
      height = radius * (front ? 0.55 : 1.1);
    c.fillStyle = palette.base;
    c.fillRect(cx - radius, cy - height, radius * 2, height * 2);
    for (let k = 0; k < 8; k++) {
      c.fillStyle = k % 3 === 0 ? palette.light : palette.dark;
      c.globalAlpha = opacity * (k % 3 === 0 ? 0.4 : 0.28);
      c.fillRect(
        cx - radius + grain(i * 61 + k) * radius * 2,
        cy - height * 0.6 + grain(i * 41 + k) * height,
        1 + grain(i * 31 + k) * 2,
        front ? 0.65 : 1.2,
      );
    }
    c.globalAlpha = opacity * 0.65;
    c.strokeStyle = palette.light;
    c.lineWidth = 0.65;
    c.beginPath();
    c.moveTo(...points[0]);
    c.lineTo(...points[1]);
    c.lineTo(...points[2]);
    c.stroke();
    // A narrow rock lip crosses part of each inclusion, burying its edge.
    c.globalAlpha = opacity * 0.55;
    c.strokeStyle = "#211e19";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - radius, cy + height * 0.2);
    c.lineTo(cx + radius * 0.2, cy - height * 0.05);
    c.stroke();
    c.restore();
  }
  c.restore();
}
