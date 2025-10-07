import React, { useState } from 'react';
import './style.css';

function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false); // Toggle between forms

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isCreatingAccount) {
      console.log('Creating account with:', email, password);
      alert('Account created successfully!');
    } else {
      console.log('Logging in with:', email, password);
      alert('Login successful!');
    }
    setEmail('');
    setPassword('');
  };

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
