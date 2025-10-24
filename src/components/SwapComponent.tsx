import { useState } from 'react';
import { isInitialized } from '../lib/nexus';
import '../styles/SwapComponent.css';

export default function SwapComponent() {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('MEME');

  const handleSwap = () => {
    if (!isInitialized()) {
      alert('Please connect your wallet first');
      return;
    }
    console.log('Swap:', { fromAmount, fromToken, toAmount, toToken });
  };

  const handleMaxClick = () => {
    // TODO: Set to actual balance
    setFromAmount('2.45');
  };

  const swapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  return (
    <div className="swap-container">
      <div className="swap-header">
        <h2>Swap to Meme Coin</h2>
        <span className="network-badge">On Base</span>
      </div>

      {/* From Section */}
      <div className="swap-section">
        <label className="swap-label">From</label>
        
        <div className="token-selector">
          <select 
            value={fromToken} 
            onChange={(e) => setFromToken(e.target.value)}
            className="token-dropdown"
          >
            <option value="ETH">Ethereum</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
          </select>
        </div>

        <div className="amount-input-container">
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="amount-input"
          />
          <div className="token-symbol-container">
            <span className="token-symbol">{fromToken}</span>
          </div>
        </div>

        <div className="balance-row">
          <span className="balance-text">Balance: 2.45 {fromToken}</span>
          <button className="max-button" onClick={handleMaxClick}>Max</button>
        </div>
      </div>

      {/* Swap Icon */}
      {/* <div className="swap-icon-container">
        <button className="swap-icon-button" onClick={swapTokens}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 10l5 5 5-5M7 14l5-5 5 5"/>
          </svg>
        </button>
      </div> */}

      {/* To Section */}
      <div className="swap-section">
        <label className="swap-label">To (on Base)</label>
        
        <div className="amount-input-container">
          <input
            type="number"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder="0.0"
            className="amount-input"
          />
          <div className="token-symbol-container">
            <span className="token-symbol">{toToken}</span>
          </div>
        </div>

        <div className="balance-row">
          <span className="balance-text">≈ $0.00</span>
        </div>
      </div>

      {/* Rate Info */}
      <div className="rate-info">
        <div className="rate-row">
          <span>Rate</span>
          <span className="rate-value">1 ETH = 10,000 MEME</span>
        </div>
        <div className="rate-row">
          <span>Bridge Fee</span>
          <span className="rate-value">0.1%</span>
        </div>
        <div className="rate-row">
          <span>Est. Time</span>
          <span className="rate-value">~2 minutes</span>
        </div>
      </div>

      {/* Swap Button */}
      <button 
        className="swap-button"
        onClick={handleSwap}
        disabled={!isInitialized() || !fromAmount}
      >
        {isInitialized() ? 'Swap Now' : 'Connect Wallet to Swap'}
      </button>
    </div>
  );
}

