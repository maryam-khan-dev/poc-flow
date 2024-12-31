import type { types as MediasoupTypes } from "mediasoup";

interface PeerData {
  producerTransportId: string | null;
  consumerTransportId: string | null;
  producerId: string | null;
  consumerId: string | null;
}
interface PeerKeyData extends Record<string, string> {
  [roomId: string]: string;
}

interface FullRoomInfo {
  peerKeys: string[];
  router: MediasoupTypes.Router;
  id: string;
  sticky: boolean;
}
interface UserData {
  accessToken?: string;
  userId: string;
  // rooms: Record<
  //   string,
  //   PeerData
  //   // & {
  //   //   routerId: string;
  //   // }
  // >;
}
/**
 * @abstract
 * Base interface for all server-update messages sent from the server to the client.
 */
interface ServerUpdate {
  type: string;
  contents: { info?: string };
  success: boolean;
}

interface UserIdUpdate extends ServerUpdate {
  type: "userIdUpdate";
  contents: {
    info: string;
    userId: string;
  };
}

interface JoinRoomUpdate {
  type: "joinRoomUpdate";
  contents: {
    info: string;
    routerRtpCapabilities: MediasoupTypes.RtpCapabilities[];
  };
  success: boolean;
}

interface CreateWebRtcTransportsUpdate {
  type: "createWebRtcTransportsUpdate";
  contents: {
    info: string;
    producerTransport: ClientTransportParameters;
    consumerTransport: ClientTransportParameters;
  };
  success: boolean;
}
interface GetPeersCountUpdate {
  type: "getPeersCountUpdate";
  contents: {
    info: string;
    peersCount: number;
  };
  success: boolean;
}
type ClientTransportParameters = Pick<
  MediasoupTypes.WebRtcTransport,
  "id" | "iceParameters" | "iceCandidates" | "dtlsParameters"
>;
