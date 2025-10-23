import ConnectWalletButton from "./components/connect-button";
import SwapComponent from "./components/SwapComponent";
import BalancePanel from "./components/BalancePanel";
import "./App.css";

function App() {
  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">Avail Meme</h1>
          <ConnectWalletButton className="connect-button" />
        </div>
      </header>

      {/* Main Body - 80% of screen height */}
      <main className="main-content">
        <div className="main-inner">
          <div className="swap-section-container">
            <SwapComponent />
          </div>
          <div className="balance-panel-container">
            <BalancePanel />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2025 Avail Meme. Built with React and Avail Nexus.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
