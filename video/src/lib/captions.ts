import type { Locale } from "./i18n";

/**
 * The only copy in the videos with no counterpart in the app's own dictionaries — labels for the
 * devices and the narration beats that sit outside any app screen. Follows CLAUDE.md's
 * terminology glossary like the app does.
 */
export const CAPTIONS: Record<
  Locale,
  {
    operator: string;
    stage: string;
    phone: string;
    tablet: string;
    newWindow: string;
    fastForward: string;
    joinSteps: [string, string, string];
  }
> = {
  en: {
    operator: "Operator",
    stage: "Stage screen",
    phone: "Participant's phone",
    tablet: "Tablet",
    newWindow: "Screen (new window)",
    fastForward: "Fast-forward",
    joinSteps: ["Enter the room code", "Type your name", "Watch the timer"],
  },
  id: {
    operator: "Operator",
    stage: "Layar panggung",
    phone: "Ponsel peserta",
    tablet: "Tablet",
    newWindow: "Layar (jendela baru)",
    fastForward: "Dipercepat",
    joinSteps: ["Masukkan kode ruang", "Ketik nama Anda", "Lihat timer"],
  },
};
