import { useState, useMemo, useEffect } from 'react';
import HomePage from './components/homepage';
import HeatMapPage from './components/heatmap';
import LogInPage from './components/login';
import NavBar from './components/navbar';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('Home');
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => JSON.parse(localStorage.getItem('isAuthenticated')) || false);
  const navbarHeight = 60;

  useEffect(() => {
    localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  const routes = useMemo(
    () => [
      {
        name: 'Home',
        element: <HomePage setIsAuthenticated={setIsAuthenticated} isAuthenticated={isAuthenticated} />,
      },
      {
        name: 'Heat map',
        element: isAuthenticated ? <HeatMapPage /> : <p>Please log in to access this page.</p>,
      },
      {
        name: 'Log in',
        element: isAuthenticated ? <LogInPage /> : <p>Please log in to access this page.</p>,
      },
    ],
    [isAuthenticated]
  );

  const handleNavClick = (pageName) => {
    setCurrentPage(pageName);
  };

  const currentPageElement = routes.find((route) => route.name === currentPage)?.element;

  return (
    <>
      <NavBar routes={routes} onNavClick={handleNavClick} />
      <div className="content" style={{ marginTop: `${navbarHeight}px` }}>
        {currentPageElement}
      </div>
    </>
  );
}

export default App;
