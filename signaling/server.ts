import config from "./config";
import Mediasoup, { MediasoupTypes } from "./lib/mediasoup";
// import config from "./config/config.js";
// import Mediasoup from "@/signaling/mediasoup.js";
import { SHARED_COMPRESSOR, SSLApp, WebSocket } from "uWebSockets.js";
import {
  GetPeersCountUpdate,
  PeerData,
  UserData,
  UserIdUpdate,
} from "./ServerTypes";
import { WebSocketActions, WS_ERRORS } from "./actions/websocket";
import { bufferToJSON, generateHash } from "./lib/util";
import ServerState from "./actions/server-state/server-state";

const port = !!process.env.PORT ? parseInt(process.env.PORT) : 3001;
const mediasoupHandler = new Mediasoup();
const state = ServerState.getInstance();
const {
  getUserPresence,
  existsRoom,
  isUserInRoom,
  getRoom,
  storeRoom,
  storeTransport,
  storeUser,
  removeUserFromAllRooms,
  getTransport,
  getProducer,
  getConsumer,
  getRoomPeers,
  getRoomSize,
  removeUserFromRoom,
  existsProducer,
  existsConsumer,
} = state;
async function joinRoom(roomId: string, userId: string) {
  let message: string = "User is already in room";
  if (existsRoom(roomId) && !isUserInRoom(userId, roomId)) {
    message = "User has started to join room";
  } else if (!existsRoom(roomId)) {
    try {
      const router = await mediasoupHandler.createRouter(
        mediasoupHandler.getNextMediasoupWorker(),
        config.routerMediaCodecs,
        roomId
      );
      storeRoom(roomId, router);
      storeUser(userId, roomId);
    } catch (e) {
      console.error(e);
      return {
        contents: {
          info: "Error with router creation",
        },
        success: false,
      };
    }
  }
  return {
    contents: {
      info: message,
      routerRtpCapabilities: getRoom(roomId).router.rtpCapabilities,
      roomId,
    },
    success: true,
  };
}
async function createWebRtcTransports(roomId: string, userId: string) {
  console.log(roomId);
  const { router } = getRoom(roomId);
  const { webRtcTransport } = config;
  try {
    const producerTransport = await mediasoupHandler.createWebRtcTransport(
      router,
      webRtcTransport,
      userId
    );
    const consumerTransport = await mediasoupHandler.createWebRtcTransport(
      router,
      webRtcTransport,
      userId
    );
    storeTransport(producerTransport, userId, roomId, "producer");
    storeTransport(consumerTransport, userId, roomId, "consumer");
    return {
      contents: {
        info: "WebRTC transports created",
        producerTransportOptions: {
          id: producerTransport.id,
          iceParameters: producerTransport.iceParameters,
          iceCandidates: producerTransport.iceCandidates,
          dtlsParameters: producerTransport.dtlsParameters,
        },
        consumerTransportOptions: {
          id: consumerTransport.id,
          iceParameters: consumerTransport.iceParameters,
          iceCandidates: consumerTransport.iceCandidates,
          dtlsParameters: consumerTransport.dtlsParameters,
        },
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error creating WebRTC transports.",
      },
      success: false,
    };
  }
}
async function connectTransport(
  dtlsParameters: MediasoupTypes.DtlsParameters,
  transportId: string,
  userId: string
) {
  try {
    await mediasoupHandler.connectTransport(
      getTransport(transportId),
      dtlsParameters,
      userId
    );
    return {
      contents: {
        info: "Transport connected",
        transportId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error connecting transport",
        transportId,
      },
      success: false,
    };
  }
}
async function produce(
  producerTransportId: string,
  kind: MediasoupTypes.MediaKind,
  appData: MediasoupTypes.AppData,
  rtpParameters: MediasoupTypes.RtpParameters,
  userId: string
) {
  try {
    const producer = await mediasoupHandler.createProducer(
      getTransport(producerTransportId),
      { kind, rtpParameters, appData },
      userId
    );
    return {
      contents: {
        info: "Producer created",
        producerId: producer.id,
        producerTransportId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error creating producer.",
      },
      success: false,
    };
  }
}
async function consume(
  ws: WebSocket<UserData>,
  userId: string,
  consumerTransportId: string,
  producerId: string,
  rtpCapabilities: MediasoupTypes.RtpCapabilities,
  roomId: string
) {
  try {
    const { id, kind, rtpParameters, type, producerPaused } =
      await mediasoupHandler.createConsumer(
        getRoom(roomId).router,
        getTransport(consumerTransportId),
        { producerId, rtpCapabilities },
        userId,
        ws
      );
    return {
      contents: {
        info: "Consumer created",
        id,
        kind,
        rtpParameters,
        type,
        producerPaused,
        producerId,
        consumerTransportId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error creating consumer.",
      },
      success: false,
    };
  }
}

