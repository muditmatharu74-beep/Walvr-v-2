import { Composition } from "remotion";
import { DarkLyrics } from "./DarkLyrics";
import { durationInFrames, VIDEO_FPS } from "../lib/rendering/timing";

export const RemotionRoot = () => {
  return (
    <Composition
      id="DarkLyrics"
      component={DarkLyrics}
      durationInFrames={1800}
      fps={VIDEO_FPS}
      width={1080}
      height={1920}
      calculateMetadata={({ props }) => ({ durationInFrames: durationInFrames(props.songDuration) })}
      defaultProps={{
        captions: [],
        songDuration: 60,
        beats: [],
      }}
    />
  );
};
