import { PeerData, RoomData } from "../../ServerTypes";
import type { types as MediasoupTypes } from "mediasoup";
import autoBind from "auto-bind";
class ServerStateActions {
  /** Maps user ID to a user room record (map of room IDs and peer data) */
  usersMap: Record<string, Record<string, PeerData>> = {};
  roomsMap: Record<string, RoomData> = {};
  transportsMap: Record<string, MediasoupTypes.WebRtcTransport> = {};
  producersMap: Record<string, MediasoupTypes.Producer> = {};
  consumersMap: Record<string, MediasoupTypes.Consumer> = {};
  constructor() {
    this.usersMap = {};
    this.roomsMap = {};
    this.transportsMap = {};
    this.producersMap = {};
    this.consumersMap = {};
    autoBind(this);
  }

  /**
   * Check if room exists
   * @param roomId The room ID
   * @returns If the room exists
   */
  existsRoom(roomId: string) {
    return !!this.roomsMap[roomId];
  }

  /**
   * Check if user is in room
   * @param userId The user ID of the user
   * @param roomId The room ID
   * @returns If the user is in the room
   */
  isUserInRoom(userId: string, roomId: string) {
    return (
      this.existsRoom(roomId) &&
      !!this.usersMap[userId] &&
      !!this.usersMap[userId][roomId]
    );
  }

  /**
   * Removes a room from server state
   * @param roomId The room ID
   */
  removeRoom(roomId: string) {
    const { [roomId]: _roomToRemove, ...others } = this.roomsMap;
    this.roomsMap = { ...others };
  }

  /**
   * Get info on room(s) the user is in
   * @param userId The user ID of the user
   * @returns the user's rooms
   */
  getUserPresence(userId: string) {
    return this.usersMap[userId] ?? {};
  }

  /**
   * Removes a user from server state
   * @param userId The user ID
   */
  removeUser(userId: string) {
    const { [userId]: _userToRemove, ...others } = this.usersMap;
    this.usersMap = { ...others };
  }
  /**
   * Store the user in server storage
   * @param userId The user ID of the user
   * @param roomId The room ID of the room they want to join
   */
  storeUser(userId: string, roomId: string) {
    const peerData = {
      transportIds: {
        producer: null,
        consumer: null,
      },
      producerId: null,
      consumerId: null,
    };
    this.usersMap[userId] = {
      ...this.usersMap[userId],
      ...{ [roomId]: peerData },
    };
    this.roomsMap[roomId].peers[userId] = peerData;
  }

  /**
   * Removes user's peer data from server state
   * @param userId - The user ID whose peer data to delete
   * @param userPeerData - The peer data of the user (such as transport IDs, producer ID, and consumer ID)
   */
  removeUserPeerData(userId: string, userPeerData: PeerData) {
    const { transportIds, producerId, consumerId } = userPeerData;
    Object.keys(transportIds).forEach((type) => {
      const transportId = transportIds[type as "producer" | "consumer"];
      if (!!transportId) {
        this.removeTransport(transportId);
      }
    });
    if (!!producerId) {
      this.removeProducer(producerId);
    }
    if (!!consumerId) {
      this.removeConsumer(consumerId);
    }
  }

  /**
   * Removes a user from a room in server state
   * @param userId - The user ID of the user
   * @param roomId - The room ID of the room
   * @param userPeerData - The peer data of the user (such as transport IDs, producer ID, and consumer ID)
   */
  removeUserFromRoom(userId: string, roomId: string, userPeerData: PeerData) {
    const { [roomId]: roomRecord } = this.roomsMap;
    this.removeUserPeerData(userId, userPeerData);
    if (roomRecord) {
      const { [userId]: _user, ...otherPeers } = roomRecord.peers;
      if (!roomRecord.sticky) {
        if (Object.keys(otherPeers).length === 0) {
          this.removeRoom(roomId);
        }
      }
      // if there still is a room after removing empty non-sticky rooms, update peers
      if (this.roomsMap[roomId]) this.roomsMap[roomId].peers = otherPeers;
    }
    const userPresence = this.getUserPresence(userId);
    if (Object.keys(userPresence).length === 0) {
      this.removeUser(userId);
    }
  }

  /**
   * Removes a user from all rooms in server state
   * @param userId The user ID of the user
   */
  removeUserFromAllRooms(userId: string) {
    const userRoomRecord = this.getUserPresence(userId);
    for (const [roomId, userPeerData] of Object.entries(userRoomRecord)) {
      this.removeUserFromRoom(userId, roomId, userPeerData);
    }
  }

  /**
   * Get info on a room
   * @param roomId The room ID of the room
   * @returns the room information
   */
  getRoom(roomId: string) {
    return this.roomsMap[roomId];
  }

