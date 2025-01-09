import { createStore } from "zustand/vanilla";
import { types as MediasoupClientTypes } from "mediasoup-client";
export type Callback = (...args: unknown[]) => void;
export type Errback = (error: Error) => void;
import { MessageHandlers } from "@/app/spaces/components/WebSocketManager";
type RoomData =
  | {
      id: string;
      muted: boolean;
      cameraOn: boolean;
      producerTransport: MediasoupClientTypes.Transport;
      consumerTransport: MediasoupClientTypes.Transport;
      producers: {
        video?: MediasoupClientTypes.Producer;
        audio?: MediasoupClientTypes.Producer;
      };
      consumers: {
        video: MediasoupClientTypes.Consumer;
        audio: MediasoupClientTypes.Consumer;
      };
      transportCallbacks: Record<string, Record<string, Callback>>;
      transportErrbacks: Record<string, Record<string, Errback>>;
      permissionsGranted: boolean;
      stream: MediaStream;
    }
  | {
      id: null;
      muted: null;
      cameraOn: null;
      producerTransport: null;
      consumerTransport: null;
      producers: {
        video?: null;
        audio?: null;
      };
      consumers: {
        video?: null;
        audio?: null;
      };
      transportCallbacks: Record<string, never>;
      transportErrbacks: Record<string, never>;
      permissionsGranted: null;
      stream: null;
    };
type UserInfo = {
  userId: string;
  displayName: string;
  verified: boolean;
};

export type ParticipantState = {
  user: UserInfo;
  device: MediasoupClientTypes.Device | null;
  activeRoom: RoomData;
};

export type ParticipantActions = {
  updateUserInfo: (newInfo: Partial<UserInfo>) => void;
  updateRoomInfo: (newInfo: Partial<RoomData>) => void;
  createDevice: (device: MediasoupClientTypes.Device) => void;
  joinRoom: (roomInfo: RoomData) => void;
  leaveRoom: (roomId: string) => void;
  addTransportCallback: (
    event: string,
    transportId: string,
    callback: Callback
  ) => void;
  addTransportErrback: (
    event: string,
    transportId: string,
    errback: Errback
  ) => void;
};

export type ParticipantStore = ParticipantState & ParticipantActions;
const defaultActiveRoom: RoomData = {
  id: null,
  muted: null,
  cameraOn: null,
  producerTransport: null,
  consumerTransport: null,
  producers: {
    video: null,
    audio: null,
  },
  consumers: {
    video: null,
    audio: null,
  },
  transportCallbacks: {},
  transportErrbacks: {},
  permissionsGranted: null,
  stream: null,
};
export const defaultInitState: ParticipantState = {
  device: null,
  user: {
    userId: "",
    displayName: "",
    verified: false,
  },
  activeRoom: defaultActiveRoom,
};

export const createParticipantStore = (
  initState: ParticipantState = defaultInitState
) => {
  return createStore<ParticipantStore>()((set) => ({
    ...initState,
    updateUserInfo: (newInfo: Partial<UserInfo>) =>
      set((state) => ({ ...state, user: { ...state.user, ...newInfo } })),
    updateRoomInfo: (newInfo: Partial<RoomData>) =>
      set((state) => {
        const activeRoom = { ...state.activeRoom, ...newInfo } as RoomData;
        return { ...state, activeRoom };
      }),
    createDevice: (device: MediasoupClientTypes.Device) =>
      set((state) => ({ ...state, device })),
    joinRoom: (roomInfo: RoomData) =>
      set((state) => ({ ...state, activeRoom: roomInfo })),
    leaveRoom: (_roomId: string) =>
      set((state) => {
        return { ...state, activeRoom: defaultActiveRoom };
      }),
    addTransportCallback: (
      event: string,
      transportId: string,
      callback: Callback
    ) =>
      set((state) => {
        const { activeRoom } = state;
        if (!activeRoom.id) return state;
        activeRoom.transportCallbacks![transportId] = {
          ...activeRoom.transportCallbacks![transportId],
          [event]: callback,
        };
        return {
          ...state,
          activeRoom,
        };
      }),
    addTransportErrback: (
      event: string,
      transportId: string,
      errback: Errback
    ) =>
      set((state) => {
        const { activeRoom } = state;
        if (!activeRoom.id) return state;
        activeRoom.transportErrbacks![transportId] = {
          ...activeRoom.transportErrbacks![transportId],
          [event]: errback,
        };
        return {
          ...state,
          activeRoom,
        };
      }),
    setMessageHandlers: (handlers: MessageHandlers) =>
      set((state) => ({ ...state, messageHandlers: handlers })),
  }));
};
