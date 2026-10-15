const C = (...x: number[]) => String.fromCharCode(...x);
const map: Record<string, string> = {
  ACTIVE: C(27491, 24120),
  UNKNOWN: C(26410, 39564, 35777),
  BROKEN: C(30097, 20284, 22833, 25928),
  DISABLED: C(24050, 19979, 26550),
  PUBLISHED: C(24050, 21457, 24067),
  DRAFT: C(33609, 31295),
  OFFLINE: C(24050, 19979, 26550),
  DELETED: C(24050, 21024, 38500),
};
export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'ACTIVE' || status === 'PUBLISHED'
      ? 'border-ok/30 bg-ok-soft text-ok'
      : status === 'BROKEN'
        ? 'border-err/30 bg-err-soft text-err'
        : 'border-line bg-panel text-ink-2';
  return <span className={`badge ${tone}`}>{map[status] || status}</span>;
}
