import type { CSSProperties, ReactElement } from "react";

const PALETTE: Record<string, string> = {
  k: "var(--space)",
  a: "var(--foreground)",
  b: "var(--sky)",
  c: "var(--pink)",
  d: "var(--gold)",
  e: "var(--mint)",
  f: "var(--peach)",
  g: "var(--lavender)",
  w: "var(--warn)",
  m: "var(--muted-foreground)",
};

export const ICONS = {
  mood: [
    "...kkkkkk...",
    "..kddddddk..",
    ".kddddddddk.",
    "kddddddddddk",
    "kddkddddkddk",
    "kddkddddkddk",
    "kddddddddddk",
    "kdkddddddkdk",
    "kddkkkkkkddk",
    ".kddddddddk.",
    "..kddddddk..",
    "...kkkkkk...",
  ],
  food: [
    "......ee....",
    ".....kee....",
    "..ccc.k.ccc.",
    ".cccccccccc.",
    "ccaccccccccc",
    "cacccccccccc",
    "cccccccccccc",
    "cccccccccccc",
    ".cccccccccc.",
    ".cccccccccc.",
    "..cccccccc..",
    "...ccc.ccc..",
  ],
  health: [
    "....gggg....",
    "....g..g....",
    "gggggggggggg",
    "gaaaaaaaaaag",
    "gaaaaccaaaag",
    "gaaaaccaaaag",
    "gaaccccccaag",
    "gaaccccccaag",
    "gaaaaccaaaag",
    "gaaaaccaaaag",
    "gaaaaaaaaaag",
    "gggggggggggg",
  ],
  dashboard: [
    "..........dd",
    "..........dd",
    ".......cc.dd",
    ".......cc.dd",
    "....bb.cc.dd",
    "....bb.cc.dd",
    ".ee.bb.cc.dd",
    ".ee.bb.cc.dd",
    ".ee.bb.cc.dd",
    ".ee.bb.cc.dd",
    "aaaaaaaaaaaa",
    "............",
  ],
  lock: [
    "...aaaaaa...",
    "..aa....aa..",
    "..a......a..",
    "..a......a..",
    ".dddddddddd.",
    ".dddddddddd.",
    ".ddddkkdddd.",
    ".ddddkkdddd.",
    ".ddddkkdddd.",
    ".dddddddddd.",
    ".dddddddddd.",
    "............",
  ],
  check: [
    "........",
    ".......e",
    "......ee",
    "e....ee.",
    "ee..ee..",
    ".eeee...",
    "..ee....",
    "........",
  ],
  breakfast: [
    "....aaaa....",
    "..aaaaaaaa..",
    ".aaaaaaaaaa.",
    ".aaaddddaaa.",
    "aaaddddddaaa",
    "aaaddadddaaa",
    "aaaddddddaaa",
    ".aaaddddaaa.",
    ".aaaaaaaaaa.",
    "..aaaaaaaa..",
    "...aaaaaaa..",
    "............",
  ],
  lunch: [
    "............",
    "....e..e....",
    "..eeeceee...",
    ".eeceeeecee.",
    "eeeeeeeeeeee",
    "gggggggggggg",
    ".gagggggggg.",
    ".gggggggggg.",
    "..gggggggg..",
    "...gggggg...",
    "....gggg....",
    "............",
  ],
  dinner: [
    "............",
    "....ffff....",
    "..ffffffff..",
    ".ffccffffff.",
    "ffffffffaaff",
    "ffffffffaaff",
    "fffcfffffff.",
    ".ffffffffff.",
    "..ffffffff..",
    "...ffffff...",
    "............",
    "............",
  ],
  snack: [
    "......ee....",
    ".....kee....",
    "..ccc.k.ccc.",
    ".cccccccccc.",
    "ccaccccccccc",
    "cacccccccccc",
    "cccccccccccc",
    "cccccccccccc",
    ".cccccccccc.",
    ".cccccccccc.",
    "..cccccccc..",
    "...ccc.ccc..",
  ],
  star: [
    "...d...",
    "...d...",
    "..ddd..",
    "ddddddd",
    "..ddd..",
    ".dd.dd.",
    ".d...d.",
  ],
  drop: [
    ".....b.....",
    "....bbb....",
    "...bbbbb...",
    "..bbbbbbb..",
    ".bbabbbbbb.",
    ".babbbbbbb.",
    "bbbbbbbbbbb",
    "bbbbbbbbbbb",
    ".bbbbbbbbb.",
    "..bbbbbbb..",
    "...bbbbb...",
  ],
  heart: [
    ".cc...cc.",
    "ccac.cccc",
    "cacccccc.",
    "ccccccccc",
    ".ccccccc.",
    "..ccccc..",
    "...ccc...",
    "....c....",
  ],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

interface PixelArtProps {
  grid: string[];
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function PixelArt({ grid, size = 48, className, style, title }: PixelArtProps) {
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const rects: ReactElement[] = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = PALETTE[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    });
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}

export function PixelIcon({ name, ...rest }: { name: IconName } & Omit<PixelArtProps, "grid">) {
  return <PixelArt grid={ICONS[name]} {...rest} />;
}
