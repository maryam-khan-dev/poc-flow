import config from "./config";
import redis from "./lib/redis";
import Mediasoup, { MediasoupTypes } from "./lib/mediasoup";
import { SHARED_COMPRESSOR, SSLApp, WebSocket } from "uWebSockets.js";
import {
  FullRoomInfo,
  GetPeersCountUpdate,
  PeerData,
  UserData,
  UserIdUpdate,
  UserInfo,
} from "./ServerTypes";
import { WebSocketActions, WS_ERRORS } from "./actions/websocket";
import { bufferToJSON, generateHash } from "./lib/util";
import ServerState from "./actions/server-state/server-state";
import {
  getLatestStreamIds,
  listenForSweep,
} from "./actions/server-state/cleanup/manager";
import { publishCheckRequest } from "./actions/server-state/cleanup/producer";
import logs from "./lib/logger";

const port = !!process.env.PORT ? parseInt(process.env.PORT) : 3001;
const mediasoupHandler = new Mediasoup();
const state = ServerState.getInstance();

async function createWorkers() {
  try {
    const workers = await mediasoupHandler.createWorkers(
      config.numWorkers,
      config.workerSettings
    );
  } catch (e) {
    console.error(e);
    return null;
  }
}
async function createRoom(roomId: string) {
  const worker = mediasoupHandler.getNextMediasoupWorker();
  const router = await mediasoupHandler.createRouter(
    worker as MediasoupTypes.Worker,
    config.routerMediaCodecs,
    roomId
  );
  await state.storeRouter(router, config.routerMediaCodecs);
  await state.storeRoom(roomId, router.id);
  logs.info("Stored router %s", router.id);
}
async function joinNewRoom(roomId: string, userInfo: UserInfo) {
  let room: FullRoomInfo | null = null;
  const { userId } = userInfo;
  try {
    logs.info("User ID %s is creating room: %s", userId, roomId);
    await createRoom(roomId);
    room = await state.getRoom(roomId);
  } catch (e) {
    console.error(e);
    return {
      contents: { info: "Error with router creation" },
      success: false,
    };
  }
  if (!room)
    return { contents: { info: "Error creating room" }, success: false };
  await state.storeUser(userInfo, roomId);
  return {
    contents: {
      info: "User has created room successfully.",
      routerRtpCapabilities: room.router?.rtpCapabilities,
      roomId,
    },
    success: true,
  };
}

