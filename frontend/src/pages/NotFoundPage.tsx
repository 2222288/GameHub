import { Link } from 'react-router-dom';
const C = (...x: number[]) => String.fromCharCode(...x);
export default function NotFoundPage() {
  return (
    <div className="container-page py-24 text-center">
      <div className="text-7xl font-black text-line">404</div>
      <h1 className="mt-4 text-2xl font-bold">{C(39029, 38754, 19981, 23384, 22312)}</h1>
      <Link className="btn btn-primary mt-6" to="/">
        {C(36820, 22238, 39318, 39029)}
      </Link>
    </div>
  );
}
