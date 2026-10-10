// The old 16x16 pixel robot-cat, one colour variant per agent. Pose: stand | step (walk frame) | sit.
type Skin = { w: string; s: string; eye: string; acc: string; marks: [number, number][] };

const SKINS: Record<string, Skin> = {
  manager:   { w: "#f4f7ff", s: "#b9c4dd", eye: "#3ee6b0", acc: "#ff7aa8", marks: [[7, 12], [8, 12], [7, 13], [8, 13]] },   // tie
  marketing: { w: "#ffd6e6", s: "#f0a3c3", eye: "#ff4d8d", acc: "#ff3d81", marks: [[2, 1], [3, 1], [2, 2], [3, 2]] },         // ear bow
  finance:   { w: "#fff0b8", s: "#d9b95c", eye: "#ffc400", acc: "#e08a00", marks: [[7, 12], [8, 12]] },                     // coin
  assistant: { w: "#d4e6ff", s: "#8fb0e6", eye: "#4aa8ff", acc: "#3b6fe0", marks: [[1, 9], [1, 10], [2, 10], [12, 9]] },       // headset mic
};

const BASE = [
  "..oo........oo..",
  ".owwo......owwo.",
  ".owwoooooooowwo.",
  ".owwwwwwwwwwwwo.",
  "hhowkkkkkkkkwohh",
  "hhokkkkkkkkkkohh",
  "hhokkkkkkkkkkohh",
  "hhokkkkkkkkkkohh",
  "hhokkkkkkkkkkohh",
  ".owwwwwwwwwwwwo.",
  "..oowwwwwwwwoo..",
  "..owwwwwwwwwwo..",
  "..owwwwsswwwwo..",
  "..oswwwwwwwwso..",
  "...oooooooooo...",
  "................",
];
const EYE: [number, number][] = [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7]];
const FEET = { stand: [3, 4, 5, 10, 11, 12], step: [2, 3, 4, 11, 12, 13], sit: [] as number[] };

export type Pose = keyof typeof FEET;

export default function Buddy({ id, pose = "stand", size = 72 }: { id: string; pose?: Pose; size?: number }) {
  const k = SKINS[id] ?? SKINS.manager;
  const pal: Record<string, string> = { o: "#10162e", w: k.w, s: k.s, k: "#0a0f24", h: "#8794b4" };
  const g = BASE.map((r) => r.split(""));
  EYE.forEach(([x, y]) => { g[y][x] = "e"; g[y][15 - x] = "e"; });
  [11, 12, 13].forEach((y) => { g[y][1] = "h"; g[y][14] = "h"; });
  FEET[pose].forEach((x) => { g[15][x] = "h"; });
  pal.e = k.eye;
  pal.a = k.acc;
  k.marks.forEach(([x, y]) => { g[y][x] = "a"; });
  return (
    <svg className="buddy" viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
      {g.flatMap((row, y) => row.map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={pal[c]} />)))}
    </svg>
  );
}

// Gold pixel crown for the manager. CSS spins it slowly around its vertical axis.
const CROWN = ["y..y..y", "yyyyyyy", "gyyryyg"];
const CROWN_PAL: Record<string, string> = { y: "#ffd23e", g: "#e08a00", r: "#ff4d6d" };

export function Crown() {
  return (
    <span className="crown">
      <svg viewBox="0 0 7 3" width="32" height="14" shapeRendering="crispEdges" aria-hidden="true">
        {CROWN.flatMap((row, y) => [...row].map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={CROWN_PAL[c]} />)))}
      </svg>
    </span>
  );
}
