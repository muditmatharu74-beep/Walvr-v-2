import { Composition } from "remotion";
import { DarkLyrics } from "./DarkLyrics";

export const RemotionRoot = () => {
  return (
    <Composition
      id="DarkLyrics"
      component={DarkLyrics}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        captions: [],
        songDuration: 60,
        beats: [],
      }}
    />
  );
};
