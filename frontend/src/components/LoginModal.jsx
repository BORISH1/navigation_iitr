import React, { useState } from 'react';

const LoginModal = ({ onLogin, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = onLogin(username, password);
    if (!success) {
      setError('Invalid credentials. Try admin/admin123');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-form" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>🔐 Admin Login</h2>
        
        {error && <span className="error-text">{error}</span>}
        
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary">
            Login
          </button>
          <button type="button" className="btn" onClick={onClose} style={{ background: '#374151', color: 'white' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginModal;