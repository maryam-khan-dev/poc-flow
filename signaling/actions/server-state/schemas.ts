import { Entity, Schema } from "redis-om";
interface RoomSchema extends Entity {
  routerId: string;
  sticky: boolean;
}
interface PeerSchema extends Entity {
  userId: string;
  displayName: string;
  verified: boolean;
  roomId: string;
  producerTransportId: string;
  consumerTransportId: string;
  producerId: string;
  consumerId: string;
}
interface RouterSchema extends Entity {
  config: string;
}
interface TransportSchema extends Entity {
  peerKey: string;
  roomId: string;
  type: string;
  config: string;
  // dtlsParameters?
}
interface ProducerSchema extends Entity {
  peerKey: string;
  roomId: string;
  transportId: string;
  config: string;
}
interface ConsumerSchema extends Entity {
  peerKey: string;
  roomId: string;
  transportId: string;
  config: string;
  // also has onClose event where it tells WS to send close event to client
}
export const peerSchema = new Schema<PeerSchema>(
  "peer",
  {
    userId: { type: "string" },
    displayName: { type: "string" },
    verified: { type: "boolean" },
    roomId: { type: "string" },
    producerTransportId: { type: "string" },
    consumerTransportId: { type: "string" },
    producerId: { type: "string" },
    consumerId: { type: "string" },
  },
  {
    dataStructure: "HASH",
  }
);
export const roomSchema = new Schema<RoomSchema>(
  "room",
  {
    routerId: { type: "string" },
    sticky: { type: "boolean" },
  },
  { dataStructure: "HASH" }
);

export const routerSchema = new Schema<RouterSchema>(
  "router",
  {
    config: { type: "string" },
  },
  { dataStructure: "HASH" }
);
export const transportSchema = new Schema<TransportSchema>(
  "transport",
  {
    peerKey: { type: "string" },
    roomId: { type: "string" },
    type: { type: "string" },
    config: { type: "string" },
    // dtlsParameters?
  },
  { dataStructure: "HASH" }
);
export const producerSchema = new Schema<ProducerSchema>(
  "producer",
  {
    peerKey: { type: "string" },
    roomId: { type: "string" },
    transportId: { type: "string" },
    config: { type: "string" },
  },
  { dataStructure: "HASH" }
);
export const consumerSchema = new Schema<ConsumerSchema>(
  "consumer",
  {
    peerKey: { type: "string" },
    roomId: { type: "string" },
    transportId: { type: "string" },
    config: { type: "string" },
    // also has onClose event where it tells WS to send close event to client
  },
  { dataStructure: "HASH" }
);
