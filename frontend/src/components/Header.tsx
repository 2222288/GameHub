import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Gamepad2, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { categoriesQuery } from '@/api/queries';
import { SearchBar } from './SearchBar';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const { pathname, search } = useLocation();
  const categories = useQuery(categoriesQuery);
  const isHome = pathname === '/';
  const visible = !isHome || pastHero;
  const sort = new URLSearchParams(search).get('sort');
  const isGames = pathname === '/games';

  useEffect(() => {
    setMenuOpen(false);
    setCategoriesOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!isHome) {
      setPastHero(true);
      return;
    }
    const update = () => {
      const firstScreen = document.querySelector<HTMLElement>('.hero-screen');
      setPastHero(window.scrollY >= (firstScreen?.offsetHeight || window.innerHeight) - 1);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [isHome]);

  useEffect(
    () => () => {
      if (openTimer.current) window.clearTimeout(openTimer.current);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!visible) return null;

  const startOpen = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = window.setTimeout(() => setCategoriesOpen(true), 250);
  };
  const startClose = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setCategoriesOpen(false), 400);
  };

  return (
    <header className="smart-header header-enter fixed left-0 top-0 z-40 w-full">
      <div className="nav-shell container-page flex items-center gap-8">
        <Link to="/" className="brand-logo flex items-center gap-2.5" aria-label="GameHub 首页">
          <span className="brand-icon">
            <Gamepad2 size={20} />
          </span>
          <span>
            Game<span className="text-brand">Hub</span>
          </span>
        </Link>
        <nav aria-label="主导航" className="hidden items-center gap-7 md:flex">
          <Link to="/games?sort=updated" className={isGames && sort === 'updated' ? 'active' : ''}>
            最新
          </Link>
          <Link
            to="/games?sort=resources"
            className={isGames && sort === 'resources' ? 'active' : ''}
          >
            热门
          </Link>
          <div
            className="category-nav"
            onMouseEnter={startOpen}
            onMouseLeave={startClose}
            onFocus={() => setCategoriesOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) startClose();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCategoriesOpen(false);
            }}
          >
            <Link to="/games" aria-expanded={categoriesOpen}>
              分类 <ChevronDown size={13} />
            </Link>
            {categoriesOpen && (
              <div className="category-mega-menu">
                <div>
                  <p className="eyebrow">BROWSE BY CATEGORY</p>
                  <strong>选择一个世界</strong>
                  <span>按类型快速进入完整资源列表。</span>
                </div>
                <div className="category-mega-links">
                  {(categories.data || []).map((category) => (
                    <Link to={`/games?category=${category.id}`} key={category.id}>
                      <span>{category.name}</span>
                      <small>{category.gameCount ?? 0} 款</small>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
        <div className="ml-auto hidden w-64 lg:block">
          <SearchBar />
        </div>
        <button
          className="ml-auto rounded-lg p-2 md:hidden"
          aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="移动端导航"
          className="mobile-menu container-page md:hidden"
        >
          <Link to="/games?sort=updated">最新</Link>
          <Link to="/games?sort=resources">热门</Link>
          <Link to="/games">分类</Link>
          <Link to="/games">全部游戏</Link>
          <SearchBar />
        </nav>
      )}
    </header>
  );
}
