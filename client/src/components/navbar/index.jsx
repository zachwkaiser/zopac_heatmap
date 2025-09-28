import React from 'react';
import './style.css';

function NavBar(props) {
  const handleClick = (e, routeName) => {
    e.preventDefault()
    if (props.onNavClick) {
      props.onNavClick(routeName)
    }
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-links">
          {props.routes.map((route) => (
            <a 
              key={route.name} 
              href="#"
              className="nav-link"
              onClick={(e) => handleClick(e, route.name)}
            >
              {route.name}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default NavBar;