import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function CommunityPage() {
  return (
    <div className="container-page py-16">
      <h1 className="section-title text-3xl">玩家社区</h1>
      <div className="card mt-8 flex flex-col items-center p-12 text-center">
        <Users size={40} className="text-brand" />
        <h2 className="mt-5 text-xl font-bold">社区即将开放</h2>
        <p className="mt-3 text-sm text-ink-2">先去发现喜欢的作品，下次一起分享游戏体验。</p>
        <Link className="btn btn-primary mt-6" to="/games">
          探索游戏库
        </Link>
      </div>
    </div>
  );
}
