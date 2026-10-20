import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { NotificationBell } from './NotificationBell';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Lost Pets
      </Link>
      <nav>
        {user ? (
          <>
            <NavLink to="/my-pets">My pets</NavLink>
            <NavLink to="/history">My publications</NavLink>
            <NotificationBell />
            <span className="whoami" data-testid="current-alias">
              {user.alias}
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
