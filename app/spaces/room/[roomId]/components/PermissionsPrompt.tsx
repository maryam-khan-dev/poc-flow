"use client";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { IconButton } from "@chakra-ui/react/button";
import { Text, VStack } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { useEffect, useState } from "react";
import React from "react";
import Link from "next/link";
import {
  getUserMedia,
  hasGrantedPermissions,
} from "@/app/spaces/actions/device-handlers";
import { Animation } from "@/app/components/Animation";
import { useParticipantStore } from "@/app/spaces/components/ParticipantStoreProvider";
function PromptContent({
  error,
  stream,
}: {
  error: string | null;
  stream: MediaStream | null;
}) {
  if (!error && !stream) {
    return (
      <>
        <Text fontSize="xl" fontWeight="bold" lineHeight={"moderate"}>
          Can we use your camera and mic? (Please?)
        </Text>
        <Text width="90%">
          We&apos;ll need to access your camera and mic so your study buddies
          can see and hear you. Don&apos;t worry, you&apos;ll be able to turn
          either off or on at any time.
        </Text>
      </>
    );
  }
  if (error) {
    return (
      <>
        <Text fontSize="xl" fontWeight="bold" lineHeight={"moderate"}>
          Can we use your camera and mic? (Please?)
        </Text>
        <Text width="90%">
          We&apos;ll need to access your camera and mic so your study buddies
          can see and hear you. Don&apos;t worry, you&apos;ll be able to turn
          either off or on at any time.
        </Text>
      </>
    );
  }
  if (stream) {
    return (
      <>
        <Text fontSize="xl" fontWeight="bold" lineHeight={"moderate"}>
          Thank you for joining us!
        </Text>
        <Text width="90%">
          We&apos;ll be redirecting you to the room in a few seconds. Happy
          studying!
        </Text>
      </>
    );
  }
}

export default function PermissionsPrompt() {
  const [permissionsGranted, setPermissionsGranted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { updateRoomInfo, activeRoom } = useParticipantStore((state) => state);
  useEffect(() => {
    if (!activeRoom.stream)
      hasGrantedPermissions().then((granted) => {
        setPermissionsGranted(granted);
        getUserMedia().then(({ ok, stream, error }) => {
          console.log("stream", stream);
          if (ok) {
            updateRoomInfo({ stream });
            setPermissionsGranted(true);
          } else if (error) {
            setError(error);
          }
        });
      });
  }, [updateRoomInfo, activeRoom.stream]);
  return (
    <>
      <DialogRoot placement="center" size="xl" open={!permissionsGranted}>
        {/* <DialogTrigger asChild>
            <Link href="/spaces/join">Join a Space</Link>
          </DialogTrigger> */}
        <DialogContent
          minHeight="60%"
          lgDown={{ minHeight: "100%", minWidth: "100%" }}
          bg="accent.muted"
          color="fg"
          p={2}
        >
          <DialogHeader
            display="flex"
            alignItems="center"
            justifyContent={"space-between"}
          >
            <DialogTitle>
              <Text fontSize="3xl">Let&apos;s get you joined in!</Text>
            </DialogTitle>
            <DialogCloseTrigger>
              <Link href="/">
                <IconButton
                  aria-label="Leave"
                  size="xs"
                  rounded="md"
                  variant="subtle"
                  colorPalette={"accent"}
                  asChild
                >
                  <LuX strokeWidth={4} />
                </IconButton>
              </Link>
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody display="flex" px={6} pb={4}>
            <Animation
              source={
                "https://lottie.host/1880e9fc-abb1-425e-bf12-0026e4e65871/bE8ir3mqdy.lottie"
              }
            />
            <VStack
              width="50%"
              lgDown={{ width: "100%" }}
              display="flex"
              alignItems={"center"}
              justifyContent={"center"}
              flexDirection={"column"}
              gap={4}
              textAlign={"center"}
            >
              <PromptContent error={error} stream={activeRoom.stream} />
            </VStack>
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
