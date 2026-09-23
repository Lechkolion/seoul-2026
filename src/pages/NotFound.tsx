import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="wrap page empty empty--big">
      <p className="empty__title">This page wandered off.</p>
      <Link to="/" className="btn btn--primary">
        Back home
      </Link>
    </div>
  );
}