function closeProducer(producerId: string, userId: string) {
  const producer = getProducer(producerId);

  try {
    mediasoupHandler.closeSource(producer, userId, "producer");
    return {
      contents: {
        info: "Producer closed",
        producerId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);

    return {
      contents: {
        info: "Error closing producer.",
        producerId,
      },
      success: false,
    };
  }
}

async function pauseProducer(producerId: string, userId: string) {
  const pauseProducer = getProducer(producerId);

  try {
    await mediasoupHandler.pauseSource(pauseProducer, userId, "producer");
    return {
      contents: {
        info: "Producer paused",
        producerId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error pausing producer.",
        producerId,
      },
      success: false,
    };
  }
}
async function resumeProducer(producerId: string, userId: string) {
  const producer = getProducer(producerId);

  try {
    await mediasoupHandler.resumeSource(producer, userId, "producer");
    return {
      contents: {
        info: "Producer resumed",
        producerId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error resuming producer.",
        producerId,
      },
      success: false,
    };
  }
}
async function resumeConsumer(consumerId: string, userId: string) {
  const consumer = getConsumer(consumerId);

  try {
    await mediasoupHandler.resumeSource(consumer, userId, "consumer");
    return {
      contents: {
        info: "Consumer resumed",
        consumerId,
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error resuming consumer.",
        consumerId,
      },
      success: false,
    };
  }
}
function getProducersForPeer(userId: string, roomId: string) {
  const peersInfo = Object.entries(getRoomPeers(roomId))
    .map(([userId, peerData]) => ({
      userId,
      producerId: peerData.producerId,
    }))
    .filter(({ producerId }) => !!producerId);
  const producers = peersInfo.map(({ userId, producerId }) => {
    const { appData } = getProducer(producerId!);
    return {
      userId,
      producerId,
      appData,
    };
  });
  return {
    contents: {
      info: "Producers retrieved",
      producers,
    },
    success: true,
  };
}
function emptyRoomResources(
  roomId: string,
  userId: string,
  peerData: PeerData
) {
  const room = getRoom(roomId);
  // TODO: ugly - fetches room twice
  if (getRoomSize(roomId) <= 1 && !room.sticky) {
    console.log("Room will be empty, closing room");
    mediasoupHandler.closeRouter(getRoom(roomId).router);
  } else {
    console.log(
      "Room will not be empty, closing transports. This should also close producers and consumers."
    );
    const { transportIds } = peerData;
    Object.keys(transportIds).forEach((type) => {
      const transportId = transportIds[type as "producer" | "consumer"];
      if (!!transportId) {
        mediasoupHandler.closeTransport(getTransport(transportId), userId);
      }
    });
  }
}
function disconnect(userId: string, rooms: Record<string, PeerData>) {
  if (Object.keys(rooms).length === 0) {
    console.log("User is in no rooms, closing connection");
  }
  try {
    Object.entries(rooms).forEach(([roomId, peerData]) => {
      emptyRoomResources(roomId, userId, peerData);
    });

    // update server state
    removeUserFromAllRooms(userId);
  } catch (e) {
    console.error(e);
  }
}
function exitRoom(userId: string, roomId: string, peerData: PeerData) {
  emptyRoomResources(roomId, userId, peerData);

  // update server state
  removeUserFromRoom(userId, roomId, peerData);
}

export const app = SSLApp({
  key_file_name: "./config/key.pem",
  cert_file_name: "./config/cert.pem",
})
  .ws("/*", {
    /* Options */
    compression: SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 10,
    /* Handlers */
    upgrade: async (res, req, context) => {
      let userId: string | undefined;
      const accessToken = req.getQuery("accessToken")!;
      let upgradeAborted = false;
      const secWebsocketKey = req.getHeader("sec-websocket-key");
      const secWebsocketProtocol = req.getHeader("sec-websocket-protocol");
      const secWebsocketExtensions = req.getHeader("sec-websocket-extensions");
      res.onAborted(() => (upgradeAborted = true));
      if (accessToken !== "") {
        console.log("Access token provided");
        try {
          const spotifyRes = await fetch("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const profile = await spotifyRes.json();
          userId = profile.id;

          console.log(`Access token verified, userId: ${userId}`);
        } catch (e) {
          console.log(`Access token verification failed: ${e}`);
        }
      } else {
        const ipAddress = res.getRemoteAddressAsText();
        userId = await generateHash(ipAddress);
        console.log(`No accessToken provided. Generated new userId: ${userId}`);
      }
      if (!upgradeAborted)
        res.cork(() =>
          res.upgrade(
            {
              userId,
            },
            secWebsocketKey,
            secWebsocketProtocol,
            secWebsocketExtensions,
            context
          )
        );
    },
    open: (ws: WebSocket<UserData>) => {
      const { userId } = ws.getUserData();
      ws.getUserData = () => {
        return { userId, rooms: getUserPresence(userId) };
      };
      WebSocketActions.send(ws, {
        type: "userIdUpdate",
        contents: { userId },
        success: true,
      } as UserIdUpdate);
    },
    message: async (ws, message, _isBinary) => {
      /* Ok is false if backpressure was built up, wait for drain */
      const messageInfo = bufferToJSON(message as ArrayBuffer);
      const { userId } = ws.getUserData();
      console.log("USERS MAP ---> ", state.usersMap);
      console.log("ROOMS MAP ---> ", state.roomsMap);

      switch (messageInfo.type) {
        case "joinRoom":
          console.log("REQUEST TO JOIN ROOM --->", messageInfo.roomId);
          WebSocketActions.send(ws, {
            type: "joinRoomUpdate",
            ...(await joinRoom(messageInfo.roomId, userId)),
          });
          break;
        case "createWebRtcTransports":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "createWebRtcTransports",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
          }
          WebSocketActions.send(ws, {
            type: "createWebRtcTransportsUpdate",
            ...(await createWebRtcTransports(messageInfo.roomId, userId)),
          });
          break;
        case "connectTransport":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "connectTransportUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "connectTransportUpdate",
            ...(await connectTransport(
              messageInfo.dtlsParameters,
              messageInfo.transportId,
              userId
            )),
          });
          break;
        case "produce":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "produceUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "produceUpdate",
            ...(await produce(
              messageInfo.producerTransportId,
              messageInfo.kind,
              messageInfo.appData,
              messageInfo.rtpParameters,
              userId
            )),
          });
          break;
        case "consume":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "consumeUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          WebSocketActions.send(ws, {
            type: "consumeUpdate",
            ...(await consume(
              ws,
              userId,
              messageInfo.consumerTransportId,
              messageInfo.producerId,
              messageInfo.rtpCapabilities,
              messageInfo.roomId
            )),
          });
          break;
        case "producerClosed":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "producerClosedUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          if (!existsProducer(messageInfo.producerId)) {
            WebSocketActions.sendError(
              ws,
              "producerClosedUpdate",
              WS_ERRORS.PRODUCER_NON_EXISTENT
            );
            return;
          }
          WebSocketActions.send(ws, {
            type: "producerClosedUpdate",
            ...closeProducer(messageInfo.producerId, userId),
          });

          break;
        case "pauseProducer":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "pauseProducerUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          if (!existsProducer(messageInfo.producerId)) {
            WebSocketActions.sendError(
              ws,
              "pauseProducerUpdate",
              WS_ERRORS.PRODUCER_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "pauseProducerUpdate",
            ...(await pauseProducer(messageInfo.producerId, userId)),
          });
          break;
        case "resumeProducer":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "resumeProducerUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          if (!existsProducer(messageInfo.producerId)) {
            WebSocketActions.sendError(
              ws,
              "resumeProducerUpdate",
              WS_ERRORS.PRODUCER_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "resumeProducerUpdate",
            ...(await resumeProducer(messageInfo.producerId, userId)),
          });
          break;
        case "resumeConsumer":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "resumeConsumerUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          if (!existsConsumer(messageInfo.consumerId)) {
            WebSocketActions.sendError(
              ws,
              "resumeConsumerUpdate",
              WS_ERRORS.CONSUMER_NON_EXISTENT
            );
            return;
          }
          WebSocketActions.send(ws, {
            type: "resumeConsumerUpdate",
            ...(await resumeConsumer(messageInfo.consumerId, userId)),
          });
          break;
        case "getProducersForPeer":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "getProducersUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "getProducersUpdate",
            ...getProducersForPeer(userId, messageInfo.roomId),
          });
          break;
        case "getPeersCount":
          if (!existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "getPeersCountUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          WebSocketActions.send(ws, {
            type: "getPeersCountUpdate",
            contents: {
              info: "Peers count retrieved",
              peersCount: getRoomSize(messageInfo.roomId),
            },
            success: true,
          } as GetPeersCountUpdate);
          break;
        case "disconnect":
          WebSocketActions.end(ws, 200, "Disconnecting now. Goodbye!");
          break;
        // TODO: exitRoom even needed if each tab has its own websocket?
        // YES because disconnect removes user from all rooms by user ID
        // User ID, if unauthenticated, is stored in browser storage. Otherwise, it's the Spotify ID
        case "exitRoom":
          const { roomId } = messageInfo;
          if (!existsRoom(roomId)) {
            WebSocketActions.sendError(
              ws,
              "exitRoomUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          const { [roomId]: peerDataForRoom, ...otherRooms } =
            ws.getUserData().rooms;
          try {
            exitRoom(userId, roomId, peerDataForRoom);
            ws.getUserData = () => {
              return { userId, rooms: otherRooms };
            };
            WebSocketActions.end(
              ws,
              200,
              "User disconnected. Closing connection after emptying resources."
            );
          } catch (e) {
            console.error(e);
          }
          break;
        default:
          break;
      }
    },
    drain: (ws) => {
      console.log("WebSocket backpressure: " + ws.getBufferedAmount());
    },
    close: (ws, code, message) => {
      console.log(
        `WebSocket close requested with code ${code} and message ${message}.`
      );
      const { userId, rooms } = ws.getUserData();
      console.log("ROOMS ON CLOSE", rooms);
      disconnect(userId, rooms);
      console.log("User disconnected after emptying resources. Goodbye!");
    },
  })
  .get("/*", (res, _req) => {
    console.log("HTTP REQUEST RECEIVED");
    res.end("Hello World!");
  })
  .listen(port, async (token) => {
    if (token) {
      console.log("Listening to port " + port);
      console.log();
      try {
        await mediasoupHandler.createWorkers(
          config.numWorkers,
          config.workerSettings
        );
        console.log("Workers created");
      } catch (e) {
        console.error("Create Worker ERROR --->", e);
      }
    } else {
      console.log("Failed to listen to port " + port);
    }
  });
