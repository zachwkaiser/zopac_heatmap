import React, { useState } from 'react'
import HomePage from './components/homepage'
import HeatMapPage from './components/heatmap'
import LogInPage from './components/login'
import NavBar from './components/navbar'
import './App.css'


// routes for the app
// each route has a name and an element
// outside of the function so it is not computed on every render

export type Pages = 'Home' | 'Heat map' | 'Log in';

export interface Route {
  name: Pages
  element: React.ReactNode
}

const routes: Route[] = [
  {
    name: "Home",
    element: <HomePage/>
  },
  
  {
    name: "Heat map",
    element: <HeatMapPage/>
  },
  {
    name: "Log in",
    element: <LogInPage/>
  }
];

function App() {
  const [currentPage, setCurrentPage] = useState('Home') // Start on home page
  const navbarHeight = 60

  const handleNavClick = (pageName: Pages) => {
    setCurrentPage(pageName)
  }

  const currentPageElement = routes.find(route => route.name === currentPage)?.element

  return (
    <>
      <NavBar routes={routes} onNavClick={handleNavClick} />
      <div className="content" style={{ marginTop: `${navbarHeight}px` }}>
        {currentPageElement}
      </div>
    </>
  )
}

export default App
