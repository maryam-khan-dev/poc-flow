import { WebSocket } from "uWebSockets.js";
import { ServerUpdate, UserData } from "../ServerTypes";
import logs from "../lib/logger";
export const WS_ERRORS = {
  ROOM_NON_EXISTENT: "Room does not exist",
  PRODUCER_NON_EXISTENT: "Producer does not exist",
  CONSUMER_NON_EXISTENT: "Consumer does not exist",
};
export class WebSocketActions {
  static send(ws: WebSocket<UserData>, message: ServerUpdate) {
    // TODO: see if corking makes effect?
    try {
      ws.cork(() => ws.send(JSON.stringify(message)));
    } catch (e) {
      logs.error(`Error sending data %O`, e);
    }
  }
  static end(ws: WebSocket<UserData>, code: number, reason: string) {
    ws.cork(() => ws.end(code, reason));
  }
  static sendCloseEvent(
    providedWs: WebSocket<UserData>,
    additionalInfo: Record<string, unknown>,
    source: string,
    success: boolean = true
  ) {
    this.send(providedWs, {
      contents: {
        info: `${source} closed`,
        ...additionalInfo,
      },
      type: `${source}Close`,
      success,
    });
  }

  static sendRoomNonExistentError(ws: WebSocket<UserData>, type: string) {
    this.send(ws, {
      type,
      contents: {
        info: "Room does not exist",
      },
      success: false,
    });
  }
  static sendError(
    ws: WebSocket<UserData>,
    type: string,
    message: string,
    additionalInfo?: Record<string, unknown>
  ) {
    this.send(ws, {
      type,
      contents: {
        info: message,
        ...additionalInfo,
      },
      success: false,
    });
  }
}