async function joinExistingRoom(roomId: string, userInfo: UserInfo) {
  let message: string = "";
  const room = await state.getRoom(roomId);
  const { userId } = userInfo;
  logs.debug("User ID %s joining existing room: %O", userId, room);
  if (!room) {
    return {
      contents: { info: "Could not fetch room details" },
      success: false,
    };
  }
  const isUserInRoom = await state.isUserInRoom(userId, roomId);
  if (isUserInRoom) {
    message = "User is already in room";
    logs.info("User is already in room %s", userId, roomId);
  } else {
    message = "User has started to join room";
    logs.info("User will now join room %s", roomId);
  }
  await state.storeUser(userInfo, roomId);
  return {
    contents: {
      info: message,
      routerRtpCapabilities: room.router?.rtpCapabilities,
      roomId,
    },
    success: true,
  };
}
async function createWebRtcTransports(room: FullRoomInfo, userId: string) {
  const { webRtcTransport } = config;
  try {
    logs.info(
      "Creating WebRTC transports with %s %O %s",
      room.router?.id,
      webRtcTransport,
      userId
    );
    const producerTransport = await mediasoupHandler.createWebRtcTransport(
      room.router,
      webRtcTransport,
      userId
    );
    const consumerTransport = await mediasoupHandler.createWebRtcTransport(
      room.router,
      webRtcTransport,
      userId
    );
    await state.storeTransport(
      producerTransport,
      userId,
      room.id,
      "producer",
      webRtcTransport
    );
    await state.storeTransport(
      consumerTransport,
      userId,
      room.id,
      "consumer",
      webRtcTransport
    );
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
    logs.error("Couldn't create transports");
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
      state.getTransport(transportId),
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
  roomId: string,
  producerConfig: MediasoupTypes.ProducerOptions,
  userId: string
) {
  try {
    const producer = await mediasoupHandler.createProducer(
      state.getTransport(producerTransportId),
      producerConfig,
      userId
    );
    await state.storeProducer(
      producer,
      userId,
      roomId,
      producerTransportId,
      producerConfig
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
  consumerConfig: MediasoupTypes.ConsumerOptions,
  room: FullRoomInfo
) {
  try {
    const consumer = await mediasoupHandler.createConsumer(
      room.router,
      state.getTransport(consumerTransportId),
      consumerConfig,
      userId,
      ws
    );
    await state.storeConsumer(
      consumer,
      userId,
      room.id,
      consumerTransportId,
      consumerConfig
    );
    return {
      contents: {
        info: "Consumer created",
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
        producerId: consumer.producerId,
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

async function closeProducer(producerId: string, userId: string) {
  const producer = state.getProducer(producerId);
  await state.removeProducer(producerId);
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
  const pauseProducer = state.getProducer(producerId);

  try {
    await mediasoupHandler.pauseSource(pauseProducer, userId, "producer");
    // TODO: see if we can update state. Not strictly necessary, because state is mostly important for restoration after server downtime.
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
  const producer = state.getProducer(producerId);

  try {
    await mediasoupHandler.resumeSource(producer, userId, "producer");
    // TODO: see if we can update state. Not strictly necessary, because state is mostly important for restoration after server downtime.

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
  const consumer = state.getConsumer(consumerId);

  try {
    await mediasoupHandler.resumeSource(consumer, userId, "consumer");
    // TODO: see if we can update state. Not strictly necessary, because state is mostly important for restoration after server downtime.

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
async function updateUser(userId: string, userInfo: Partial<UserInfo>) {
  try {
    await state.updateUser(userId, userInfo);
    return {
      contents: {
        info: "Peer updated successfully",
      },
      success: true,
    };
  } catch (e) {
    console.error(e);
    return {
      contents: {
        info: "Error updating peer.",
      },
      success: false,
    };
  }
}
async function getProducersForPeer(userId: string, roomId: string) {
  const peersInfo = await state.getProducingRoomPeers(roomId);
  const producers = peersInfo.map(
    ({ userId, verified, displayName, producerId }) => {
      const { appData } = state.getProducer(producerId!);
      return {
        userId,
        producerId,
        displayName,
        verified,
        ...appData,
      };
    }
  );
  return {
    contents: {
      info: "Producers retrieved",
      producers: producers.filter(
        ({ userId: peerUserId }) => userId !== peerUserId
      ),
    },
    success: true,
  };
}
async function emptyRoomResources(
  roomId: string,
  userId: string,
  peerData: PeerData
) {
  const room = await state.getRoom(roomId);
  // TODO: check if needed - do we already have a check for room non existent
  if (!room) return;
  if (room.peerKeys.length <= 1 && !room.sticky) {
    logs.debug("Room will be empty, closing room");
    mediasoupHandler.closeRouter(room.router);
  } else {
    logs.debug(
      "Room will not be empty, closing transports. This should also close producers and consumers."
    );
    [peerData.producerTransportId, peerData.consumerTransportId].forEach(
      (id) => {
        if (id) mediasoupHandler.closeTransport(state.getTransport(id), userId);
      }
    );
  }
}
async function disconnect(userId: string) {
  const userPresence = await state.getUserPresence(userId, true);
  if (Object.keys(userPresence).length === 0) {
    logs.info("User is in no rooms, closing connection");
  }
  try {
    for (const [roomId, presenceInfo] of Object.entries(userPresence)) {
      await emptyRoomResources(roomId, userId, presenceInfo);
      await state.removePeerByUserRoomIds(userId, roomId);
    }

    // update server state
    await state.removeUser(userId);
  } catch (e) {
    console.error(e);
  }
}
async function exitRoom(userId: string, roomId: string) {
  const presenceInfo = await state.getUserPresence(userId, true, [roomId]);

  // Get the room presence from the presenceInfo object
  const [roomPresence] = Object.values(presenceInfo);
  await emptyRoomResources(roomId, userId, roomPresence);

  // update server state
  await state.removePeerByUserRoomIds(userId, roomId);
  await publishCheckRequest(userId, "user");
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
      const accessToken = req.getQuery("accessToken")!;
      let upgradeAborted = false;
      let userInfo = {
        userId: req.getQuery("userId"),
        verified: false,
        displayName: "",
      };
      const secWebsocketKey = req.getHeader("sec-websocket-key");
      const secWebsocketProtocol = req.getHeader("sec-websocket-protocol");
      const secWebsocketExtensions = req.getHeader("sec-websocket-extensions");

      res.onAborted(() => (upgradeAborted = true));
      if (accessToken !== "") {
        logs.debug("Access token provided");
        try {
          const spotifyRes = await fetch("https://api.spotify.com/v1/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const profile = await spotifyRes.json();
          if (profile.id) {
            userInfo = {
              ...userInfo,
              userId: profile.id,
              verified: true,
              displayName: profile.display_name,
            };
            logs.info(`Access token verified, user info %O`, userInfo);
          } else {
            logs.debug(`Access token verification failed.`);
          }
        } catch (e) {
          logs.debug(`Access token verification failed: ${e}`);
        }
      }
      if (!upgradeAborted && !userInfo.userId) {
        const ipAddress = res.getRemoteAddressAsText();
        userInfo = { ...userInfo, userId: await generateHash(ipAddress) };
        logs.info(
          `No accessToken provided, or profile fetch failed. Generated new userId. User info: %O`,
          userInfo
        );
      }
      if (!upgradeAborted)
        res.cork(() =>
          res.upgrade(
            userInfo,
            secWebsocketKey,
            secWebsocketProtocol,
            secWebsocketExtensions,
            context
          )
        );
    },
    open: (ws: WebSocket<UserData>) => {
      const { userId, verified } = ws.getUserData();
      // ws.getUserData = () => {
      //   return { userId, verified };
      // };
      WebSocketActions.send(ws, {
        type: "userIdUpdate",
        contents: { userId, verified },
        success: true,
      } as UserIdUpdate);
    },
    message: async (ws, message, _isBinary) => {
      /* Ok is false if backpressure was built up, wait for drain */
      const messageInfo = bufferToJSON(message as ArrayBuffer);
      const { userId, verified, displayName } = ws.getUserData();

      switch (messageInfo.type) {
        case "joinRoom":
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "joinRoomUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          logs.info(
            "Received request to join existing room. User ID: %s, room ID: %s",
            messageInfo.roomId,
            userId
          );
          WebSocketActions.send(ws, {
            type: "joinRoomUpdate",
            ...(await joinExistingRoom(messageInfo.roomId, {
              userId,
              verified,
              displayName,
            })),
          });

          break;
        case "createRoom":
          if (await state.existsRoom(messageInfo.roomId)) {
            WebSocketActions.sendError(
              ws,
              "createRoomUpdate",
              "Cannot create room. Room ID already taken."
            );
            return;
          }

          logs.info(
            "Received request to create new room. User ID: %s, display name: %s, room ID: %s",
            userId,
            displayName,
            messageInfo.roomId
          );
          WebSocketActions.send(ws, {
            type: "createRoomUpdate",
            ...(await joinNewRoom(messageInfo.roomId, {
              userId,
              verified,
              displayName,
            })),
          });
          break;
        case "createWebRtcTransports":
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "createWebRtcTransportsUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "createWebRtcTransportsUpdate",
            ...(await createWebRtcTransports(
              (await state.getRoom(messageInfo.roomId))!,
              userId
            )),
          });
          break;
        case "connectTransport":
          if (!(await state.existsRoom(messageInfo.roomId))) {
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
          if (!(await state.existsRoom(messageInfo.roomId))) {
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
              messageInfo.roomId,
              {
                kind: messageInfo.kind,
                appData: messageInfo.appData,
                rtpParameters: messageInfo.rtpParameters,
              },
              userId
            )),
          });
          break;
        case "consume":
          if (!(await state.existsRoom(messageInfo.roomId))) {
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
              {
                producerId: messageInfo.producerId,
                rtpCapabilities: messageInfo.rtpCapabilities,
              },
              (await state.getRoom(messageInfo.roomId))!
            )),
          });
          break;
        case "producerClosed":
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "producerClosedUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          if (!state.existsProducer(messageInfo.producerId)) {
            WebSocketActions.sendError(
              ws,
              "producerClosedUpdate",
              WS_ERRORS.PRODUCER_NON_EXISTENT
            );
            return;
          }
          WebSocketActions.send(ws, {
            type: "producerClosedUpdate",
            ...(await closeProducer(messageInfo.producerId, userId)),
          });

          break;
        case "pauseProducer":
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "pauseProducerUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          if (!state.existsProducer(messageInfo.producerId)) {
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
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "resumeProducerUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          if (!state.existsProducer(messageInfo.producerId)) {
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
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "resumeConsumerUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }
          if (!state.existsConsumer(messageInfo.consumerId)) {
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
        case "updateDisplayName":
          ws.getUserData = () => {
            return { userId, verified, displayName: messageInfo.displayName };
          };
          WebSocketActions.send(ws, {
            type: "updateDisplayNameUpdate",
            ...(await updateUser(userId, {
              displayName: messageInfo.displayName,
            })),
          });
          logs.info(
            "Updated display name for user ID %s to %s",
            userId,
            messageInfo.displayName
          );

          break;
        case "getProducersForPeer":
          if (!(await state.existsRoom(messageInfo.roomId))) {
            WebSocketActions.sendError(
              ws,
              "getProducersUpdate",
              WS_ERRORS.ROOM_NON_EXISTENT
            );
            return;
          }

          WebSocketActions.send(ws, {
            type: "getProducersUpdate",
            ...(await getProducersForPeer(userId, messageInfo.roomId)),
          });
          break;
        case "getPeersCount":
          if (!(await state.existsRoom(messageInfo.roomId))) {
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
              peersCount: await state.getRoomSize(messageInfo.roomId),
            },
            success: true,
          } as GetPeersCountUpdate);
          break;
        case "disconnect":
          WebSocketActions.end(ws, 1010, "Disconnecting now. Goodbye!");
          break;
        // TODO: exitRoom even needed if each tab has its own websocket?
        // YES because disconnect removes user from all rooms by user ID
        // User ID, if unauthenticated, is stored in browser storage. Otherwise, it's the Spotify ID
        case "exitRoom":
          logs.warn("exitRoom not implemented yet");
          break;
        default:
          console.log("Unknown message type");
          break;
      }
    },
    drain: (ws) => {
      logs.info("WebSocket backpressure: " + ws.getBufferedAmount());
    },
    close: async (ws, code, message) => {
      logs.info(
        `WebSocket close requested with code ${code} and message ${btoa(
          String.fromCharCode(...new Uint8Array(message))
        )}.`
      );
      const { userId } = ws.getUserData();
      await disconnect(userId);
      await publishCheckRequest(userId, "user");
      logs.info(
        "User %s disconnected after emptying resources. Goodbye!",
        userId
      );
    },
    dropped: (ws) => {
      console.log("dropped");
      ws.ping();
    },
  })
  .get("/*", (res, _req) => {
    logs.info("HTTP REQUEST RECEIVED");
    res.end("Hello World!");
  })
  .listen(port, async (token) => {
    if (token) {
      logs.info("Listening to port " + port);
      try {
        await redis.connect();
        await createWorkers();
        const latestStreamIds = await getLatestStreamIds();
        await listenForSweep(latestStreamIds);
      } catch (e) {
        console.error("redis--->", e);
      }
    } else {
      logs.info("Failed to listen to port " + port);
    }
  });
