"use client";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
import React, { useEffect, useRef } from "react";
import { WebSocket } from "partysocket";
import type {
  UpdateSignalTypes,
  UpdateSignal,
} from "@/app/spaces/message-types";
import { useSocketStore } from "@/app/spaces/components/SocketStoreProvider";
import RoomManager from "@/app/spaces/components/RoomManager";
import TransportsManager from "@/app/spaces/components/TransportsManager";
import ProducerManager from "@/app/spaces/components/ProducerManager";
import PeerManager from "@/app/spaces/components/PeerManager";

export type MessageHandlers = Record<
  UpdateSignalTypes,
  (message: UpdateSignal) => void | Promise<void>
>;

export default function WebSocketManager({
  accessToken,
}: {
  accessToken?: string;
}) {
  const { device, user, activeRoom } = useParticipantStore((state) => state);
  const { socket, setWebsocket, handlers } = useSocketStore((state) => state);
  const wss = useRef<null | WebSocket>(null);

  useEffect(() => {
    if (!wss.current && device && user) {
      wss.current = new WebSocket(
        `wss://localhost:3001/?accessToken=${accessToken}&userId=${user?.userId}`,
        [],
        {
          startClosed: true,
        }
      );

      wss.current.onopen = (e) => {
        console.log("client connected", e);
      };
      wss.current.onclose = (e) => {
        console.log("closed");
        console.log(e);
      };
      wss.current.onerror = (e) => {
        console.log(e);
        console.log("error");
      };

      setWebsocket(wss.current!);
    }
  }, [accessToken, activeRoom.id, user?.userId, device, user, setWebsocket]);

  useEffect(() => {
    if (socket != null && Object.keys(handlers).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars

      console.log("Handlers changed.", handlers);
      socket.onmessage = (e) => {
        const message: UpdateSignal = JSON.parse(e.data);
        const handler = handlers[message.type];
        if (handler) {
          Promise.resolve(handler(message));
        } else {
          console.log("Unknown message type", message.type, message);
        }
      };
    }
  }, [activeRoom.id, socket, handlers]);

  return (
    <>
      <RoomManager />
      <TransportsManager />
      <ProducerManager />
      <PeerManager />
    </>
  );
}
