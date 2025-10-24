import { useState, useEffect } from 'react';
import { isInitialized } from '../lib/nexus';
import { CHAINS, FROM_TOKENS, TO_TOKENS } from '../lib/chains';
import type { TokenBalance } from '../App';
import { useAccount } from 'wagmi';
import '../styles/SwapComponent.css';

interface SwapComponentProps {
  selectedToken: TokenBalance | null;
  unifiedBalances: TokenBalance[];
}

export default function SwapComponent({ selectedToken, unifiedBalances }: SwapComponentProps) {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromChain, setFromChain] = useState(1); // Default to Ethereum
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('ETH');
  const { isConnected } = useAccount();

  // Update form when a token card is clicked
  useEffect(() => {
    if (selectedToken) {
      setFromChain(selectedToken.chainId);
      setFromToken(selectedToken.symbol);
      // Optionally set the amount to max balance
      // setFromAmount(selectedToken.balance);
    }
  }, [selectedToken]);

  const handleSwap = () => {
    if (!isInitialized()) {
      alert('Please connect your wallet first');
      return;
    }
    console.log('Swap:', { 
      fromAmount, 
      fromToken, 
      fromChain: CHAINS.find(c => c.id === fromChain)?.name,
      toAmount, 
      toToken,
      toChain: 'Base' // Fixed to Base
    });
  };

  // Get current balance for selected chain and token
  const getCurrentBalance = (): TokenBalance | null => {
    if (!unifiedBalances || unifiedBalances.length === 0) {
      return null;
    }
    
    const balance = unifiedBalances.find(
      (b) => b.chainId === fromChain && b.symbol === fromToken
    );
    
    return balance || null;
  };

  const handleMaxClick = () => {
    const currentBalance = getCurrentBalance();
    if (currentBalance) {
      setFromAmount(currentBalance.balance);
    }
  };

  const formatBalance = (balance: string): string => {
    try {
      const value = parseFloat(balance);
      if (value === 0) return '0';
      if (value >= 1) {
        return value.toFixed(2).replace(/\.?0+$/, '');
      }
      return value.toPrecision(2);
    } catch {
      return balance;
    }
  };

  return (
    <div className="swap-container">
      <div className="swap-header">
        <h2>Swap to Base</h2>
        <span className="network-badge">Base-MEME Bridge</span>
      </div>

      {/* From Section */}
      <div className="swap-section">
        <label className="swap-label">From</label>
        
        <div className="selector-row">
          <div className="chain-selector">
            <label className="selector-sublabel">Network</label>
            <select 
              value={fromChain} 
              onChange={(e) => setFromChain(Number(e.target.value))}
              className="chain-dropdown"
            >
              {CHAINS.map(chain => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>

          <div className="token-selector">
            <label className="selector-sublabel">Asset</label>
            <select 
              value={fromToken} 
              onChange={(e) => setFromToken(e.target.value)}
              className="token-dropdown"
            >
              {FROM_TOKENS.map(token => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </div>
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
          {!isConnected ? (
            <span className="balance-text error-text">Connect wallet to see balance</span>
          ) : !isInitialized() ? (
            <span className="balance-text error-text">Initialize Nexus to see balance</span>
          ) : unifiedBalances.length === 0 ? (
            <span className="balance-text error-text">Fetch balances to see balance</span>
          ) : getCurrentBalance() ? (
            <>
              <span className="balance-text">
                Balance: {formatBalance(getCurrentBalance()!.balance)} {fromToken}
              </span>
              <button className="max-button" onClick={handleMaxClick}>Max</button>
            </>
          ) : (
            <span className="balance-text">Balance: 0 {fromToken}</span>
          )}
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
        
        <div className="token-selector">
          <label className="selector-sublabel">Asset</label>
          <select 
            value={toToken} 
            onChange={(e) => setToToken(e.target.value)}
            className="token-dropdown"
          >
            {TO_TOKENS.map(token => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </div>
        
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

