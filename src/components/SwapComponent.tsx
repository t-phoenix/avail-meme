import { useState, useEffect } from 'react';
import { isInitialized, sdk, getUnifiedBalances } from '../lib/nexus';
import { CHAINS, FROM_TOKENS, TO_TOKENS } from '../lib/chains';
import type { TokenBalance } from '../App';
import { useAccount } from 'wagmi';
import type { BridgeAndExecuteSimulationResult, BridgeAndExecuteResult } from '@avail-project/nexus-core';
import { simulateBridgeAndExecute, getSwapQuoteOnBase, executeBridgeThenSwap } from '../lib/simulation';
import StatusModal, { type StepStatus } from './StatusModal';
import '../styles/SwapComponent.css';

interface SwapComponentProps {
  selectedToken: TokenBalance | null;
  unifiedBalances: TokenBalance[];
  onBalancesUpdate?: (balances: TokenBalance[]) => void;
}

const SUPPORTED_INPUT_TOKENS = ['ETH', 'USDC', 'USDT'];

const formatBalance = (balance: string): string => {
  const value = parseFloat(balance);
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(2).replace(/\.?0+$/, '');
  return value.toPrecision(2);
};

export default function SwapComponent({ selectedToken, unifiedBalances, onBalancesUpdate }: SwapComponentProps) {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromChain, setFromChain] = useState(1);
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('ETH');
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [_executionResult, setExecutionResult] = useState<BridgeAndExecuteResult | null>(null);
  const [_balanceChange, setBalanceChange] = useState<{
    fromBalance: string;
    toBalance: string;
    change: string;
  } | null>(null);
  
  // Status modal state
  const [currentStep, setCurrentStep] = useState<'bridge' | 'approval' | 'swap'>('bridge');
  const [stepStatuses, setStepStatuses] = useState<{
    bridge: StepStatus;
    approval: StepStatus;
    swap: StepStatus;
  }>({
    bridge: 'pending',
    approval: 'pending',
    swap: 'pending',
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [bridgeTransactionHash, setBridgeTransactionHash] = useState<string>('');
  const [swapTransactionHash, setSwapTransactionHash] = useState<string>('');
  const [bridgeExplorerUrl, setBridgeExplorerUrl] = useState<string>('');
  const [swapExplorerUrl, setSwapExplorerUrl] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { isConnected, address } = useAccount();

  const getCurrentBalance = () => 
    unifiedBalances.find(b => b.chainId === fromChain && b.symbol === fromToken) || null;

  // Update form when token card is clicked
  useEffect(() => {
    if (selectedToken) {
      setFromChain(selectedToken.chainId);
      setFromToken(selectedToken.symbol);
    }
  }, [selectedToken]);

  // Fetch Uniswap quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount('');
        setQuoteError(null);
        return;
      }

      if (!SUPPORTED_INPUT_TOKENS.includes(fromToken)) {
        setToAmount('');
        setQuoteError('Unsupported input token');
        return;
      }

      if (fromToken === toToken) {
        setToAmount(fromAmount);
        setQuoteError(null);
        return;
      }

      setIsFetchingQuote(true);
      setQuoteError(null);

      try {
        const quote = await getSwapQuoteOnBase({
          fromToken: fromToken as 'ETH' | 'USDC' | 'USDT',
          fromAmount,
          toToken,
        });

        if (quote.success) {
          setToAmount(quote.outputAmount);
          setQuoteError(null);
        } else {
          setToAmount('');
          setQuoteError(quote.error || 'Failed to get quote');
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        setToAmount('');
        setQuoteError('Error fetching quote');
      } finally {
        setIsFetchingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [fromAmount, fromToken, toToken]);

  // Run simulation for bridge costs
  useEffect(() => {
    const runSimulation = async () => {
      if (!isInitialized() || !address || !fromAmount || parseFloat(fromAmount) <= 0) {
        setSimulationResult(null);
        return;
      }

      setIsSimulating(true);
      try {
        const simulation = await simulateBridgeAndExecute({
          fromAmount,
          fromToken,
          fromChain,
          toToken,
          userAddress: address,
        });
        setSimulationResult(simulation);
      } catch (error) {
        console.error('Simulation error:', error);
        setSimulationResult(null);
      } finally {
        setIsSimulating(false);
      }
    };

    runSimulation();
  }, [fromAmount, fromToken, toToken, fromChain, address]);

  const handleSwap = async () => {
    if (!isInitialized() || !address) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!simulationResult?.success) {
      alert('Please wait for simulation to complete successfully');
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setIsExecuting(true);
      setIsModalOpen(true);
      setModalError(null);
      setCurrentStep('bridge');
      setStepStatuses({
        bridge: 'in-progress',
        approval: 'pending',
        swap: 'pending',
      });
      // Reset transaction URLs
      setBridgeTransactionHash('');
      setSwapTransactionHash('');
      setBridgeExplorerUrl('');
      setSwapExplorerUrl('');
      setExecutionStatus('🔄 Preparing transaction...');
      setExecutionResult(null);
      setBalanceChange(null);

      // Get initial balance of source token
      const initialFromBalance = getCurrentBalance();
      const initialFromBalanceValue = initialFromBalance?.balance || '0';

      // Get initial balance of destination token on Base
      setExecutionStatus('📊 Fetching initial balances...');
      let initialToBalanceValue = '0';
      try {
        const unifiedBalance = await sdk.getUnifiedBalance(toToken);
        if (unifiedBalance) {
          // Find balance on Base chain (chainId 8453)
          const baseBalance = unifiedBalance.breakdown?.find(b => b.chain.id === 8453);
          if (baseBalance) {
            initialToBalanceValue = baseBalance.balance;
          }
        }
      } catch (error) {
        console.warn('Could not fetch initial Base balance:', error);
      }

      // Execute the bridge and swap (using two-step approach)
      setExecutionStatus(`🌉 Bridging ${fromAmount} ${fromToken} from ${CHAINS.find(c => c.id === fromChain)?.name}...`);
      
      // Execute with step tracking
      const result = await executeBridgeThenSwap({
        fromAmount,
        fromToken,
        fromChain,
        toToken,
        userAddress: address,
        onBridgeStart: () => {
          setCurrentStep('bridge');
          setStepStatuses(prev => ({ ...prev, bridge: 'in-progress' }));
        },
        onBridgeComplete: () => {
          setStepStatuses(prev => ({ ...prev, bridge: 'completed' }));
          setCurrentStep('approval');
        },
        onApprovalStart: () => {
          setCurrentStep('approval');
          setStepStatuses(prev => ({ ...prev, approval: 'in-progress' }));
        },
        onApprovalComplete: () => {
          setStepStatuses(prev => ({ ...prev, approval: 'completed' }));
          setCurrentStep('swap');
        },
        onSwapStart: () => {
          setCurrentStep('swap');
          setStepStatuses(prev => ({ ...prev, swap: 'in-progress' }));
        },
        onSwapComplete: () => {
          setStepStatuses(prev => ({ ...prev, swap: 'completed' }));
        },
        onError: (error: string) => {
          setModalError(error);
          setStepStatuses(prev => {
            const newStatuses = { ...prev };
            if (prev.bridge === 'in-progress') {
              newStatuses.bridge = 'error';
            } else if (prev.approval === 'in-progress') {
              newStatuses.approval = 'error';
            } else if (prev.swap === 'in-progress') {
              newStatuses.swap = 'error';
            }
            return newStatuses;
          });
        },
      });

      if (!result) {
        throw new Error('Transaction failed: No result returned');
      }

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      // Store result and transaction URLs
      setExecutionResult(result);
      setBridgeTransactionHash(result.bridgeTransactionHash || '');
      setSwapTransactionHash(result.executeTransactionHash || '');
      setBridgeExplorerUrl(result.bridgeExplorerUrl || '');
      setSwapExplorerUrl(result.executeExplorerUrl || '');
      setExecutionStatus('✅ Transaction completed successfully!');

      // Get final balances
      setExecutionStatus('📊 Fetching final balances...');
      let finalToBalanceValue = '0';
      try {
        const unifiedBalance = await sdk.getUnifiedBalance(toToken);
        if (unifiedBalance) {
          // Find balance on Base chain (chainId 8453)
          const baseBalance = unifiedBalance.breakdown?.find(b => b.chain.id === 8453);
          if (baseBalance) {
            finalToBalanceValue = baseBalance.balance;
          }
        }
      } catch (error) {
        console.warn('Could not fetch final Base balance:', error);
      }

      // Calculate balance change
      const balanceDiff = parseFloat(finalToBalanceValue) - parseFloat(initialToBalanceValue);
      setBalanceChange({
        fromBalance: initialFromBalanceValue,
        toBalance: finalToBalanceValue,
        change: balanceDiff.toFixed(6),
      });

      // Modal already shows success, no need for alert

      // Open explorer if available
      if (result.executeExplorerUrl) {
        // Auto-open explorer after 3 seconds
        setTimeout(() => {
          const openExplorer = confirm('Would you like to view the transaction in the explorer?');
          if (openExplorer) {
            window.open(result.executeExplorerUrl, '_blank');
          }
        }, 3000);
      }

      // Refresh balances after successful transaction
      setTimeout(async () => {
        try {
          console.log('🔄 Refreshing balances after transaction...');
          const freshBalances = await getUnifiedBalances();
          
          // Parse and update balances
          const parsedTokens: TokenBalance[] = [];
          if (Array.isArray(freshBalances)) {
            freshBalances.forEach((abstractedToken: any) => {
              const { symbol, icon, breakdown } = abstractedToken;
              if (Array.isArray(breakdown)) {
                breakdown.forEach((chainBalance: any) => {
                  const { balance, chain, contractAddress, decimals, balanceInFiat } = chainBalance;
                  if (parseFloat(balance) === 0) return;
                  const isNative = contractAddress === '0x0000000000000000000000000000000000000000';
                  parsedTokens.push({
                    chain: chain.name,
                    chainId: chain.id,
                    chainLogo: chain.logo,
                    symbol: symbol,
                    balance: balance,
                    decimals: decimals,
                    contractAddress: contractAddress,
                    isNative: isNative,
                    icon: icon,
                    balanceInFiat: balanceInFiat,
                  });
                });
              }
            });
          }
          
          if (onBalancesUpdate) {
            onBalancesUpdate(parsedTokens);
            console.log('✅ Balances refreshed successfully');
          }
        } catch (error) {
          console.warn('Could not refresh balances:', error);
        }
      }, 3000);

      // Reset form after modal auto-closes
      setTimeout(() => {
        setFromAmount('');
        setToAmount('');
        setSimulationResult(null);
      }, 5000);

    } catch (error) {
      console.error('Swap execution error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setExecutionStatus(`❌ Error: ${errorMessage}`);
      setModalError(errorMessage);
      
      // Update step statuses to show error
      setStepStatuses(prev => {
        const newStatuses = { ...prev };
        if (prev.bridge === 'in-progress') {
          newStatuses.bridge = 'error';
        } else if (prev.approval === 'in-progress') {
          newStatuses.approval = 'error';
        } else if (prev.swap === 'in-progress') {
          newStatuses.swap = 'error';
        }
        return newStatuses;
      });
      
      alert(`❌ Transaction Failed\n\n${errorMessage}\n\nPlease try again or check the console for more details.`);
      
      setExecutionResult({
        success: false,
        error: errorMessage,
      } as BridgeAndExecuteResult);
    } finally {
      setIsExecuting(false);
      // Clear status after 10 seconds
      setTimeout(() => {
        if (!isExecuting) {
          setExecutionStatus('');
        }
      }, 10000);
    }
  };

  const handleMaxClick = () => {
    const balance = getCurrentBalance();
    if (balance) setFromAmount(balance.balance);
  };

  const renderBalanceInfo = () => {
    if (!isConnected) return <span className="balance-text error-text">Connect wallet to see balance</span>;
    if (!isInitialized()) return <span className="balance-text error-text">Initialize Nexus to see balance</span>;
    if (unifiedBalances.length === 0) return <span className="balance-text error-text">Fetch balances to see balance</span>;
    
    const balance = getCurrentBalance();
    return balance ? (
      <>
        <span className="balance-text">Balance: {formatBalance(balance.balance)} {fromToken}</span>
        <button className="max-button" onClick={handleMaxClick}>Max</button>
      </>
    ) : (
      <span className="balance-text">Balance: 0 {fromToken}</span>
    );
  };

  const getButtonText = () => {
    if (!isInitialized()) return 'Connect Wallet to Swap';
    if (isExecuting) return '⏳ Executing Swap...';
    if (isSimulating) return '⏳ Simulating...';
    if (!simulationResult?.success && fromAmount) return '⚠️ Simulation Failed';
    if (simulationResult?.success) return `Swap to ${toAmount} ${toToken}`;
    return 'Enter Amount to Swap';
  };

  const getEstimatedCost = () => {
    if (typeof simulationResult?.totalEstimatedCost === 'string') {
      return simulationResult.totalEstimatedCost;
    }
    if (typeof simulationResult?.totalEstimatedCost === 'object' && simulationResult.totalEstimatedCost?.total) {
      return simulationResult.totalEstimatedCost.total;
    }
    return 'N/A';
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
            <select value={fromChain} onChange={(e) => setFromChain(Number(e.target.value))} className="chain-dropdown">
              {CHAINS.map(chain => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>

          <div className="token-selector">
            <label className="selector-sublabel">Asset</label>
            <select value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="token-dropdown">
              {FROM_TOKENS.map(token => (
                <option key={token} value={token}>{token}</option>
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

        <div className="balance-row">{renderBalanceInfo()}</div>
      </div>

      {/* To Section */}
      <div className="swap-section">
        <label className="swap-label">To (on Base)</label>
        
        <div className="token-selector">
          <label className="selector-sublabel">Asset</label>
          <select value={toToken} onChange={(e) => setToToken(e.target.value)} className="token-dropdown">
            {TO_TOKENS.map(token => (
              <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
            ))}
          </select>
        </div>
        
        <div className="amount-input-container">
          <input
            type="number"
            value={toAmount}
            readOnly
            placeholder={isFetchingQuote ? "Fetching quote..." : quoteError ? "No pool found" : "0.0"}
            className="amount-input"
            style={{ cursor: 'not-allowed' }}
          />
          <div className="token-symbol-container">
            <span className="token-symbol">{toToken}</span>
          </div>
        </div>

        <div className="balance-row">
          {isFetchingQuote ? (
            <span className="balance-text">💱 Fetching quote...</span>
          ) : quoteError ? (
            <span className="balance-text error-text">⚠️ {quoteError}</span>
          ) : toAmount ? (
            <span className="balance-text">✅ Quote from Uniswap</span>
          ) : (
            <span className="balance-text">Enter amount above</span>
          )}
        </div>
      </div>

      {/* Rate Info */}
      <div className="rate-info">
        <div className="rate-row">
          <span>Status</span>
          <span className="rate-value">
            {isSimulating ? '🔄 Simulating...' : simulationResult?.success ? '✅ Ready' : '⏸️ Enter amount'}
          </span>
        </div>
        {simulationResult ? (
          <>
            <div className="rate-row">
              <span>Total Est. Cost</span>
              <span className="rate-value">{getEstimatedCost()}</span>
            </div>
            <div className="rate-row">
              <span>Approval Required</span>
              <span className="rate-value">{simulationResult.metadata?.approvalRequired ? '✓ Yes' : '✗ No'}</span>
            </div>
            <div className="rate-row">
              <span>Steps</span>
              <span className="rate-value">{simulationResult.steps?.length || 0}</span>
            </div>
          </>
        ) : !isSimulating && (
          <>
            <div className="rate-row">
              <span>Bridge Fee</span>
              <span className="rate-value">~0.1%</span>
            </div>
            <div className="rate-row">
              <span>Est. Time</span>
              <span className="rate-value">~2 minutes</span>
            </div>
          </>
        )}
      </div>

      {/* Execution Status */}
      {executionStatus && (
        <div className="execution-status" style={{
          padding: '12px',
          marginBottom: '12px',
          borderRadius: '8px',
          backgroundColor: executionStatus.includes('❌') ? '#fee' : executionStatus.includes('✅') ? '#efe' : '#e3f2fd',
          border: `1px solid ${executionStatus.includes('❌') ? '#fcc' : executionStatus.includes('✅') ? '#cfc' : '#90caf9'}`,
          fontSize: '14px',
          fontWeight: '500',
          textAlign: 'center',
        }}>
          {executionStatus}
        </div>
      )}

      {/* Balance Change Display */}
      {/* {balanceChange && executionResult?.success && (
        <div className="balance-change" style={{
          padding: '12px',
          marginBottom: '12px',
          borderRadius: '8px',
          backgroundColor: '#1e293b',
          border: '1px solid #bae6fd',
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Balance Change</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px' }}>From ({CHAINS.find(c => c.id === fromChain)?.name})</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
              -{fromAmount} {fromToken}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px' }}>To (Base)</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#16a34a' }}>
              +{balanceChange.change} {toToken}
            </span>
          </div>
          {executionResult.executeExplorerUrl && (
            <a 
              href={executionResult.executeExplorerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: '8px',
                fontSize: '12px',
                color: '#2563eb',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              View in Explorer →
            </a>
          )}
        </div>
      )} */}

      {/* Swap Button */}
      <button 
        className="swap-button"
        onClick={handleSwap}
        disabled={!isInitialized() || !fromAmount || isSimulating || !simulationResult?.success || isExecuting}
      >
        {getButtonText()}
      </button>

      {/* Status Modal */}
      <StatusModal
        isOpen={isModalOpen}
        currentStep={currentStep}
        stepStatuses={stepStatuses}
        error={modalError || undefined}
        bridgeTransactionHash={bridgeTransactionHash}
        swapTransactionHash={swapTransactionHash}
        bridgeExplorerUrl={bridgeExplorerUrl}
        swapExplorerUrl={swapExplorerUrl}
        onClose={() => {
          setIsModalOpen(false);
          setIsExecuting(false);
          setStepStatuses({
            bridge: 'pending',
            approval: 'pending',
            swap: 'pending',
          });
          setCurrentStep('bridge');
          setModalError(null);
          setBridgeTransactionHash('');
          setSwapTransactionHash('');
          setBridgeExplorerUrl('');
          setSwapExplorerUrl('');
        }}
      />
    </div>
  );
}


