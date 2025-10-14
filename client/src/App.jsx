import { useState, useMemo } from 'react'
import HomePage from './components/homepage'
import HeatMapPage from './components/heatmap'
import LogInPage from './components/login'
import NavBar from './components/navbar'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('Home') // Start on home page
  const navbarHeight = 60

  const routes = useMemo(() => [
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
    },
  ], [])

  const handleNavClick = (pageName) => {
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
