import { Composition } from "remotion";
import { DarkLyrics } from "./DarkLyrics";
import { getDurationInFrames, getRenderSize } from "../lib/render-settings";

export const RemotionRoot = () => {
  return (
    <Composition
      id="DarkLyrics"
      component={DarkLyrics}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
      calculateMetadata={({ props }) => ({
        durationInFrames: getDurationInFrames(props.songDuration),
        ...getRenderSize(props.plan ?? "free"),
      })}
      defaultProps={{
        captions: [],
        songDuration: 60,
        beats: [],
        plan: "free",
        captionStyle: "bold-overlay",
      }}
    />
  );
};
