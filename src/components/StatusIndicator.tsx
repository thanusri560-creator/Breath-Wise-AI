interface StatusIndicatorProps {
  tone: 'feasible' | 'warning' | 'critical' | 'neutral';
  label: string;
  inverted?: boolean;
}

export function StatusIndicator({ tone, label, inverted = false }: StatusIndicatorProps) {
  const symbol =
    tone === 'feasible'
      ? '●'
      : tone === 'warning'
        ? '▲'
        : tone === 'critical'
          ? '✖'
          : '◆';

  const colorClass = inverted
    ? tone === 'feasible'
      ? 'text-teal-300'
      : tone === 'warning'
        ? 'text-amber-300'
        : tone === 'critical'
          ? 'text-rose-300'
          : 'text-slate-300'
    : tone === 'feasible'
      ? 'text-teal-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'critical'
          ? 'text-rose-700'
          : 'text-slate-600';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium whitespace-nowrap ${colorClass}`}>
      <span aria-hidden="true" className="text-xs leading-none">
        {symbol}
      </span>
      <span>{label}</span>
    </span>
  );
}
