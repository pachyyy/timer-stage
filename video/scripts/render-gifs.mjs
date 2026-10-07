// Renders every docs composition (or the ones named) into ../public/docs/<slug>.gif.
//   node scripts/render-gifs.mjs                 all sections, English
//   node scripts/render-gifs.mjs RunTimer        one section
//   node scripts/render-gifs.mjs --locale=id     Indonesian, into ../public/docs/id/
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Composition id → GIF slug. Keep in sync with Root.tsx and the app's docs sections
// (src/lib/docs/sections.ts), which reference these files by slug.
const SECTIONS = {
  Overview: "overview",
  SignIn: "sign-in",
  CreateRoom: "create-room",
  BuildAgenda: "build-agenda",
  RunTimer: "run-timer",
  ShareScreen: "share-screen",
  JoinRoom: "join-room",
  Participants: "participants",
  History: "history",
};

const args = process.argv.slice(2);
const locale = args.find((a) => a.startsWith("--locale="))?.split("=")[1] ?? "en";
const only = args.filter((a) => !a.startsWith("--"));
const ids = only.length ? only : Object.keys(SECTIONS);
const outDir = locale === "en" ? "../public/docs" : `../public/docs/${locale}`;
// A props file rather than inline JSON — quoting JSON through the Windows shell is a losing game.
const propsFile = join(tmpdir(), "cue-docs-props.json");
writeFileSync(propsFile, JSON.stringify({ locale }));

for (const id of ids) {
  if (!SECTIONS[id]) throw new Error(`Unknown composition "${id}". Known: ${Object.keys(SECTIONS).join(", ")}`);
  const out = `${outDir}/${SECTIONS[id]}.gif`;
  console.log(`\n▶ ${id} → ${out}`);
  execFileSync(
    "npx",
    ["remotion", "render", id, out, "--codec=gif", "--every-nth-frame=2", `--props=${propsFile}`],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
}
