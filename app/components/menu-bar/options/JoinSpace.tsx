import { IconButton } from "@chakra-ui/react";
import { LuUsers } from "react-icons/lu";
import { Tooltip } from "@/app/components/ui/tooltip";
import Link from "next/link";
// TODO: Refactor so you're not repeating the same JSX for these options over and over
export default function JoinSpace() {
  return (
    <Tooltip
      content="Study with others"
      openDelay={0}
      positioning={{
        placement: "top",
        offset: { mainAxis: 2, crossAxis: 0 },
      }}
    >
      <Link href="/spaces">
        <IconButton
          aria-label="Join Study Space"
          colorPalette="accent"
          color="fg.contrast"
          variant="solid"
          size="sm"
          p={2}
          rounded="full"
        >
          <LuUsers />
        </IconButton>
      </Link>
    </Tooltip>
  );
}
