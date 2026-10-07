import "./index.css";
import { Composition, Folder } from "remotion";
import { BuildAgenda } from "./scenes/BuildAgenda";
import { CreateRoom } from "./scenes/CreateRoom";
import { History } from "./scenes/History";
import { JoinRoom } from "./scenes/JoinRoom";
import { Overview } from "./scenes/Overview";
import { Participants } from "./scenes/Participants";
import { RunTimer } from "./scenes/RunTimer";
import { ShareScreen } from "./scenes/ShareScreen";
import { SignIn } from "./scenes/SignIn";

/**
 * One composition per docs section, in the docs sidebar's order (src/lib/docs/sections.ts
 * in the app). Each renders to its own looping GIF — see README.md for the render commands.
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
      <Composition
        id="BuildAgenda"
        component={BuildAgenda}
        durationInFrames={300}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          roomName: "Q3 All Hands",
          roomCode: "K7M2QX",
          newSegment: { name: "Panel discussion", minutes: "15" },
          speaker: "Dana Lee",
        }}
      />
      <Composition
        id="RunTimer"
        component={RunTimer}
        durationInFrames={340}
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
        id="ShareScreen"
        component={ShareScreen}
        durationInFrames={215}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          roomName: "Q3 All Hands",
          roomCode: "K7M2QX",
          screenToken: "Vq3kP9xL2mT8",
          screenName: "Main stage",
          segmentName: "Opening remarks",
          segmentMinutes: 5,
        }}
      />
      <Composition
        id="JoinRoom"
        component={JoinRoom}
        durationInFrames={210}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          roomCode: "K7M2QX",
          participantName: "Jamie",
          segmentName: "Keynote",
          remainingAtJoinMs: 18 * 60_000 + 42_000,
        }}
      />
      <Composition
        id="Participants"
        component={Participants}
        durationInFrames={200}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          roomName: "Q3 All Hands",
          roomCode: "K7M2QX",
          participants: ["Main stage", "Jamie", "Priya"],
          segmentName: "Keynote",
          remainingAtStartMs: 12 * 60_000 + 30_000,
        }}
      />
      <Composition
        id="History"
        component={History}
        durationInFrames={260}
        fps={30}
        width={1280}
        height={800}
        defaultProps={{
          locale: "en" as const,
          roomName: "Q3 All Hands",
          roomCode: "K7M2QX",
          startedAt: "2026-10-07T09:00:00",
          report: [
            { name: "Opening remarks", plannedMs: 300_000, adjustmentsMs: 60_000, actualMs: 372_000 },
            { name: "Keynote", plannedMs: 1_200_000, adjustmentsMs: 0, actualMs: 1_180_000 },
            { name: "Q&A", plannedMs: 600_000, adjustmentsMs: 0, actualMs: 665_000 },
          ],
        }}
      />
    </Folder>
  );
};
