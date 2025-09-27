import { useMemo } from 'react'
import HeatMapPage from './components/heatmap'
import LogInPage from './components/login'
import SignUpPage from './components/signup'
import NavBar from './components/navbar'
import './App.css'

function App() {
  const navbarHeight = 60


  const routes = useMemo(() => [
    {
      name: "Heat map",
      element: <HeatMapPage/>
    },
    {
      name: "Log in",
      element: <LogInPage/>
    },
    {
      name: "Sign up",
      element: <SignUpPage/>
    },
  
  ], [])


  return (
    <>
      <NavBar routes={routes} offset={navbarHeight} />
      <div className="content">
      {
        routes.map((route) => (
          <div key={route.name} id={route.name.toLowerCase().replace(/\s+/g, '-')}>
            {route.element}
          </div>
        ))
      }
      </div>
    </>
  )
}

export default App
