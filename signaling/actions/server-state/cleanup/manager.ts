import { commandOptions, createClient } from "redis";
import { CHECK, SWEEP } from "./constants";
import { RoomChecker, UserChecker } from "./checker";
import { UserSweeper, RoomSweeper } from "./sweeper";
type Client = ReturnType<typeof createClient>;
import redis from "../../../lib/redis";
import logs from "../../../lib/logger";
const CHECKERS = {
  user: UserChecker,
  room: RoomChecker,
};
const SWEEPERS = {
  user: UserSweeper,
  room: RoomSweeper,
};
interface CheckMessage {
  resource: string;
  type: "user" | "room";
}
type LatestStreamIds = Record<string, string>;
const DEFAULT = "0-0";
export async function getLatestStreamIds() {
  const check = await redis.hGet(`lastProcessed:${CHECK}`, "latest");
  const sweep = await redis.hGet(`lastProcessed:${SWEEP}`, "latest");
  return { check: check ?? DEFAULT, sweep: sweep ?? DEFAULT };
}
export async function listenForSweep(latestStreamIds: LatestStreamIds) {
  let { check, sweep } = latestStreamIds;
  while (true) {
    try {
      const response = await redis.xRead(
        commandOptions({
          isolated: true,
        }),
        [
          // XREAD can read from multiple streams, starting at a
          // different ID for each...
          {
            key: CHECK,
            id: check,
          },
        ],
        {
          // Read 1 entry at a time, block for 5 seconds if there are none.
          COUNT: 1,
          BLOCK: 5000,
        }
      );
      if (response) {
        const [streamMessage] = response;
        const { name: streamName, messages } = streamMessage;
        const [{ message, id }] = messages;
        const { resource, type } = (message as unknown as CheckMessage) ?? {};

        if (type && resource && streamName === CHECK) {
          const checker = CHECKERS[type];
          logs.debug("Cleanup listener received message: %O", {
            id,
            type,
            resource,
          });
          if (await checker.shouldSweep(resource)) {
            await SWEEPERS[type].sweep(resource);
          }
        } else if (type && resource && streamName === SWEEP) {
          const sweeper = SWEEPERS[type];
          await sweeper.sweep(resource);
        }
        check = id;
        await redis.hSet(`lastProcessed:${CHECK}`, "latest", DEFAULT);
        await redis.hSet(`lastProcessed:${SWEEP}`, "latest", DEFAULT);
        logs.debug("Check", check);
      } else {
        logs.debug("No messages received");
      }
    } catch (e) {
      console.error(e);
    }
  }
}
