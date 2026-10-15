import { Link } from 'react-router-dom';
export function Footer() {
  return (
    <footer className="mt-16 border-t border-line py-9 text-sm text-ink-3">
      <div className="container-page flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <Link className="text-lg font-black text-ink" to="/">
            GameHub
          </Link>
          <p className="mt-2 text-xs">发现游戏，探索新的世界。</p>
        </div>
        <nav aria-label="页脚导航" className="flex gap-6">
          <Link to="/games" className="hover:text-brand">
            游戏库
          </Link>
          <Link to="/search" className="hover:text-brand">
            搜索游戏
          </Link>
        </nav>
        <span className="text-xs">© {new Date().getFullYear()} GameHub</span>
      </div>
    </footer>
  );
}
