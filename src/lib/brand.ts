// The app icon's scene (app-icon.svg), in its 1024×1024 space: a hooded
// coder, back to us, writing code on a glowing screen. Shared by the static
// mark (components/Logo.svelte) and the animated splash (splash/CoderScene).

/** The rounded tile everything sits on. */
export const TILE = { x: 64, y: 64, size: 896, radius: 220 };

/** The screen inside the monitor bezel. */
export const SCREEN = { x: 258, y: 208, width: 508, height: 358, radius: 24 };

export const HOOD =
  "M512 364C454 364 410 402 399 468C390 522 386 592 376 646C428 704 596 704 648 646C638 592 634 522 625 468C614 402 570 364 512 364Z";
/** The drape where the hood meets the back. */
export const HOOD_HEM = "M376 646C428 704 596 704 648 646";
export const TORSO =
  "M440 612C346 628 268 668 236 724C206 776 198 866 196 1000H828C826 866 818 776 788 724C756 668 678 628 584 612Z";
export const SPARKLE =
  "M718 236c2.6 17.6 10 25 27.6 27.6-17.6 2.6-25 10-27.6 27.6-2.6-17.6-10-25-27.6-27.6 17.6-2.6 25-10 27.6-27.6z";

/** One token of code: a round-capped line from `x` to `x + w` at height `y`. */
export interface CodeToken {
  x: number;
  y: number;
  w: number;
  color: string;
  alpha?: number;
}

/** Stroke width of a code token; its caps stick out by half of it. */
export const CODE_STROKE = 22;

/** The code on screen, in typing order. */
export const CODE: CodeToken[] = [
  { x: 302, y: 262, w: 84, color: "#b69cff" },
  { x: 408, y: 262, w: 150, color: "#8b97ff" },
  { x: 342, y: 310, w: 70, color: "#5ad8ee" },
  { x: 434, y: 310, w: 180, color: "#e3e7ff", alpha: 0.72 },
  { x: 342, y: 358, w: 124, color: "#8b97ff" },
  { x: 488, y: 358, w: 100, color: "#ffc27a" },
  { x: 610, y: 358, w: 62, color: "#e3e7ff", alpha: 0.45 },
  { x: 382, y: 406, w: 116, color: "#e3e7ff", alpha: 0.6 },
  { x: 342, y: 454, w: 64, color: "#b69cff" },
  { x: 302, y: 502, w: 44, color: "#8b97ff" },
];

/** Fewer, bolder lines for the mark at title-bar sizes. */
export const CODE_COMPACT: CodeToken[] = [
  { x: 318, y: 272, w: 96, color: "#b69cff" },
  { x: 470, y: 272, w: 170, color: "#8b97ff" },
  { x: 370, y: 350, w: 96, color: "#5ad8ee" },
  { x: 520, y: 350, w: 130, color: "#ffc27a" },
];
export const CODE_COMPACT_STROKE = 46;

/** The text cursor after the last token. */
export const CARET = { x: 366, y: 489, width: 16, height: 28 };
