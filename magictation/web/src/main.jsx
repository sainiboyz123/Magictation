import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return <div className="center-screen"><div className="glass fatal"><h2>Something broke</h2><p>{String(this.state.err.message || this.state.err)}</p>
        <button className="btn primary" onClick={() => location.reload()}>Reload</button></div></div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>);
