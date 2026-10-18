// Orthographic cave relief. Every face stays inside its original solid cell:
// the visible foot of a wall is also its collision boundary.
const SIZE = 64;
const random = (x, y, k = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 71.7) * 43758.5453;
  return n - Math.floor(n);
};
const open = (tile) => tile === 0 || tile === 10 || tile === 11;
export function caveEdges(tiles, x, y) {
  return {
    top: open(tiles[y - 1]?.[x]),
    right: open(tiles[y]?.[x + 1]),
    bottom: open(tiles[y + 1]?.[x]),
    left: open(tiles[y]?.[x - 1]),
  };
}

export function drawCaveWall(c, tiles, x, y, px, py, texture) {
  const edge = caveEdges(tiles, x, y);
  const left = px + (edge.left ? 3 : 0),
    right = px + SIZE - (edge.right ? 3 : 0);
  const top = py + (edge.top ? 4 : 0),
    bottom = py + SIZE - (edge.bottom ? 2 : 0);
  c.fillStyle = "#020405";
  c.fillRect(px, py, SIZE, SIZE);
  c.save();
  c.beginPath();
  c.rect(left, top, right - left, bottom - top);
  c.clip();
  texture();
  // Undug rock recedes into darkness, while the headlamp can still reveal ore
  // in the first two layers. No opaque overlay is applied after the light pass.
  const exposed = Object.values(edge).some(Boolean);
  let near = exposed;
  if (!near)
    for (const [dx, dy] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      if (open(tiles[y + dy]?.[x + dx])) {
        near = true;
        break;
      }
    }
  c.fillStyle = exposed ? "#0607078c" : near ? "#020405cf" : "#010203f5";
  c.fillRect(px, py, SIZE, SIZE);
  if (edge.bottom) {
    const ridgeLeft = py + 21 + random(x, y, 71) * 6,
      ridgeRight = py + 21 + random(x + 1, y, 71) * 6;
    c.save();
    c.beginPath();
    c.moveTo(left, ridgeLeft);
    c.lineTo(left + SIZE * 0.32, ridgeLeft - 2);
    c.lineTo(right - SIZE * 0.25, ridgeRight + 2);
    c.lineTo(right, ridgeRight);
    c.lineTo(right, bottom);
    c.lineTo(left, bottom);
    c.closePath();
    c.clip();
    texture();
    const g = c.createLinearGradient(px, py + 20, px, bottom);
    g.addColorStop(0, "#0b090b8c");
    g.addColorStop(0.22, "#9f75422b");
    g.addColorStop(0.65, "#17121330");
    g.addColorStop(1, "#020405c9");
    c.fillStyle = g;
    c.fillRect(px, py, SIZE, SIZE);
    // Uneven vertical strata rather than a separate boulder on every tile.
    for (let k = 0; k < 2; k++) {
      const xx = left + 10 + k * 27 + random(x, y, k + 81) * 9;
      c.beginPath();
      c.moveTo(xx, py + 23);
      c.lineTo(xx - 3, py + 37);
      c.lineTo(xx + 2, py + 48);
      c.lineTo(xx - 1, bottom);
      c.strokeStyle = "#070709a6";
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = "#d3ac6f35";
      c.lineWidth = 0.8;
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.moveTo(left, ridgeLeft);
    c.lineTo(left + SIZE * 0.32, ridgeLeft - 2);
    c.lineTo(right - SIZE * 0.25, ridgeRight + 2);
    c.lineTo(right, ridgeRight);
    c.strokeStyle = "#d0ab706b";
    c.lineWidth = 2;
    c.stroke();
  }
  for (const [side, sign] of [
    ["left", 1],
    ["right", -1],
  ])
    if (edge[side]) {
      const xx = side === "left" ? left : right;
      const g = c.createLinearGradient(xx, py, xx + sign * 12, py);
      g.addColorStop(0, "#d5ad633d");
      g.addColorStop(0.24, "#080909a6");
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(side === "left" ? left : right - 12, top, 12, bottom - top);
    }
  if (edge.top) {
    const g = c.createLinearGradient(px, top, px, top + 13);
    g.addColorStop(0, "#b18f5638");
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.fillRect(left, top, right - left, 13);
  }
  c.restore();
}

export function drawCaveContact(c, x, y, px, py, solid) {
  for (const [dx, dy, width] of [
    [0, -1, 19],
    [-1, 0, 12],
    [1, 0, 12],
    [0, 1, 7],
  ]) {
    if (!solid(x + dx, y + dy)) continue;
    const xx = px + (dx > 0 ? SIZE : 0),
      yy = py + (dy > 0 ? SIZE : 0);
    const g = c.createLinearGradient(xx, yy, xx - dx * width, yy - dy * width);
    g.addColorStop(0, "#000207b8");
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.fillRect(px, py, SIZE, SIZE);
  }
}
