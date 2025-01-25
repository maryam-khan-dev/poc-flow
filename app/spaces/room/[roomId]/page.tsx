"use client";
import { consume, produce } from "@/app/spaces/actions/device-handlers";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
import UserStream from "@/app/spaces/room/[roomId]/components/UserStream";
import PermissionsPrompt from "@/app/spaces/room/[roomId]/components/PermissionsPrompt";
import { Grid, VStack } from "@chakra-ui/react";
import { useEffect, useMemo, useRef } from "react";
import { createEventHandlers as createProducerEventHandlers } from "@/app/spaces/components/ProducerManager";
import { useSocketStore } from "@/app/spaces/components/SocketStoreProvider";

export default function RoomPage() {
  const sentProduce = useRef(false);
  const { device, activeRoom, updateRoomInfo, user } = useParticipantStore(
    (state) => state
  );
  const { sendRequest } = useSocketStore((state) => state);
  const producerHandlers = useMemo(
    () => createProducerEventHandlers(sendRequest, user),
    [sendRequest, user]
  );
  useEffect(() => {
    const produceMedia = async () => {
      sentProduce.current = true;
      const { ok, error, producers } = await produce(
        device!,
        activeRoom.producerTransport!,
        producerHandlers,
        activeRoom.stream!
      );
      if (!ok) {
        console.error("Error producing", error);
      } else if (activeRoom.stream) {
        updateRoomInfo({
          producers,
        });
      }
    };
    if (
      device &&
      activeRoom.producerTransport &&
      activeRoom.stream &&
      !sentProduce.current
    )
      produceMedia();
  }, [
    activeRoom.producerTransport,
    device,
    activeRoom.stream,
    updateRoomInfo,
    sendRequest,
    user,
    producerHandlers,
  ]);
  return (
    <div>
      <PermissionsPrompt />
      In construction
      <Me />
    </div>
  );
}
