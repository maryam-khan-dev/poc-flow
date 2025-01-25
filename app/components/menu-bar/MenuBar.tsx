"use server";
import JoinSpace from "./options/JoinSpace";
import Timer from "./options/Timer";
import Music from "./options/Music";
import { ColorModeButton } from "../ui/color-mode";
export default async function MenuBar() {
  return (
    <>
      <ColorModeButton rounded="full" />
      <JoinSpace />
      <Timer />
      <Music />
    </>
  );
}
