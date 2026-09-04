// The piece meter: one segment per piece, filling as the cart grows, coral
// past the cap. Tracked as SAK-304. The cap is one lesson's, never the sky's:
// going over is allowed and warned, so the bar grows past its own end rather
// than clipping.

export interface PieceMeterProps {
  pieces: number;
  cap: number;
  className?: string;
}

export function PieceMeter({ pieces, cap, className = "" }: PieceMeterProps) {
  const n = Math.max(cap, pieces);
  return (
    <div
      role="meter"
      aria-valuenow={pieces}
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-label={`${pieces} of ${cap} pieces${pieces > cap ? `, ${pieces - cap} over` : ""}`}
      className={`flex gap-[3px] ${className}`}
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-[2px] ${i < pieces ? (i < cap ? "bg-sky-gold" : "bg-sky-coral") : "bg-sky-card-strong"}`} />
      ))}
    </div>
  );
}
