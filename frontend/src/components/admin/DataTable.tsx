import type { ReactNode } from 'react';
export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-panel text-xs uppercase text-ink-3">
          <tr>
            {headers.map((x) => (
              <th className="px-4 py-3" key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
