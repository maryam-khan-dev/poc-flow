import logs from "../../../lib/logger";
import ServerState from "../server-state";
export class RoomSweeper {
  static async sweep(roomId: string) {
    if (!roomId) {
      logs.warn("Room ID empty");
      return;
    }
    logs.warn("Sweeping room %s", roomId);
    await ServerState.getInstance().removeRoom(roomId);
  }
}
export class UserSweeper {
  static async sweep(userId: string) {
    logs.warn("Sweeping user %s", userId);
    await ServerState.getInstance().removeUser(userId);
  }
}
export type Sweeper = typeof RoomSweeper | typeof UserSweeper;
