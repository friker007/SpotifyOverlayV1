import React, { useState } from 'react';
import axios from 'axios';

function formatTime(ms) {
  const date = new Date(ms);
  return date.toLocaleString();
}

function AdminPanel() {
  const [password, setPassword] = useState(process.env.REACT_APP_ADMIN_PASSWORD || '');
  const [authorized, setAuthorized] = useState(false);
  const [tokens, setTokens] = useState({});
  const [error, setError] = useState('');
  const [showAccess, setShowAccess] = useState({});
  const [showRefresh, setShowRefresh] = useState({});

  const API_BASE = process.env.REACT_APP_API_URL || 'https://spotifyoverlayv1-production.up.railway.app';

  const fetchTokens = async () => {
    try {
      const response = await axios.post(`${API_BASE}/api/admin/tokens`, {
        password,
      });
      setTokens(response.data);
      setAuthorized(true);
      setError('');
    } catch (err) {
      setError('❌ Incorrect admin password or server error');
      setAuthorized(false);
    }
  };

  const toggleAccess = (userId) => {
    setShowAccess((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const toggleRefresh = (userId) => {
    setShowRefresh((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const removeUser = async (userId) => {
    try {
      await axios.post(`${API_BASE}/api/admin/remove`, {
        password,
        user_id: userId,
      });
      const updated = { ...tokens };
      delete updated[userId];
      setTokens(updated);
    } catch (err) {
      alert('❌ Failed to remove user');
    }
  };

  const manualRefresh = async (userId) => {
    try {
      const res = await axios.post(`${API_BASE}/api/admin/refresh`, {
        password,
        user_id: userId,
      });

      const newAccessToken = res.data.access_token;

      if (typeof newAccessToken !== 'string') {
        alert('❌ Invalid token received');
        return;
      }

      setTokens((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          access_token: newAccessToken,
          timestamp: Date.now(),
        },
      }));
    } catch (err) {
      alert('❌ Failed to refresh token');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>🔐 Admin Panel</h2>

        {!authorized ? (
          <>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />
            <br />
            <button onClick={fetchTokens}>Login</button>
            {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
          </>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Access Token</th>
                  <th>Refresh Token</th>
                  <th>Expires In</th>
                  <th>First Generated</th>
                  <th>Last Used</th>
                  <th>Expires At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tokens).map(([userId, token]) => {
                  const firstGen = formatTime(token.timestamp);
                  const expiresAt = formatTime(token.timestamp + token.expires_in * 1000);
                  const lastUsed = token.last_used ? formatTime(token.last_used) : '—';
                  const accessIsValid = typeof token.access_token === 'string';
                  const refreshIsValid = typeof token.refresh_token === 'string';

                  return (
                    <tr key={userId}>
                      <td>{userId}</td>
                      <td>
                        <button onClick={() => toggleAccess(userId)}>👁</button>
                        {showAccess[userId] && accessIsValid && (
                          <div style={{ wordBreak: 'break-all', marginTop: '0.3rem' }}>
                            {token.access_token}
                          </div>
                        )}
                      </td>
                      <td>
                        <button onClick={() => toggleRefresh(userId)}>👁</button>
                        {showRefresh[userId] && refreshIsValid && (
                          <div style={{ wordBreak: 'break-all', marginTop: '0.3rem' }}>
                            {token.refresh_token}
                          </div>
                        )}
                      </td>
                      <td>{token.expires_in}</td>
                      <td>{firstGen}</td>
                      <td>{lastUsed}</td>
                      <td>{expiresAt}</td>
                      <td>
                        <button onClick={() => manualRefresh(userId)}>🔄</button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${userId}?`)) removeUser(userId);
                          }}
                          style={{ backgroundColor: '#e74c3c', marginLeft: '0.5rem' }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
