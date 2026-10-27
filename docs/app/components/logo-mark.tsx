// Mirrors app/components/logo-mark.tsx: draws out an H.
const LOGO = [
  [true, false, true],
  [true, true, true],
  [true, false, true],
];

export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 30 30">
      {LOGO.flatMap((row, y) =>
        row.map((isOn, x) => (
          <circle
            className={isOn ? "fill-fg" : "fill-line-strong"}
            cx={7.5 + x * 7.5}
            cy={7.5 + y * 7.5}
            key={`${x}-${y}`}
            r={2.5}
          />
        )),
      )}
    </svg>
  );
}
