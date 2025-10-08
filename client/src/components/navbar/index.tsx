import './style.css';
import { Pages, Route } from '../../App';

interface NavBarProps {
  routes: Route[]
  onNavClick: (pageName: Pages) => void
}

function NavBar(props: NavBarProps) {
  const handleClick = (routeName: Pages) => {
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
              onClick={() => handleClick(route.name)}
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