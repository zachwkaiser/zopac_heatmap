import React from 'react';
import './style.css';
import { Pages } from '../../App';

interface NavBarProps {
  routes: { name: Pages; element: React.ReactNode }[];
  onNavClick: (pageName: Pages) => void;
  onLogout?: () => void;
  activePage: Pages;
}

const NavBar: React.FC<NavBarProps> = ({ routes, onNavClick, onLogout, activePage }) => {
  return (
    <nav className="navbar">
      <ul className="navbar-list">
        {routes.map((route) => (
          <li key={route.name} className="navbar-item">
            <button
              className={`navbar-link ${activePage === route.name ? 'active' : ''}`}
              onClick={() => onNavClick(route.name)}
            >
              {route.name}
            </button>
          </li>
        ))}
        {onLogout && (
          <li className="navbar-item logout-item">
            <button className="navbar-link" onClick={onLogout}>
              Log Out
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default NavBar;