  /**
   * Gets room size
   * @param roomId The room ID of the room
   * @returns The number of people in this room
   */
  getRoomSize(roomId: string) {
    console.log(this.roomsMap[roomId]);
    return !!this.roomsMap[roomId]?.peers
      ? Object.keys(this.roomsMap[roomId].peers).length
      : 0;
  }

  /**
   * Gets room peers
   * @param roomId The room ID
   * @returns The list of room peers
   */
  getRoomPeers(roomId: string) {
    return this.roomsMap[roomId].peers;
  }

  /**
   * Stores the room in server state
   * @param roomId - The ID of the room
   * @param router - The router for this room
   */
  storeRoom(roomId: string, router: MediasoupTypes.Router) {
    if (!!this.roomsMap[roomId]) return;
    this.roomsMap[roomId] = {
      router,
      peers: {},
      sticky: false,
    };
  }
  /**
   * Stores the transport in server state
   * @param transport - The transport
   * @param userId - The user ID
   * @param roomId - The room ID
   * @param type - The type of transport ("producer" or "consumer")
   */
  storeTransport(
    transport: MediasoupTypes.WebRtcTransport,
    userId: string,
    roomId: string,
    type: "producer" | "consumer"
  ) {
    if (!!this.transportsMap[transport.id]) return;
    this.usersMap[userId][roomId] = {
      ...this.usersMap[userId][roomId],
      transportIds: {
        [type]: transport.id,
      } as Record<"producer" | "consumer", string>,
    };
    this.usersMap[userId][roomId]["transportIds"][type] = transport.id;
    this.roomsMap[roomId].peers[userId]["transportIds"][type] = transport.id;
    this.transportsMap[transport.id] = transport;
  }

  /**
   * Returns the transport from server state
   * @param transportId The transport ID
   * @returns The transport
   */
  getTransport(transportId: string) {
    return this.transportsMap[transportId];
  }

  /**
   * Remove transport ID from server state
   * @param transportId The transport ID
   */
  removeTransport(transportId: string) {
    const { [transportId]: _transportToRemove, ...others } = this.transportsMap;
    this.transportsMap = { ...others };
  }

  /**
   * Check if producer exists
   * @param producerId The producer ID
   * @returns If the producer exists
   */
  existsProducer(producerId: string) {
    return !!this.producersMap[producerId];
  }
  /**
   * Stores the producer in server state
   * @param producer - The producer
   * @param userId - The user ID
   * @param roomId - The room ID
   */
  storeProducer(
    producer: MediasoupTypes.Producer,
    userId: string,
    roomId: string
  ) {
    if (!!this.producersMap[producer.id]) return;
    this.usersMap[userId][roomId]["producerId"] = producer.id;
    this.roomsMap[roomId].peers[userId]["producerId"] = producer.id;
    this.producersMap[producer.id] = producer;
  }

  /**
   * Removes the producer from server state
   * @param producerId The producer ID
   * @param updateReferences Whether to update references to this producer
   * @param userId The user ID, if known
   * @param roomId The room ID, if known
   *
   */
  removeProducer(producerId: string) {
    const { [producerId]: _producerToRemove, ...others } = this.producersMap;
    this.producersMap = { ...others };
  }

  /**
   * Check if consumer exists
   * @param consumerId The consumer ID
   * @returns If the consumer exists
   */
  existsConsumer(consumerId: string) {
    return !!this.consumersMap[consumerId];
  }

  /**
   * Returns the producer from server state
   * @param producerId The producer ID
   * @returns The producer
   */
  getProducer(producerId: string) {
    return this.producersMap[producerId];
  }

  /**
   * Stores the consumer in server state
   * @param consumer - The consumer
   * @param userId - The user ID
   * @param roomId - The room ID
   */
  storeConsumer(
    consumer: MediasoupTypes.Consumer,
    userId: string,
    roomId: string
  ) {
    if (!!this.consumersMap[consumer.id]) return;
    this.usersMap[userId][roomId]["consumerId"] = consumer.id;
    this.roomsMap[roomId].peers[userId]["consumerId"] = consumer.id;
    this.consumersMap[consumer.id] = consumer;
  }

  /**
   * Returns the consumer from server state
   * @param consumerId The transport ID
   * @returns The transport
   */
  getConsumer(consumerId: string) {
    return this.consumersMap[consumerId];
  }

  /**
   * Removes the consumer from server state
   * @param consumerId The consumer ID
   */
  removeConsumer(consumerId: string) {
    const { [consumerId]: _consumerToRemove, ...others } = this.consumersMap;
    this.consumersMap = { ...others };
  }
}
export default class ServerState {
  private static serverState: ServerStateActions;
  constructor() {
    autoBind(this);
  }
  static getInstance() {
    this.serverState = this.serverState ?? new ServerStateActions();
    return this.serverState;
  }
}
