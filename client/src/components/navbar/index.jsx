import React from 'react';
import { Navbar, Container, Nav } from "react-bootstrap";
import './style.css';


function NavBar(props) {
  return (
    <Navbar bg="none" data-bs-theme="dark" fixed="top" expand="sm" className="navbar">
        <Container fluid>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mx-auto custom-nav">
              {
                props.routes.map((route) =>(
                  <Nav.Link key={route.name} href={`#${route.name.toLowerCase().replace(/\s+/g, '-')}`} className="link">
                    {route.name}
                  </Nav.Link>
                ))
              }
            </Nav>
          </Navbar.Collapse>
        </Container>
    </Navbar>
  );
};

export default NavBar;