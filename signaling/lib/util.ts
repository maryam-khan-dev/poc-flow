import { hash } from "argon2";
import { randomUUID } from "crypto";

export async function generateHash(ipAddress: ArrayBuffer) {
  return await hash(`${ipAddress}`, {
    secret: Buffer.from(`${randomUUID()}`),
  });
}
export function bufferToJSON(buffer: ArrayBuffer) {
  return JSON.parse(new TextDecoder().decode(buffer));
}
