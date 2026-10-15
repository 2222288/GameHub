import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
export function PublicLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById(hash.slice(1))?.scrollIntoView(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return (
    <>
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>
      <Header />
      <main
        id="main-content"
        className={`min-h-[65vh] ${pathname === '/' ? 'home-main' : 'public-main archive-canvas'}`}
      >
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}
