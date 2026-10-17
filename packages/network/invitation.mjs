import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ID, VERSION } from "../core/config.mjs";
export function encodeInvite({ gameId, version, publicKey, secret, room }) {
  if (
    !ID.test(gameId) ||
    !VERSION.test(version) ||
    publicKey.length !== 32 ||
    secret.length !== 16 ||
    !/^[A-F0-9]{6}$/.test(room)
  )
    throw Error("Invitation invalide.");
  const g = Buffer.from(gameId),
    v = Buffer.from(version),
    body = Buffer.concat([
      Buffer.from([1, g.length]),
      g,
      Buffer.from([v.length]),
      v,
      publicKey,
      secret,
      Buffer.from(room, "hex"),
    ]);
  return (
    "AJ1-" +
    Buffer.concat([
      body,
      createHash("sha256").update(body).digest().subarray(0, 4),
    ]).toString("base64url")
  );
}
export function decodeInvite(value) {
  if (
    typeof value !== "string" ||
    !/^AJ1-[A-Za-z0-9_-]{60,220}$/.test(value.trim())
  )
    throw Error("Code d’invitation invalide.");
  const all = Buffer.from(value.trim().slice(4), "base64url"),
    body = all.subarray(0, -4);
  if (
    body[0] !== 1 ||
    !timingSafeEqual(
      createHash("sha256").update(body).digest().subarray(0, 4),
      all.subarray(-4),
    )
  )
    throw Error("Code d’invitation incomplet ou incorrect.");
  let i = 2;
  const gameId = body.subarray(i, i + body[1]).toString();
  i += body[1];
  const length = body[i++],
    version = body.subarray(i, i + length).toString();
  i += length;
  if (!ID.test(gameId) || !VERSION.test(version) || body.length !== i + 51)
    throw Error("Code d’invitation invalide.");
  return {
    gameId,
    version,
    publicKey: body.subarray(i, i + 32),
    secret: body.subarray(i + 32, i + 48),
    room: body
      .subarray(i + 48)
      .toString("hex")
      .toUpperCase(),
  };
}
export const scopedIdentity = (identity, scope) =>
  createHmac("sha256", Buffer.from(identity, "hex"))
    .update(scope)
    .digest("hex");
