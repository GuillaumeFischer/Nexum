const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Frame a similar number of tiles on a laptop or a large fullscreen monitor.
// The slight downward framing leaves room ahead of the miner's helmet.
export function caveView(w, h, camera, requestedZoom = 1.1) {
  const zoom = clamp(requestedZoom, 0.8, 1.35) * clamp(h / 760, 1, 1.65) * 1.12;
  const ox = w / zoom / 2 - camera.x * 64,
    oy = (h / zoom) * 0.56 - camera.y * 64;
  return { zoom, ox, oy, width: w / zoom, height: h / zoom };
}
