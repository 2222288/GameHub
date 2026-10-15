import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
export function SearchBar({ large = false }: { large?: boolean }) {
  const [sp] = useSearchParams();
  const query = sp.get('q') || '';
  const [q, setQ] = useState(query);
  const navigate = useNavigate();
  useEffect(() => setQ(query), [query]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (q.trim()) navigate('/search?q=' + encodeURIComponent(q.trim()));
  };
  return (
    <form
      onSubmit={submit}
      role="search"
      className={`search-bar flex w-full ${large ? 'max-w-2xl' : ''}`}
    >
      <input
        type="search"
        aria-label="搜索游戏"
        className={`input ${large ? 'py-4 text-base' : ''}`}
        value={q}
        maxLength={200}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索游戏名称、类型、关键词…"
      />
      <button type="submit" className="btn btn-primary" aria-label="提交搜索" disabled={!q.trim()}>
        <Search size={18} />
        {large && <span className="hidden sm:inline">搜索</span>}
      </button>
    </form>
  );
}
