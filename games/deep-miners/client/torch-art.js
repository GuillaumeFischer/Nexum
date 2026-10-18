import {
  TORCH_BODY,
  TORCH_FRAMES,
  TORCH_HEIGHT,
  FLAME_SCALE,
} from "./torch-art-layout.js";
export const TORCH_LIGHT_RADIUS = 288;
export const TORCH_LIGHT_RANGE = 4.7;
function phase(id) {
  let n = 0;
  for (const letter of String(id ?? 0))
    n = (n * 31 + letter.charCodeAt(0)) >>> 0;
  return (n % 628) / 100;
}
export function torchAnimation(clock, id) {
  const offset = phase(id),
    frame = (clock * 12 + offset * 3) % TORCH_FRAMES.length;
  return {
    index: Math.floor(frame),
    mix: frame - Math.floor(frame),
    phase: offset,
    intensity:
      1 +
      Math.sin(clock * 2.7 + offset) * 0.018 +
      Math.sin(clock * 5.3 + offset * 2) * 0.009,
  };
}
export function createTorchArt(assets, makeCanvas) {
  const body = assets["torch-body"],
    flames = assets["torch-flames"],
    scale = TORCH_HEIGHT / TORCH_BODY.h;
  const shadow = makeCanvas();
  shadow.width = 96;
  shadow.height = 64;
  const s = shadow.getContext("2d");
  for (const [xx, yy] of [
    [0, 0],
    [(TORCH_BODY.w * 0.12 - TORCH_BODY.anchorX) * scale, -5],
    [(TORCH_BODY.w * 0.9 - TORCH_BODY.anchorX) * scale, -5],
  ]) {
    s.save();
    s.translate(48 + xx, 40 + yy);
    s.scale(1, 0.4);
    const g = s.createRadialGradient(0, 0, 0, 0, 0, 7);
    g.addColorStop(0, "#020303b0");
    g.addColorStop(1, "transparent");
    s.fillStyle = g;
    s.fillRect(-8, -8, 16, 16);
    s.restore();
  }
  function draw(c, item, clock, ox, oy) {
    if (!body || !flames) return;
    const x = item.x * 64 + ox,
      y = item.y * 64 + oy + 8,
      pose = torchAnimation(clock, item.id);
    const left = x - TORCH_BODY.anchorX * scale,
      top = y - TORCH_BODY.anchorY * scale;
    const fx = left + TORCH_BODY.flameX * scale,
      fy = top + TORCH_BODY.flameY * scale;
    c.save();
    c.drawImage(shadow, x - 48, y - 40);
    // Measured roots keep the fire attached while the support remains still.
    c.save();
    c.globalCompositeOperation = "lighter";
    for (const [index, alpha] of [
      [pose.index, 1 - pose.mix],
      [(pose.index + 1) % TORCH_FRAMES.length, pose.mix],
    ]) {
      const frame = TORCH_FRAMES[index];
      c.globalAlpha = alpha;
      c.drawImage(
        flames,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        fx - frame.anchorX * FLAME_SCALE,
        fy - frame.anchorY * FLAME_SCALE,
        frame.w * FLAME_SCALE,
        frame.h * FLAME_SCALE,
      );
    }
    c.restore();
    // Front ironwork hides the fire root inside the coal basket.
    c.drawImage(
      body,
      TORCH_BODY.x,
      TORCH_BODY.y,
      TORCH_BODY.w,
      TORCH_BODY.h,
      left,
      top,
      TORCH_BODY.w * scale,
      TORCH_BODY.h * scale,
    );
    for (let i = 0; i < 4; i++) {
      const age = (clock * 0.47 + i * 0.25 + pose.phase * 0.17) % 1;
      c.globalAlpha = (1 - age) * 0.65;
      c.fillStyle = i % 2 ? "#ffd78e" : "#f3a547";
      const xx = fx + Math.sin(age * 4 + i + pose.phase) * 5,
        yy = fy - 7 - age * 40;
      c.fillRect(xx, yy, 0.8, 1.1);
    }
    c.restore();
  }
  return { draw };
}
