"use client";
import {
  createSendTransport,
  ConnectionEventHandlers,
  createRecvTransport,
} from "@/app/spaces/actions/device-handlers";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
import { toaster } from "@/app/components/ui/toaster";
import type { Callback, Errback } from "@/app/store/participant-store";
import { types as MediasoupClientTypes } from "mediasoup-client";
import { MediasoupTypes as MediasoupServerTypes } from "@/signaling/lib/mediasoup";
import React, { useEffect, useMemo } from "react";
import type {
  ConnectTransportUpdate,
  UpdateSignalTypes,
  UpdateSignal,
  WebRtcTransportsUpdate,
} from "@/app/spaces/message-types";
import { Except } from "type-fest";
import { useSocketStore } from "@/app/spaces/components/SocketStoreProvider";
import { REQUEST_STATUS } from "@/app/store/socket-store";
export type TransportHandlers = {
  connect: (
    transportId: string,
    dtlsParameters: MediasoupClientTypes.DtlsParameters
  ) => void;
  produce: (
    transportId: string,
    producerOptions: MediasoupServerTypes.ProducerOptions,
    callback: ({ id }: { id: string }) => void,
    errback: Errback
  ) => void;
  connectionstatechange: (
    state: MediasoupClientTypes.ConnectionState,
    producerTransport: MediasoupClientTypes.Transport
  ) => void;
};
export type TransportsMessageHandlers = Partial<
  Record<UpdateSignalTypes, (message: UpdateSignal) => void>
>;

