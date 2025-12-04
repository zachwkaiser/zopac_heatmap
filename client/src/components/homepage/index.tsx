import React, { useEffect, useState } from 'react';
import './style.css';

// API base URL from environment variable, fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface HomePageProps {
  setIsAuthenticated: (value: boolean) => void;
  isAuthenticated: boolean;
}

function HomePage({ setIsAuthenticated, isAuthenticated }: HomePageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json',},
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Invalid email or password. Please try again.');
        return;
      }

      setIsAuthenticated(true);
      alert('Login successful!');
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to log in. Please check your connection and try again.');
    }
  };

  // const handleOpenSignup = () => {
  //   setIsSignupOpen(true);
  // };

  const handleCloseSignup = () => {
    setIsSignupOpen(false);
    setSignupEmail('');
    setSignupPassword('');
    setSignupConfirm('');
  };

  // Close popup on Escape key
  useEffect(() => {
    if (!isSignupOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseSignup();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSignupOpen]);

  const handleSignupSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword) {
      alert('Please fill in all required fields.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      alert('Passwords do not match.');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to create account.');
        return;
      }

      alert('Account created successfully! You can now log in with your new credentials.');
      handleCloseSignup();
    } catch (error) {
      console.error('Signup error:', error);
      alert('Failed to create account. Please check your connection and try again.');
    }
  };

  if (isAuthenticated) {
    return (
      <div className="homepage">
        <h1>Welcome to the ZOPAC Heat Map Dashboard!</h1>
        <p>You are now logged in and can access the rest of the website.</p>
      </div>
    );
  }

  return (
    <div className="homepage">
      <h1>Welcome to ZOPAC heat map!</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Log In</button>
      </form>
      {/* <button className="toggle-button" onClick={handleOpenSignup}>
        Create an Account
      </button> */}

      {isSignupOpen && (
        <div
          className="homepage-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSignup();
          }}
        >
          <div className="homepage-modal">
            <div className="homepage-modal-header">
              <h2 id="signup-title" className="homepage-modal-title">Create your account</h2>
              <button className="homepage-modal-close-btn" aria-label="Close" onClick={handleCloseSignup}>
                ×
              </button>
            </div>
            <form onSubmit={handleSignupSubmit}>
              <div className="form-group">
                <label htmlFor="signup-email">Email</label>
                <input
                  type="email"
                  id="signup-email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="signup-password">Password</label>
                <input
                  type="password"
                  id="signup-password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="signup-confirm">Confirm Password</label>
                <input
                  type="password"
                  id="signup-confirm"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  required
                />
              </div>
              <div className="homepage-modal-actions">
                <button type="button" className="secondary" onClick={handleCloseSignup}>Cancel</button>
                <button type="submit">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
