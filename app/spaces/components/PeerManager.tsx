"use client";
import { generateSlug } from "random-word-slugs";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
import { toaster } from "@/app/components/ui/toaster";
import React, { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import type {
  UpdateSignalTypes,
  UpdateSignal,
  UserIdUpdate,
} from "@/app/spaces/message-types";
import { useSocketStore } from "@/app/spaces/components/SocketStoreProvider";

export type PeerMessageHandlers = Partial<
  Record<UpdateSignalTypes, (message: UpdateSignal) => void | Promise<void>>
>;

export default function PeerManager() {
  const { updateUserInfo, device, activeRoom } = useParticipantStore(
    (state) => state
  );
  const { updateHandlers, sendRequest } = useSocketStore((state) => state);
  const { data: session } = useSession();
  const peerMessageHandlers: PeerMessageHandlers = useMemo(
    () => ({
      userIdUpdate: (message) => {
        const { success, contents } = message as UserIdUpdate;
        if (!success) {
          toaster.error({
            title: "Error getting user ID",
            description:
              "The server wasn't able to get your user ID set up. Check the server logs for more information.",
          });
          return;
        }
        if (!!session?.user)
          updateUserInfo({
            userId: session.user.id!,
            verified: true,
            displayName: session.user.name!,
          });
        else {
          const displayName = generateSlug(2, { format: "title" });
          updateUserInfo({
            userId: contents.userId as string,
            verified: false,
            displayName,
          });
          console.log(contents.userId, displayName);

          // Not de-duping this request because there are no side effects
          // TODO: consider de-duping at sendRequest level
          sendRequest(
            "updateDisplayName",
            { displayName },
            `${contents.userId}:${displayName}`
          );
        }
      },
    }),
    [session?.user, updateUserInfo]
  );
  useEffect(() => {
    if (device) updateHandlers(peerMessageHandlers);
  }, [activeRoom.id, device, peerMessageHandlers, updateHandlers]);
  return <></>;
}