export default function TransportsManager() {
  const {
    device,
    user,
    activeRoom,
    addTransportCallback,
    addTransportErrback,
    updateRoomInfo,
  } = useParticipantStore((state) => state);
  const { getRequest, sendRequest, updateRequestState, updateHandlers } =
    useSocketStore((state) => state);
  const stateChangeHandlers: ConnectionEventHandlers = useMemo(
    () => ({
      producerTransport: {
        disconnected: (transport: MediasoupClientTypes.Transport) => {
          console.log("Producer Transport disconnected", {
            id: transport.id,
          });

          // restartIce();

          // toast(
          //   "warning",
          //   "Producer Transport lost",
          //   "Network connection may have dropped or changed (Restarted ICE)",
          //   "top-end",
          //   6000,
          //   true
          // );

          // break;
        },
        failed: (transport: MediasoupClientTypes.Transport) => {
          console.warn("Producer Transport failed", { id: transport.id });
          // toast w/action
          // popupHtmlMessage(
          //   null,
          //   image.network,
          //   "Producer Transport failed",
          //   "Check Your Network Configuration",
          //   "center",
          //   false,
          //   true
          // );

          // break;
        },
      },
      consumerTransport: {
        disconnected: (transport: MediasoupClientTypes.Transport) => {
          console.log("Consumer Transport disconnected", {
            id: transport.id,
          });

          // restartIce();

          // toast(
          //   "warning",
          //   "Producer Transport lost",
          //   "Network connection may have dropped or changed (Restarted ICE)",
          //   "top-end",
          //   6000,
          //   true
          // );

          // break;
        },
        failed: (transport: MediasoupClientTypes.Transport) => {
          console.warn("Consumer Transport failed", { id: transport.id });
          // toast w/action
          // popupHtmlMessage(
          //   null,
          //   image.network,
          //   "Producer Transport failed",
          //   "Check Your Network Configuration",
          //   "center",
          //   false,
          //   true
          // );

          // break;
        },
      },
    }),
    []
  );
  const producerTransportHandlers: TransportHandlers = useMemo(
    () => ({
      connect: (
        transportId: string,
        dtlsParameters: MediasoupClientTypes.DtlsParameters
      ) => {
        if (!getRequest("connectTransport", transportId)) {
          sendRequest(
            "connectTransport",
            { transportId, dtlsParameters, roomId: activeRoom.id },
            transportId
          );
        }
      },
      produce: (transportId, producerOptions, callback, errback) => {
        const { kind, appData } = producerOptions;
        const { deviceLabel } = appData as {
          deviceLabel: string;
        };
        if (!deviceLabel)
          throw new Error("Producer options missing device label");
        if (!getRequest("produce", `${deviceLabel}:${kind}`)) {
          const { rtpParameters } = producerOptions;
          console.log(
            "AdditionalTransportHandlers: No existing matching request detected. Going to produce",
            {
              kind,
              appData,
              rtpParameters,
              id: activeRoom.id,
              callback,
              errback,
            }
          );
          try {
            sendRequest(
              "produce",
              {
                producerTransportId: transportId,
                roomId: activeRoom.id,
                kind,
                appData,
                rtpParameters,
              },
              `${deviceLabel}:${kind}`
            );
            addTransportCallback("produce", transportId, callback as Callback);
            addTransportErrback("produce", transportId, errback as Callback);
          } catch (err) {
            errback(err as unknown as Error);
          }
        } else {
          console.log(
            "Silently returning. There is already a request in order: ",
            `${deviceLabel}:${kind}`
          );
        }
      },
      connectionstatechange: (
        state: MediasoupClientTypes.ConnectionState,
        producerTransport: MediasoupClientTypes.Transport
      ) => {
        stateChangeHandlers.producerTransport[state]?.(producerTransport);
      },
    }),
    [
      getRequest,
      sendRequest,
      activeRoom.id,
      addTransportCallback,
      addTransportErrback,
      stateChangeHandlers.producerTransport,
    ]
  );
  const consumerTransportHandlers: Except<TransportHandlers, "produce"> =
    useMemo(
      () => ({
        connect: (
          transportId: string,
          dtlsParameters: MediasoupClientTypes.DtlsParameters
        ) => {
          if (!getRequest("connectTransport", transportId)) {
            sendRequest(
              "connectTransport",
              { transportId, dtlsParameters, roomId: activeRoom.id },
              transportId
            );
          }
        },
        connectionstatechange: (
          state: MediasoupClientTypes.ConnectionState,
          consumerTransport: MediasoupClientTypes.Transport
        ) => {
          stateChangeHandlers.consumerTransport[state]?.(consumerTransport);
        },
      }),
      [
        activeRoom.id,
        getRequest,
        sendRequest,
        stateChangeHandlers.consumerTransport,
      ]
    );
  const transportMessageHandlers: TransportsMessageHandlers = useMemo(
    () => ({
      createWebRtcTransportsUpdate: (message) => {
        const { success, contents } = message as WebRtcTransportsUpdate;
        if (!success || !device) {
          toaster.error({
            title: "Error creating WebRTC transports",
            description:
              "Device may not exist. Check the server logs for more information.",
          });
          updateRequestState(
            "createWebRtcTransports",
            `${user?.userId}:${contents.roomId}`,
            {
              status: REQUEST_STATUS.FAILURE,
              info: contents.info,
            }
          );
          return;
        }
        updateRequestState(
          "createWebRtcTransports",
          `${user?.userId}:${contents.roomId}`,
          {
            status: REQUEST_STATUS.SUCCESS,
            info: contents.info,
          }
        );
        const { producerTransportOptions, consumerTransportOptions } = contents;
        const producerTransport = createSendTransport(
          device,
          producerTransportOptions,
          producerTransportHandlers
        );
        const consumerTransport = createRecvTransport(
          device,
          consumerTransportOptions,
          consumerTransportHandlers
        );
        updateRoomInfo({ producerTransport, consumerTransport });
      },
      connectTransportUpdate: (message) => {
        const { success, contents } = message as ConnectTransportUpdate;
        const { transportId, info } = contents;
        if (!success) {
          toaster.error({
            title: "Error connecting transport",
            description: "Check the server logs for more information.",
          });
          updateRequestState("connectTransport", transportId, {
            status: REQUEST_STATUS.FAILURE,
            info,
          });

          return;
        }
        updateRequestState("connectTransport", transportId, {
          status: REQUEST_STATUS.SUCCESS,
          info,
        });
      },
    }),
    [
      consumerTransportHandlers,
      device,
      producerTransportHandlers,
      updateRequestState,
      updateRoomInfo,
      user?.userId,
    ]
  );
  useEffect(() => {
    if (device && user && activeRoom.id)
      updateHandlers(transportMessageHandlers);
  }, [activeRoom.id, device, transportMessageHandlers, updateHandlers, user]);

  return <></>;
}
