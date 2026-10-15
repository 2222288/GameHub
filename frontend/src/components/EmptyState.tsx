import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
const C = (...x: number[]) => String.fromCharCode(...x);
export function EmptyState({ query }: { query?: string }) {
  return (
    <div className="card py-16 text-center">
      <SearchX className="mx-auto mb-4 h-9 w-9 text-ink-3" />
      <h2 className="text-lg font-bold">
        {query ? `${C(27809, 26377, 25214, 21040)} "${query}"` : C(26242, 26080, 25968, 25454)}
      </h2>
      {query && (
        <div className="mx-auto mt-3 max-w-md text-sm text-ink-2">
          {C(
            23581,
            35797,
            26816,
            26597,
            20851,
            38190,
            35789,
            12289,
            20351,
            29992,
            26356,
            30701,
            30340,
            35789,
            25110,
            25628,
            32034,
            33521,
            25991,
            21517,
            31216,
          )}
        </div>
      )}
      <Link to="/games" className="btn btn-secondary mt-5">
        {C(36820, 22238, 20840, 37096, 28216, 25103)}
      </Link>
    </div>
  );
}
