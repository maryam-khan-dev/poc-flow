"use client";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
import { toaster } from "@/app/components/ui/toaster";
import React, { useEffect, useMemo } from "react";
import type {
  UpdateSignalTypes,
  ProduceUpdate,
  ProducerClosedUpdate,
  UpdateSignal,
} from "@/app/spaces/message-types";
import { useSocketStore } from "@/app/spaces/components/SocketStoreProvider";
import { REQUEST_STATUS, SocketActions } from "@/app/store/socket-store";
import { UserInfo } from "@/signaling/ServerTypes";
export type ProducerEventHandlers = Record<
  string,
  (producerId: string) => void
>;
export type ProducerHandlerCreator = (
  sendRequest: SocketActions["sendRequest"],
  user: UserInfo
) => ProducerEventHandlers;

export const createEventHandlers: ProducerHandlerCreator = (
  _sendRequest: SocketActions["sendRequest"],
  _user: UserInfo
) => ({
  trackended: (producerId) => {
    console.log("Track ended", producerId);
    // USE SOCKET STORE
    // socket!.send(
    //   JSON.stringify({
    //     type: "producerClosed",
    //     producerId,
    //     userId: user?.userId,
    //   })
    // );
  },
  transportclose: (producerId) => {
    console.log("Transport closed", producerId);
    // socket!.send(
    //   JSON.stringify({
    //     type: "producerClosed",
    //     producerId,
    //     userId: user?.userId,
    //   })
    // );
  },
  close: (producerId) => {
    console.log("Producer closed", producerId);
    // socket!.send(
    //   JSON.stringify({
    //     type: "producerClosed",
    //     producerId,
    //     userId: user?.userId,
    //   })
    // );
  },
});

export type ProducerMessageHandlers = Partial<
  Record<UpdateSignalTypes, (message: UpdateSignal) => void | Promise<void>>
>;
export default function ProducerManager() {
  const { device, user, activeRoom, updateRoomInfo } = useParticipantStore(
    (state) => state
  );
  const { updateRequestState, updateHandlers } = useSocketStore(
    (state) => state
  );

  const producerMessageHandlers: ProducerMessageHandlers = useMemo(
    () => ({
      produceUpdate: (message) => {
        const { success, contents } = message as ProduceUpdate;

        const { producerId, producerTransportId, info, deviceLabel, kind } =
          contents;
        if (!success) {
          toaster.error({
            title: "Error creating producer",
            description: "Check the server logs for more information.",
          });
          updateRequestState("produce", `${deviceLabel}:${kind}`, {
            status: REQUEST_STATUS.FAILURE,
            info,
          });
          return;
        }
        updateRequestState("produce", `${deviceLabel}:${kind}`, {
          status: REQUEST_STATUS.SUCCESS,
          info,
        });
        const transportCallback =
          activeRoom.transportCallbacks![producerTransportId]["produce"];

        transportCallback({ id: producerId });
      },
      producerClosedUpdate: (message) => {
        const { success, contents } = message as ProducerClosedUpdate;
        if (!success) {
          toaster.error({
            title: "Error closing producer.",
            description: "Check the server logs for more information.",
          });
          // updateRequestState("closeProducer", producerId, {
          //   status: REQUEST_STATUS.FAILURE,
          //   info,
          // });
          return;
        }
        // updateRequestState("closeProducer", producerId, {
        //   status: REQUEST_STATUS.SUCCESS,
        //   info,
        // });
        if (activeRoom.producers.video?.id === contents.producerId) {
          const keys = Object.keys(activeRoom.producers) as Array<
            "video" | "audio"
          >;
          const [removed] = keys.filter(
            (k) => activeRoom.producers[k]?.id === contents.producerId
          );
          const { [removed]: _removedProducer, ...others } =
            activeRoom.producers;
          updateRoomInfo({ producers: { ...others } });
        }
      },
    }),
    [
      activeRoom.producers,
      activeRoom.transportCallbacks,
      updateRequestState,
      updateRoomInfo,
    ]
  );

  useEffect(() => {
    if (device && user && activeRoom.id)
      updateHandlers(producerMessageHandlers);
  }, [activeRoom.id, device, producerMessageHandlers, updateHandlers, user]);
  return <></>;
}
