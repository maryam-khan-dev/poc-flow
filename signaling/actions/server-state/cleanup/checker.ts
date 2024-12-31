import redis from "../../../lib/redis";
export class UserChecker {
  /**
   * Checks if the user is empty and should be auto-removed.
   * @param userId The entity key of the resource to check.
   * @returns True if the user is empty and should be auto-removed, false otherwise.
   */
  static async shouldSweep(userId: string) {
    if (!userId) return false;
    const peerKeyCount = await redis.sCard(`peerKeys:user:${userId}`);
    return peerKeyCount === 0;
  }
}
export class RoomChecker {
  /**
   * Checks if the room is empty and should be auto-removed.
   * @param roomKey The entity key of the resource to check.
   * @returns True if the room is empty and should be auto-removed, false otherwise.
   */
  static async shouldSweep(roomKey: string) {
    if (!roomKey) return false;
    const roomKeyCount = await redis.sCard(`memberPeerKeys:room:${roomKey}`);
    return roomKeyCount === 0;
  }
}
export type Checker = typeof UserChecker | typeof RoomChecker;
