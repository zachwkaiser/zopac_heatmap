import React, { useState, useMemo, useEffect } from 'react';
import HomePage from './components/homepage';
import HeatMapPage from './components/heatmap';
import NavBar from './components/navbar';
import './App.css';

export type Pages = 'Home' | 'Heat map';

export interface Route {
  name: Pages;
  element: React.ReactNode;
}

const App = () => {
  const [currentPage, setCurrentPage] = useState<Pages>('Home');
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => JSON.parse(localStorage.getItem('isAuthenticated') || 'false')
  );
  const navbarHeight = 60;

  useEffect(() => {
    localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    setCurrentPage('Home'); // Redirect to Home page after logout
    alert('You have successfully been logged out.'); // Display browser alert
  };

  const routes: Route[] = useMemo(
    () => [
      {
        name: 'Home',
        element: <HomePage setIsAuthenticated={setIsAuthenticated} isAuthenticated={isAuthenticated} />,
      },
      {
        name: 'Heat map',
        element: isAuthenticated ? <HeatMapPage /> : <p style={{ textAlign: 'center' }}>Please log in to access this page.</p>,
      },
    ],
    [isAuthenticated]
  );

  const handleNavClick = (pageName: Pages) => {
    setCurrentPage(pageName);
  };

  const currentPageElement = routes.find((route) => route.name === currentPage)?.element;

  return (
    <>
      <NavBar
        routes={routes}
        onNavClick={handleNavClick}
        onLogout={handleLogout}
        activePage={currentPage} // Pass the active page to NavBar
      />
      <div className="content" style={{ marginTop: `${navbarHeight}px` }}>
        {currentPageElement}
      </div>
    </>
  );
};

export default App;
