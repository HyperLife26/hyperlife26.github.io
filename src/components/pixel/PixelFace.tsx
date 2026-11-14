import type { FaceScale } from "@/lib/hyperlife/types";
import { PixelArt } from "./PixelIcon";

const FILL: Record<FaceScale, string> = { 1: "c", 2: "f", 3: "d", 4: "b", 5: "e" };

function faceGrid(level: FaceScale) {
  const f = FILL[level];
  const base = [
    "...kkkkkk...",
    "..kffffffk..",
    ".kffffffffk.",
    "kffffffffffk",
    "kffffffffffk",
    "kffffffffffk",
    "kffffffffffk",
    "kffffffffffk",
    "kffffffffffk",
    ".kffffffffk.",
    "..kffffffk..",
    "...kkkkkk...",
  ].map((r) => r.replace(/f/g, f).split(""));
  const set = (r: number, c: number, ch: string) => (base[r][c] = ch);
  // eyes
  if (level === 1) {
    // X eyes
    set(3, 2, "k"); set(3, 4, "k"); set(4, 3, "k"); set(5, 2, "k"); set(5, 4, "k");
    set(3, 7, "k"); set(3, 9, "k"); set(4, 8, "k"); set(5, 7, "k"); set(5, 9, "k");
  } else {
    set(4, 3, "k"); set(5, 3, "k"); set(4, 8, "k"); set(5, 8, "k");
  }
  const row = (r: number, from: number, to: number, ch = "k") => {
    for (let c = from; c <= to; c++) set(r, c, ch);
  };
  switch (level) {
    case 5:
      row(7, 3, 8);
      set(8, 3, "k"); set(8, 8, "k"); row(8, 4, 7, "c");
      row(9, 4, 7);
      break;
    case 4:
      set(7, 3, "k"); set(7, 8, "k"); row(8, 4, 7);
      break;
    case 3:
      row(8, 4, 7);
      break;
    case 2:
      row(7, 4, 7); set(8, 3, "k"); set(8, 8, "k");
      break;
    case 1:
      row(7, 4, 7); set(8, 3, "k"); set(8, 8, "k");
      set(6, 2, "b"); set(7, 2, "b");
      break;
  }
  return base.map((r) => r.join(""));
}

export function PixelFace({ level, size = 48, className }: { level: FaceScale; size?: number; className?: string }) {
  return <PixelArt grid={faceGrid(level)} size={size} className={className} />;
}
