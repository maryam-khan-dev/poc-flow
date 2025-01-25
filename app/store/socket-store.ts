import { createStore } from "zustand/vanilla";
export type Callback = (...args: unknown[]) => void;
export type Errback = (error: Error) => void;
import { WebSocket } from "partysocket";
import { RequestSignalTypes } from "@/app/spaces/message-types";
import { MessageHandlers } from "@/app/spaces/components/WebSocketManager";

type RequestStatus = 0 | 1 | 2;
export const REQUEST_STATUS = {
  PENDING: 0,
  SUCCESS: 1,
  FAILURE: 2,
} as Record<string, RequestStatus>;
export type RequestState = {
  status: RequestStatus;
  info: string;
};
export type RequestData = Record<
  RequestSignalTypes,
  Record<string, RequestState>
>;
export type SocketState = {
  socket: WebSocket | null;
  requests: RequestData | Record<string, never>;
  handlers: MessageHandlers | Record<string, never>;
};

export type SocketActions = {
  setWebsocket: (ws: WebSocket) => void;
  connect: () => void;
  getRequest: (
    requestType: RequestSignalTypes,
    requestId: string
  ) => RequestState;
  storeRequest: (requestType: RequestSignalTypes, requestId: string) => void;
  updateRequestState: (
    requestType: RequestSignalTypes,
    requestId: string,
    requestState: RequestState
  ) => void;
  sendRequest: (
    requestType: RequestSignalTypes,
    additionalData: Record<string, unknown>,
    identifier: string
  ) => void;
  updateHandlers: (handlers: Partial<MessageHandlers>) => void;
};

export type SocketStore = SocketState & SocketActions;
export const defaultInitState: SocketState = {
  socket: null,
  requests: {},
  handlers: {},
};

export const createSocketStore = (
  initState: SocketState = defaultInitState
) => {
  return createStore<SocketStore>()((set, get) => ({
    ...initState,
    setWebsocket: (ws: WebSocket) => set((state) => ({ ...state, socket: ws })),
    connect: () => {
      set((state) => {
        const { socket } = state;
        if (!socket) return state;
        socket.reconnect();
        return { ...state, socket };
      });
    },
    storeRequest: (requestType: RequestSignalTypes, requestId: string) =>
      set((state) => {
        const requests = get().requests;
        const defaultState: RequestState = {
          status: REQUEST_STATUS.PENDING as RequestStatus,
          info: "",
        };
        requests[requestType] = {
          ...requests[requestType],
          [requestId]: defaultState,
        };
        return { ...state, requests };
      }),
    getRequest: (requestType: RequestSignalTypes, requestId: string) => {
      const allRequests = get().requests;

      return allRequests[requestType]?.[requestId];
    },
    updateRequestState: (
      requestType: RequestSignalTypes,
      requestId: string,
      requestState: RequestState
    ) =>
      set((state) => {
        const { requests } = state;
        requests[requestType] = {
          ...requests[requestType],
          [requestId]: requestState,
        };
        return { ...state, requests };
      }),
    sendRequest: (
      requestType: RequestSignalTypes,
      additionalData: Record<string, unknown>,
      identifier: string
    ) => {
      const socket = get().socket;
      if (!socket) throw new Error("Socket not created");
      if (socket.readyState !== WebSocket.OPEN) socket.reconnect();
      socket.send(JSON.stringify({ type: requestType, ...additionalData }));
      get().storeRequest(requestType, identifier);
    },
    updateHandlers: (handlers: Partial<MessageHandlers>) =>
      set((state) => ({
        ...state,
        handlers: { ...state.handlers, ...handlers } as MessageHandlers,
      })),
  }));
};
