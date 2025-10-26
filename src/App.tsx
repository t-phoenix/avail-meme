import { useState } from "react";
import ConnectWalletButton from "./components/connect-button";
import SwapComponent from "./components/SwapComponent";
import BalancePanel from "./components/BalancePanel";
import "./App.css";

export interface TokenBalance {
  chain: string;
  chainId: number;
  chainLogo?: string;
  symbol: string;
  balance: string;
  decimals: number;
  contractAddress: string;
  isNative: boolean;
  icon?: string;
  balanceInFiat?: number;
}

function App() {
  const [unifiedBalances, setUnifiedBalances] = useState<TokenBalance[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);

  const handleTokenSelect = (token: TokenBalance) => {
    setSelectedToken(token);
  };

  const handleBalancesUpdate = (balances: TokenBalance[]) => {
    setUnifiedBalances(balances);
  };

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
            <SwapComponent 
              selectedToken={selectedToken}
              unifiedBalances={unifiedBalances}
              onBalancesUpdate={handleBalancesUpdate}
            />
          </div>
          <div className="balance-panel-container">
            <BalancePanel 
              onTokenSelect={handleTokenSelect}
              onBalancesUpdate={handleBalancesUpdate}
              externalBalances={unifiedBalances}
            />
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
