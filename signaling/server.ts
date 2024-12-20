import { types as MediasoupTypes } from "mediasoup";
import config from "./config/config.js";
import type * as Party from "partykit/server";
import Mediasoup from "@/signaling/mediasoup.js";
import { verifyToken } from "@/signaling/util.js";

interface RoomRecord {
  [routerId: string]: {
    producerTransport: MediasoupTypes.WebRtcTransport;
    consumerTransport: MediasoupTypes.WebRtcTransport;
    producer: MediasoupTypes.Producer;
    consumer: MediasoupTypes.Consumer;
  };
}
interface UserStorage {
  rooms: Array<RoomRecord>;
}
/**
 * The server that manages everything related to Mediasoup elements' setup and teardown, including workers, routers, and more.
 */
export default class MediasoupServer implements Party.Server {
  mediasoupHandler: Mediasoup | undefined;
  constructor(readonly room: Party.Room) {
    this.mediasoupHandler = new Mediasoup();
  }

  static async onBeforeConnect(request: Party.Request, lobby: Party.Lobby) {
    try {
      const token = new URL(request.url).searchParams.get("token") ?? "";
      const response = await verifyToken(token);
      console.log(response);
      return request;
    } catch (err) {
      console.error("Failed to verify token", err);
      return new Response("Unauthorized", { status: 401 });
    }
  }
  workers: Array<MediasoupTypes.Worker> = [];
  /**
   * Connection state includes:
   *    user ID
   *    rooms[]
   *      id: {
   *        producerTransport
   *        consumerTransport
   *        producer
   *        consumer
   *      }
   */
  nextMediasoupWorkerIdx = 0;
  async onStart() {
    try {
      await this.mediasoupHandler?.createWorkers(
        config.numWorkers,
        config.workerSettings
      );
    } catch (err) {
      console.error("Create Worker ERROR --->", err);
      process.exit(1);
    }
  } // when a new client connects
  onConnect(connection: Party.Connection) {
    // welcome the new joiner
    connection.send(`Welcome, ${connection.id}`);
  }
}
