// Color scale for winner-percentage gauge bars: red (weak) through green
// (strong), with the app's accent color kept for the "solid" middle band.
export const getGaugeColor = (pct: number): string => {
  if (pct < 15) return '#ef4444';
  if (pct < 30) return '#f97316';
  if (pct < 60) return '#C8F135';
  return '#22c55e';
};

type GaugeBarProps = {
  pct: number;
  sizeClassName?: string;
  className?: string;
  color?: string;
};

export function GaugeBar({ pct, sizeClassName = 'h-2', className = '', color }: GaugeBarProps) {
  return (
    <div className={`group relative w-full rounded-full bg-white/10 ${sizeClassName} ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color ?? getGaugeColor(pct) }} />
      <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
        {pct}%
      </div>
    </div>
  );
}
