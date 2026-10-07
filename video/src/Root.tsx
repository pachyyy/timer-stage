import "./index.css";
import { Composition, Folder } from "remotion";
import { CreateRoom } from "./scenes/CreateRoom";
import { Overview } from "./scenes/Overview";
import { SignIn } from "./scenes/SignIn";

/**
 * One composition per docs section, in sidebar order. Each renders to its own looping GIF — see
 * README.md for the render commands.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="Docs">
      <Composition
        id="Overview"
        component={Overview}
        durationInFrames={315}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          roomCode: "K7M2QX",
          segmentName: "Opening remarks",
          segmentMinutes: 5,
        }}
      />
      <Composition
        id="SignIn"
        component={SignIn}
        durationInFrames={210}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{ locale: "en" as const, userName: "Alex Rivera" }}
      />
      <Composition
        id="CreateRoom"
        component={CreateRoom}
        durationInFrames={330}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          userName: "Alex Rivera",
          eventName: "Q3 All Hands",
          roomCode: "K7M2QX",
          segments: [
            { name: "Keynote", minutes: "20" },
            { name: "Q&A", minutes: "10" },
          ],
        }}
      />
    </Folder>
  );
};
