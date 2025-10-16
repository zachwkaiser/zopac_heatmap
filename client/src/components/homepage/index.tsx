import React, { useState } from 'react';
import './style.css';

interface HomePageProps {
  setIsAuthenticated: (value: boolean) => void;
  isAuthenticated: boolean;
}

function HomePage({ setIsAuthenticated, isAuthenticated }: HomePageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [testCredentials, setTestCredentials] = useState({
    username: 'admin@gmail.com',
    password: 'password',
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isCreatingAccount) {
      setTestCredentials({ username: email, password });
      alert('Account created successfully! You can now log in with your new credentials.');
      setIsCreatingAccount(false);
    } else {
      if (email === testCredentials.username && password === testCredentials.password) {
        setIsAuthenticated(true);
        alert('Login successful!');
      } else {
        alert('Invalid email or password. Please try again.');
      }
    }

    setEmail('');
    setPassword('');
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
        <button type="submit">{isCreatingAccount ? 'Create Account' : 'Log In'}</button>
      </form>
      <button
        className="toggle-button"
        onClick={() => setIsCreatingAccount(!isCreatingAccount)}
      >
        {isCreatingAccount ? 'Back to Login' : 'Create an Account'}
      </button>
    </div>
  );
}

export default HomePage;
