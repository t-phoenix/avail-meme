import '../styles/StatusModal.css';

export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'error';

interface StatusModalProps {
  isOpen: boolean;
  currentStep: 'bridge' | 'approval' | 'swap';
  stepStatuses: {
    bridge: StepStatus;
    approval: StepStatus;
    swap: StepStatus;
  };
  error?: string;
  bridgeTransactionHash?: string;
  swapTransactionHash?: string;
  bridgeExplorerUrl?: string;
  swapExplorerUrl?: string;
  onClose?: () => void;
}

export default function StatusModal({
  isOpen,
  stepStatuses,
  error,
  bridgeTransactionHash,
  swapTransactionHash,
  bridgeExplorerUrl,
  swapExplorerUrl,
  onClose,
}: StatusModalProps) {
  if (!isOpen) return null;

  const getStepIcon = (status: StepStatus) => {
    if (status === 'completed') {
      return '✓';
    }
    if (status === 'error') {
      return '✗';
    }
    if (status === 'in-progress') {
      return (
        <svg className="spinner" viewBox="0 0 24 24" width="20" height="20">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeDasharray="31.416"
            strokeDashoffset="31.416"
            strokeLinecap="round"
          >
            <animate
              attributeName="stroke-dasharray"
              dur="1.5s"
              values="0 31.416;15.708 15.708;0 31.416;0 31.416"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dashoffset"
              dur="1.5s"
              values="0;-15.708;-31.416;-31.416"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      );
    }
    return '';
  };

    const steps = [
    { key: 'bridge', label: 'Bridging tokens to Base', status: stepStatuses.bridge },
    { key: 'approval', label: 'Approving token for swap', status: stepStatuses.approval },
    { key: 'swap', label: 'Executing swap', status: stepStatuses.swap },
  ];

  const allCompleted = steps.every(s => s.status === 'completed');
  const hasError = error || steps.some(s => s.status === 'error');

  return (
    <div className="status-modal-overlay">
      <div className="status-modal">
        <div className="status-modal-header">
          <h3>Transaction Status</h3>
          {(hasError || allCompleted) && (
            <button className="modal-close-button" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        <div className="status-modal-content">
          <div className="steps-list">
            {steps.map((step) => (
              <div
                key={step.key}
                className={`step-item ${step.status === 'in-progress' ? 'active' : ''} ${
                  step.status === 'completed' ? 'completed' : ''
                } ${step.status === 'error' ? 'error' : ''}`}
              >
                <div className="step-icon">
                  {getStepIcon(step.status)}
                </div>
                <div className="step-content">
                  <div className="step-label">{step.label}</div>
                  {step.status === 'in-progress' && (
                    <div className="step-description">
                      {step.key === 'bridge' && 'Transferring your tokens to Base network...'}
                      {step.key === 'approval' && 'Granting permission for the swap contract...'}
                      {step.key === 'swap' && 'Swapping tokens on Uniswap...'}
                    </div>
                  )}
                  {step.status === 'completed' && step.key === 'swap' && (
                    <div className="step-description success">
                      Your tokens have been successfully swapped!
                    </div>
                  )}
                  {step.status === 'error' && (
                    <div className="step-description error">
                      This step encountered an error
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasError && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error || 'An error occurred during the transaction'}</span>
            </div>
          )}

          {allCompleted && !hasError && (
            <div className="transaction-complete-section">
              <div className="success-message">
                <span className="success-icon">🎉</span>
                <span>Transaction completed successfully!</span>
              </div>
              
              {(bridgeExplorerUrl || swapExplorerUrl) && (
                <div className="transaction-links">
                  <h4 className="transaction-links-title">View Transactions:</h4>
                  
                  {bridgeExplorerUrl && (
                    <a 
                      href={bridgeExplorerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="transaction-link bridge-link"
                    >
                      <span className="link-icon">🌉</span>
                      <span className="link-text">Bridge Transaction</span>
                      {bridgeTransactionHash && (
                        <span className="link-hash">
                          {bridgeTransactionHash.slice(0, 8)}...{bridgeTransactionHash.slice(-6)}
                        </span>
                      )}
                      <span className="link-arrow">→</span>
                    </a>
                  )}
                  
                  {swapExplorerUrl && (
                    <a 
                      href={swapExplorerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="transaction-link swap-link"
                    >
                      <span className="link-icon">💱</span>
                      <span className="link-text">Swap Transaction</span>
                      {swapTransactionHash && (
                        <span className="link-hash">
                          {swapTransactionHash.slice(0, 8)}...{swapTransactionHash.slice(-6)}
                        </span>
                      )}
                      <span className="link-arrow">→</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
