interface BaseRequestSignal {
  type: string;
}
interface CreateRoomRequest extends BaseRequestSignal {
  type: "createRoom";
  roomId: string;
}
interface JoinRoomRequest extends BaseRequestSignal {
  type: "joinRoom";
  roomId: string;
}
interface CreateWebRtcTransportsRequest extends BaseRequestSignal {
  type: "createWebRtcTransports";
  roomId: string;
  rtpCapabilities: MediasoupClientTypes.RtpCapabilities;
}
interface ConnectTransportRequest extends BaseRequestSignal {
  type: "connectTransport";
  transportId: string;
  dtlsParameters: MediasoupClientTypes.DtlsParameters;
  roomId: string;
}
interface ProduceRequest extends BaseRequestSignal {
  type: "produce";
  producerTransportId: string;
  roomId: string;
  kind: string;
  appData: Record<string, unknown>;
  rtpParameters: MediasoupClientTypes.RtpParameters;
}
interface ConsumeRequest extends BaseRequestSignal {
  type: "consume";
  consumerTransportId: string;
  roomId: string;
  producerId: string;
  rtpCapabilities: MediasoupClientTypes.RtpCapabilities;
}
interface ResumeConsumerRequest extends BaseRequestSignal {
  type: "resumeConsumer";
  consumerId: string;
}
interface UpdateDisplayNameRequest extends BaseRequestSignal {
  type: "updateDisplayName";
  displayName: string;
}

interface GetProducersRequest extends BaseRequestSignal {
  type: "getProducers";
  roomId: string;
}
export type RequestSignal =
  | CreateRoomRequest
  | JoinRoomRequest
  | CreateWebRtcTransportsRequest
  | ConnectTransportRequest
  | ProduceRequest
  | UpdateDisplayNameRequest
  | GetProducersRequest
  | ConsumeRequest
  | ResumeConsumerRequest;
export type RequestSignalTypes = Pick<RequestSignal, "type">["type"];
interface BaseUpdateSignal {
  type: string;
  contents: Record<string, unknown>;
  success: boolean;
}
interface UserIdUpdate extends BaseUpdateSignal {
  type: "userIdUpdate";
  contents: {
    userId: string;
    info: string;
  };
}
interface EnterRoomUpdate extends BaseUpdateSignal {
  type: "joinRoomUpdate" | "createRoomUpdate";
  contents: {
    routerRtpCapabilities: MediasoupClientTypes.RtpCapabilities;
    roomId: string;
    info: string;
  };
}
interface WebRtcTransportsUpdate extends BaseUpdateSignal {
  type: "createWebRtcTransportsUpdate";
  contents: {
    producerTransportOptions: MediasoupClientTypes.TransportOptions;
    consumerTransportOptions: MediasoupClientTypes.TransportOptions;
    roomId: string;
    info: string;
  };
}
interface ProduceUpdate extends BaseUpdateSignal {
  type: "produceUpdate";
  contents: {
    producerId: string;
    producerTransportId: string;
    info: string;
    deviceLabel: string;
    kind: string;
    // TODO: sync with appData
  };
}
interface ConsumeUpdate extends BaseUpdateSignal {
  type: "consumeUpdate";
  contents: {
    info: string;
    id: string;
    kind: "audio" | "video";
    rtpParameters: MediasoupClientTypes.RtpParameters;
    type: string;
    producer: MediasoupTypes.Producer;
    consumerTransportId: string;
  };
}
interface ProducerClosedUpdate extends BaseUpdateSignal {
  type: "producerClosedUpdate";
  contents: {
    producerId: string;
    info: string;
  };
}
interface ConnectTransportUpdate extends BaseUpdateSignal {
  type: "connectTransportUpdate";
  contents: {
    transportId: string;
    info: string;
  };
}
interface PeerProducerInfo {
  displayName: string;
  verified: boolean;
  producers: {
    [kind: "audio" | "video"]: string;
  };
}
interface ProducersUpdate extends BaseUpdateSignal {
  type: "producersUpdate";
  contents: {
    info: string;
    roomId: string;
    producers: Record<string, PeerProducerInfo>;
  };
  success: boolean;
}
export type UpdateSignal =
  | UserIdUpdate
  | EnterRoomUpdate
  | WebRtcTransportsUpdate
  | ProduceUpdate
  | ProducerClosedUpdate
  | ConnectTransportUpdate
  | ProducersUpdate
  | ConsumeUpdate;
export type UpdateSignalTypes = Pick<UpdateSignal, "type">["type"];
