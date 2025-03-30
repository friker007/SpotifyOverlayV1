import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import AdminPanel from './AdminPanel';

const CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;

// ✅ Required scopes for Now Playing
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-currently-playing',
  'user-read-playback-state'
];

const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const RESPONSE_TYPE = 'code';

function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || '');
  const [status, setStatus] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const hasSentToken = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code || hasSentToken.current || !userId) return;

    hasSentToken.current = true;

    axios
      .post('http://localhost:5000/api/get-token', {
        code,
        user_id: userId,
      })
      .then(() => {
        setStatus('✅ Token stored!');
      })
      .catch((err) => {
        setStatus('❌ Failed to store token.');
        console.error('[❌] Error:', err.response?.data || err.message);
      })
      .finally(() => {
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
      });
  }, [userId]);

  const loginWithSpotify = () => {
    if (!userId.trim()) {
      setStatus('❌ Please enter a user ID.');
      return;
    }

    localStorage.setItem('userId', userId);
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=${SCOPES.join('%20')}&response_type=${RESPONSE_TYPE}`;
    window.location.href = authUrl;
  };

  if (isAdmin) return <AdminPanel />;

  return (
    <div className="container">
      <div className="card">
        <h1>🎧 Spotify Auth App</h1>

        <input
          type="text"
          placeholder="Enter your user ID"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            localStorage.setItem('userId', e.target.value);
          }}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem',
            width: '280px',
            backgroundColor: '#1e1e1e',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: '6px'
          }}
        />
        <br />

        <button onClick={loginWithSpotify} style={{ marginRight: '0.5rem' }}>
          Login with Spotify
        </button>

        <button onClick={() => setIsAdmin(true)}>Go to Admin Panel</button>

        {status && <p style={{ marginTop: '1rem' }}>{status}</p>}
      </div>
    </div>
  );
}

export default App;
