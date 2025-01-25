"use client";
import { loadDevice } from "@/app/spaces/actions/device-handlers";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
import { toaster } from "@/app/components/ui/toaster";
import { useCallback, useEffect, useMemo } from "react";
import type {
  EnterRoomUpdate,
  UpdateSignalTypes,
  UpdateSignal,
  ProducersUpdate,
} from "@/app/spaces/message-types";
import { useSocketStore } from "@/app/spaces/components/SocketStoreProvider";
import { REQUEST_STATUS } from "@/app/store/socket-store";

export type RoomMessageHandlers = Partial<
  Record<UpdateSignalTypes, (message: UpdateSignal) => void | Promise<void>>
>;

export default function RoomManager() {
  const { device, user, updateRoomInfo } = useParticipantStore(
    (state) => state
  );
  const { sendRequest, getRequest, updateRequestState, updateHandlers } =
    useSocketStore((state) => state);
  const enterRoom = useCallback(
    async (contents: EnterRoomUpdate["contents"]) => {
      if (!device) {
        toaster.error({
          title: "Error entering room",
          description:
            "Device has not been created by your browser yet. Please try again.",
        });
        return;
      }
      if (!device.loaded) {
        const loaded = await loadDevice(device, contents.routerRtpCapabilities);
        if (loaded) {
          sendRequest(
            "createWebRtcTransports",
            {
              routerRtpCapabilities: device.rtpCapabilities,
              roomId: contents.roomId,
            },
            `${user?.userId}:${contents.roomId}`
          );
        } else {
          console.log(
            "Device not loaded, so createWebRtcTransports event not sent to server"
          );
        }
      }
      updateRoomInfo({ id: contents.roomId });
    },
    [device, sendRequest, updateRoomInfo, user?.userId]
  );
  const messageHandlers: RoomMessageHandlers = useMemo(
    () => ({
      joinRoomUpdate: async (message) => {
        const { success, contents: roomDetails } = message as EnterRoomUpdate;
        const { roomId } = roomDetails;
        console.log(roomDetails);

        if (!success) {
          toaster.error({
            title: "Error joining room",
            description: "Check the server logs for more information.",
          });
          updateRequestState("joinRoom", roomId, {
            status: REQUEST_STATUS.FAILURE,
            info: roomDetails.info,
          });
          return;
        }
        updateRequestState("joinRoom", roomId, {
          status: REQUEST_STATUS.SUCCESS,
          info: roomDetails.info,
        });
        await enterRoom(roomDetails);
        sendRequest("getProducers", { roomId }, `${user?.userId}:${roomId}`);
      },
      createRoomUpdate: async (message) => {
        const { success, contents: roomDetails } = message as EnterRoomUpdate;
        if (!success) {
          toaster.error({
            title: "Error creating room",
            description: "Check the server logs for more information.",
          });
          updateRequestState("createRoom", roomDetails.roomId, {
            status: REQUEST_STATUS.FAILURE,
            info: roomDetails.info,
          });
          return;
        }
        updateRequestState("createRoom", roomDetails.roomId, {
          status: REQUEST_STATUS.SUCCESS,
          info: roomDetails.info,
        });
        await enterRoom(roomDetails);
      },
      producersUpdate: async (message) => {
        const { success, contents } = message as ProducersUpdate;
        if (!success) {
          toaster.error({
            title: "Error getting producers",
            description: "Check the server logs for more information.",
          });
          // Only update request state if a request was made - as this message can be sent multiple times
          if (
            getRequest("getProducers", `${user?.userId}:${contents.roomId}`)
          ) {
            updateRequestState(
              "getProducers",
              `${user?.userId}:${contents.roomId}`,
              {
                status: REQUEST_STATUS.FAILURE,
                info: contents.info,
              }
            );
          }
          return;
        }
        // Only update request state if a request was made - as this message can be sent multiple times
        if (getRequest("getProducers", `${user?.userId}:${contents.roomId}`)) {
          updateRequestState(
            "getProducers",
            `${user?.userId}:${contents.roomId}`,
            {
              status: REQUEST_STATUS.SUCCESS,
              info: contents.info,
            }
          );
        }
        console.log(contents.producers);
        updateRoomInfo({ peers: contents.producers });
      },
    }),
    [
      enterRoom,
      getRequest,
      sendRequest,
      updateRequestState,
      updateRoomInfo,
      user?.userId,
    ]
  );
  useEffect(() => {
    if (device && user) updateHandlers(messageHandlers);
  }, [device, messageHandlers, updateHandlers, user]);
  return <></>;
}
