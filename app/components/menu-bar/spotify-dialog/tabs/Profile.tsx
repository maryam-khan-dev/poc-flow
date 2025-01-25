"use client";

import useSWR from "swr";
import { Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { LuDot, LuMapPin } from "react-icons/lu";
import { Tag } from "@/app/components/ui/tag";
import { fetcher } from "@/app/lib/fetcher";
import TabContentContainer from "../common/TabContentContainer";
import { Avatar } from "@/app/components/ui/avatar";
import LoadingCircle from "@/app/components/ui/loading-circle";

export default function Profile({
  children: logoutButton,
}: {
  children: React.ReactNode;
}) {
  const { data: profile, error } = useSWR<
    SpotifyApi.CurrentUsersProfileResponse,
    Error
  >(`/api/spotify-profile`, fetcher);

  function renderItems() {
    if (error)
      return (
        <Heading as="h2" fontSize="2xl">
          Failed to load.
        </Heading>
      );
    if (!profile) return <LoadingCircle />;
    const { email, display_name, followers, country, images } = profile;
    console.log(email);
    return (
      <VStack p={5} gap={8}>
        <HStack gap={5}>
          <Avatar
            name={display_name}
            shape="rounded"
            bg={"bg.focusRing"}
            color="fg"
            src={images?.[0]?.url}
            size="2xl"
          />
          <VStack alignItems="start">
            <Heading as="h1" fontSize="3xl">
              {display_name}
            </Heading>
            <Tag color="fg" bg="accent.focusRing" startElement={<LuMapPin />}>
              {country}{" "}
            </Tag>
          </VStack>
        </HStack>
        <HStack gap={3}>
          <Text fontSize="sm" fontWeight="medium" fontStyle="italic">
            {email}
          </Text>
          <LuDot />
          <Text fontSize="sm" fontWeight="medium">
            {followers?.total} followers
          </Text>
        </HStack>
        {logoutButton}
      </VStack>
    );
  }
  return <TabContentContainer>{renderItems()}</TabContentContainer>;
}
