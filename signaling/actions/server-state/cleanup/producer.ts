import redis from "../../../lib/redis";
import { commandOptions } from "redis";
import { CHECK, SWEEP } from "./constants";
/**
 *
 * @param resource
 * @param type
 */
export async function publishCheckRequest(
  resource: string,
  type: "user" | "room"
) {
  await redis.xAdd(
    commandOptions({
      isolated: true,
    }),
    CHECK,
    "*",
    { resource, type }
  );
}

export async function publishCleanRequest(
  resource: string,
  type: "user" | "room"
) {
  await redis.xAdd(
    commandOptions({
      isolated: true,
    }),
    SWEEP,
    "*",
    { resource, type }
  );
}
