import { parseUnits, formatUnits, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import type { 
  BridgeAndExecuteParams, 
  BridgeAndExecuteSimulationResult,
  BridgeAndExecuteResult,
  BridgeParams,
  BridgeResult,
  SUPPORTED_TOKENS,
  SUPPORTED_CHAINS_IDS 
} from '@avail-project/nexus-core';
import { sdk } from './nexus';
import { BASE_CHAIN_ID, TO_TOKENS } from './chains';

interface SimulateSwapParams {
  fromAmount: string;
  fromToken: string;
  fromChain: number;
  toToken: string;
  userAddress: `0x${string}`;
}

// Uniswap V3 contracts on Base
const UNISWAP_V3_QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

// Token addresses on Base
const TOKEN_ADDRESSES = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: WETH_BASE,
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
} as const;

const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
const SUPPORTED_TOKENS = ['ETH', 'USDC', 'USDT'];
const SUPPORTED_CHAINS = [1, 10, 137, 42161, 43114, 8453, 534352, 50104, 8217, 56, 999];

const basePublicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org', {
    timeout: 10_000,
    retryCount: 3,
  }),
});

// QuoterV2 ABI for quoteExactInputSingle
const QUOTER_ABI = [{
  inputs: [{
    components: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
    name: 'params',
    type: 'tuple',
  }],
  name: 'quoteExactInputSingle',
  outputs: [
    { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
    { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
    { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
    { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
  ],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const;

const getTokenDecimals = (token: string) => (token === 'USDC' || token === 'USDT' ? 6 : 18);

const getTokenAddress = (token: string): string => {
  return TOKEN_ADDRESSES[token as keyof typeof TOKEN_ADDRESSES] || TOKEN_ADDRESSES.ETH;
};

/**
 * Get quote from Uniswap V3 for the expected output amount
 */
export async function getUniswapQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  feeTier?: number;
}): Promise<{ amountOut: bigint; success: boolean; error?: string; feeTierUsed?: number }> {
  const { tokenIn, tokenOut, amountIn, feeTier } = params;

  if (tokenIn.toLowerCase() === TOKEN_ADDRESSES.ETH.toLowerCase() || 
      tokenOut.toLowerCase() === TOKEN_ADDRESSES.ETH.toLowerCase()) {
    return {
      amountOut: BigInt(0),
      success: false,
      error: 'Invalid token address - use WETH instead of ETH placeholder'
    };
  }

  const feetiersToTry = feeTier ? [feeTier] : FEE_TIERS;

  for (const fee of feetiersToTry) {
    try {
      const result = await basePublicClient.readContract({
        address: UNISWAP_V3_QUOTER_V2 as `0x${string}`,
        abi: QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          amountIn,
          fee,
          sqrtPriceLimitX96: BigInt(0),
        }],
      }) as readonly [bigint, bigint, number, bigint];

      return { amountOut: result[0], success: true, feeTierUsed: fee };
    } catch (error) {
      if (fee === feetiersToTry[feetiersToTry.length - 1]) {
        return { 
          amountOut: BigInt(0), 
          success: false, 
          error: error instanceof Error ? error.message : 'No liquidity pool found' 
        };
      }
    }
  }

  return { amountOut: BigInt(0), success: false, error: 'No liquidity pool found' };
}

// Uniswap V3 Router ABI
const ROUTER_ABI = [{
  inputs: [{
    components: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    internalType: 'struct ISwapRouter.ExactInputSingleParams',
    name: 'params',
    type: 'tuple',
  }],
  name: 'exactInputSingle',
  outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
  stateMutability: 'payable',
  type: 'function',
}];

export async function simulateBridgeAndExecute(
  params: SimulateSwapParams
): Promise<BridgeAndExecuteSimulationResult | null> {
  const { fromAmount, fromToken, fromChain, toToken, userAddress } = params;

  if (!SUPPORTED_TOKENS.includes(fromToken)) {
    console.error(`Token ${fromToken} not supported`);
    return null;
  }
  
  if (!SUPPORTED_CHAINS.includes(fromChain)) {
    console.error(`Chain ${fromChain} not supported`);
    return null;
  }

  try {
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    if (!toTokenData) {
      console.error(`Token ${toToken} not found`);
      return null;
    }

    const bridgedTokenAddress = getTokenAddress(fromToken);

    const bridgeParams: BridgeAndExecuteParams = {
      token: fromToken as any,
      amount: fromAmount, // Keep in human-readable format, SDK handles conversion
      toChainId: BASE_CHAIN_ID,
      sourceChains: [fromChain],
      recipient: userAddress,
      execute: {
        contractAddress: UNISWAP_V3_ROUTER,
        contractAbi: ROUTER_ABI as any,
        functionName: 'exactInputSingle',
        buildFunctionParams: (
          _token: SUPPORTED_TOKENS,
          amount: string,
          _chainId: SUPPORTED_CHAINS_IDS,
          userAddress: `0x${string}`
        ) => {

          // Router expects a single struct parameter, not separate parameters
          const amountWithDecimals = Number(amount) * 10 ** getTokenDecimals(fromToken);
          return {
            functionParams: [{
              tokenIn: bridgedTokenAddress,
              tokenOut: toTokenData.address,
              fee: BigInt(10000), // 1% fee tier for memecoins
              recipient: userAddress,
              amountIn: BigInt(amountWithDecimals), // amount is in wei from bridge
              amountOutMinimum: BigInt(0),
              sqrtPriceLimitX96: BigInt(0),
            }],
          };
        },
        tokenApproval: {
          token: fromToken as any,
          amount: fromAmount, // Human-readable format
        },
      },
      waitForReceipt: true,
    } as BridgeAndExecuteParams;
    // console.log('Bridge Params:', JSON.stringify(bridgeParams.execute, null, 2));

    const simulation = await sdk.simulateBridgeAndExecute(bridgeParams);
    console.log('Simulation RAW:', JSON.stringify(simulation, null, 2));
    console.log('Simulation complete:', simulation.success ? '✅' : '❌');
    return simulation;
  } catch (error) {
    console.error('Simulation failed:', error);
    return null;
  }
}

export async function executeBridgeAndSwap(
  params: SimulateSwapParams
): Promise<BridgeAndExecuteResult | null> {
  const { fromAmount, fromToken, fromChain, toToken, userAddress } = params;

  if (!SUPPORTED_TOKENS.includes(fromToken)) {
    console.error(`Token ${fromToken} not supported`);
    return null;
  }
  
  if (!SUPPORTED_CHAINS.includes(fromChain)) {
    console.error(`Chain ${fromChain} not supported`);
    return null;
  }

  try {
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    if (!toTokenData) {
      console.error(`Token ${toToken} not found`);
      return null;
    }

    const bridgedTokenAddress = getTokenAddress(fromToken);

    const bridgeParams: BridgeAndExecuteParams = {
      token: fromToken as any,
      amount: fromAmount, // Keep in human-readable format, SDK handles conversion
      toChainId: BASE_CHAIN_ID,
      sourceChains: [fromChain],
      recipient: userAddress,
      execute: {
        contractAddress: UNISWAP_V3_ROUTER,
        contractAbi: ROUTER_ABI as any,
        functionName: 'exactInputSingle',
        buildFunctionParams: (
          _token: SUPPORTED_TOKENS,
          amount: string,
          _chainId: SUPPORTED_CHAINS_IDS,
          userAddress: `0x${string}`
        ) => {
          // Router expects a single struct parameter, not separate parameters
          const amountWithDecimals = Number(amount) * 10 ** getTokenDecimals(fromToken);
          return {
            functionParams: [{
              tokenIn: bridgedTokenAddress,
              tokenOut: toTokenData.address,
              fee: BigInt(10000), // 1% fee tier for memecoins
              recipient: userAddress,
              amountIn: BigInt(amountWithDecimals), // amount is in wei from bridge
              amountOutMinimum: BigInt(0),
              sqrtPriceLimitX96: BigInt(0),
            }],
          };
        },
        tokenApproval: {
          token: fromToken as any,
          amount: fromAmount, // Human-readable format
        },
      },
      waitForReceipt: true,
      receiptTimeout: 300000, // 5 minutes
    } as BridgeAndExecuteParams;
    
    console.log('Executing Bridge and Swap...');
    // console.log('Bridge Params:', JSON.stringify(bridgeParams.execute, null, 2));

    const result = await sdk.bridgeAndExecute(bridgeParams);
    
    console.log('Execution Result:', JSON.stringify(result, null, 2));
    console.log('Execution complete:', result.success ? '✅' : '❌');
    
    if (result.success) {
      console.log('Bridge Transaction Hash:', result.bridgeTransactionHash);
      console.log('Execute Transaction Hash:', result.executeTransactionHash);
      if (result.executeExplorerUrl) {
        console.log('Explorer URL:', result.executeExplorerUrl);
      }
    } else {
      console.error('Execution failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Bridge and Execute failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    } as BridgeAndExecuteResult;
  }
}

interface ExecuteBridgeThenSwapParams extends SimulateSwapParams {
  onBridgeStart?: () => void;
  onBridgeComplete?: () => void;
  onApprovalStart?: () => void;
  onApprovalComplete?: () => void;
  onSwapStart?: () => void;
  onSwapComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * Execute bridge then swap - Two separate operations
 * First bridges tokens to Base, then executes the swap on Base
 * This is the recommended approach when bridgeAndExecute is not working
 */
export async function executeBridgeThenSwap(
  params: ExecuteBridgeThenSwapParams
): Promise<BridgeAndExecuteResult | null> {
  const { 
    onBridgeStart,
    onBridgeComplete,
    onApprovalStart,
    onApprovalComplete,
    onSwapStart,
    onSwapComplete,
    onError,
  } = params;
  const { fromAmount, fromToken, fromChain, toToken, userAddress } = params;

  if (!SUPPORTED_TOKENS.includes(fromToken)) {
    console.error(`Token ${fromToken} not supported`);
    return null;
  }
  
  if (!SUPPORTED_CHAINS.includes(fromChain)) {
    console.error(`Chain ${fromChain} not supported`);
    return null;
  }

  try {
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    if (!toTokenData) {
      console.error(`Token ${toToken} not found`);
      return null;
    }

    const bridgedTokenAddress = getTokenAddress(fromToken);

    // STEP 1: Bridge tokens to Base
    console.log('🌉 Step 1: Bridging tokens to Base...');
    onBridgeStart?.();
    
    const bridgeParams: BridgeParams = {
      token: fromToken as any,
      amount: fromAmount,
      chainId: BASE_CHAIN_ID,
      sourceChains: [fromChain]
    } as BridgeParams;

    console.log('Bridge Params:', JSON.stringify(bridgeParams, null, 2));
    
    let bridgeResult: BridgeResult;
    try {
      bridgeResult = await sdk.bridge(bridgeParams);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Bridge failed';
      onError?.(errorMsg);
      console.error('Bridge failed:', error);
      return {
        success: false,
        error: errorMsg,
      } as BridgeAndExecuteResult;
    }
    
    console.log('Bridge Result:', JSON.stringify(bridgeResult, null, 2));
    console.log('Bridge complete:', bridgeResult.success ? '✅' : '❌');

    if (!bridgeResult.success) {
      const errorMsg = bridgeResult.error || 'Bridge transaction failed';
      onError?.(errorMsg);
      console.error('Bridge failed:', bridgeResult.error);
      return {
        success: false,
        error: errorMsg,
      } as BridgeAndExecuteResult;
    }

    if (bridgeResult.explorerUrl) {
      console.log('Bridge Explorer URL:', bridgeResult.explorerUrl);
    }

    onBridgeComplete?.();

    // Wait a bit for the bridge to fully settle
    console.log('⏳ Waiting for bridge to settle...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds

    // STEP 2: Execute swap on Base (includes approval + swap)
    console.log('💱 Step 2: Executing swap on Base...');
    onApprovalStart?.();
    
    const executeParams = {
      toChainId: BASE_CHAIN_ID,
      contractAddress: UNISWAP_V3_ROUTER,
      contractAbi: ROUTER_ABI as any,
      functionName: 'exactInputSingle',
      buildFunctionParams: (
        token: SUPPORTED_TOKENS,
        amount: string,
        _chainId: SUPPORTED_CHAINS_IDS,
        _userAddress: `0x${string}`
      ) => {
        const decimals = getTokenDecimals(token);
        const amountWei = parseUnits(amount, decimals);
        
        console.log('🔧 buildFunctionParams called:', {
          token,
          amount,
          amountWei: amountWei.toString(),
          tokenIn: bridgedTokenAddress,
          tokenOut: toTokenData.address,
          recipient: userAddress,
        });
        
        return {
          functionParams: [{
            tokenIn: bridgedTokenAddress,
            tokenOut: toTokenData.address,
            fee: Number(10000), // 1% fee tier for memecoins
            recipient: userAddress,
            amountIn: Number(amountWei),
            amountOutMinimum: Number(0),
            sqrtPriceLimitX96: Number(0),
          }],
        };
      },
      waitForReceipt: true,
      tokenApproval: {
        token: fromToken as any,
        amount: fromAmount,
      },
    };

    console.log('Execute Params:', JSON.stringify({
      ...executeParams,
      contractAbi: '[ABI]' // Don't log full ABI
    }, null, 2));

    // SDK internally handles both approval and swap atomically
    // During SDK execution, both transactions happen back-to-back:
    // 1. User is prompted for approval transaction
    // 2. User is prompted for swap transaction
    // Since we can't get callbacks during SDK execution, we'll keep swap as in-progress
    // during the entire SDK call, then mark both complete afterwards
    
    let executeResult: any;
    try {
      // Start swap as in-progress before SDK execute
      // This way both show as in-progress during SDK execution
      onSwapStart?.();
      
      executeResult = await sdk.execute(executeParams as any);
      console.log('Execute Result:', executeResult);
      console.log('Execute complete: ✅');
      
      // After SDK completes, mark approval complete, then swap complete
      onApprovalComplete?.(); // Approval gets tick
      await new Promise(resolve => setTimeout(resolve, 200));
      onSwapComplete?.(); // Swap gets tick
    } catch (executeError) {
      const errorMsg = executeError instanceof Error ? executeError.message : 'Swap execution failed';
      onError?.(errorMsg);
      console.error('Execute failed:', executeError);
      return {
        success: false,
        error: errorMsg,
        bridgeTransactionHash: bridgeResult.transactionHash,
      } as BridgeAndExecuteResult;
    }

    // Extract transaction details from executeResult
    const executeTransactionHash = executeResult?.transactionHash || executeResult?.txHash || executeResult?.hash;
    const executeExplorerUrl = executeResult?.explorerUrl || executeResult?.blockExplorerUrl;

    if (executeTransactionHash) {
      console.log('Execute Transaction Hash:', executeTransactionHash);
    }
    if (executeExplorerUrl) {
      console.log('Execute Explorer URL:', executeExplorerUrl);
    }

    // Return combined result
    return {
      success: true,
      bridgeTransactionHash: bridgeResult.transactionHash,
      executeTransactionHash: executeTransactionHash,
      bridgeExplorerUrl: bridgeResult.explorerUrl,
      executeExplorerUrl: executeExplorerUrl,
    } as BridgeAndExecuteResult;

  } catch (error) {
    console.error('Bridge Then Swap failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    } as BridgeAndExecuteResult;
  }
}

export function getFormattedReceiveAmount(
  simulation: BridgeAndExecuteSimulationResult | null,
  toToken: string
): string {
  if (!simulation?.metadata?.bridgeReceiveAmount) return '';

  const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
  return formatUnits(
    BigInt(simulation.metadata.bridgeReceiveAmount),
    toTokenData?.decimals || 18
  );
}

/**
 * Get a quick quote for swapping on Base
 */
export async function getSwapQuoteOnBase(params: {
  fromToken: 'ETH' | 'USDC' | 'USDT';
  fromAmount: string;
  toToken: string;
  feeTier?: number;
}): Promise<{ outputAmount: string; success: boolean; error?: string; feeTierUsed?: number }> {
  const { fromToken, fromAmount, toToken, feeTier } = params;

  try {
    const tokenInAddress = fromToken === 'ETH' ? TOKEN_ADDRESSES.WETH : getTokenAddress(fromToken);
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    
    if (!toTokenData) {
      return { outputAmount: '0', success: false, error: 'Token not found' };
    }

    const amountInWei = parseUnits(fromAmount, getTokenDecimals(fromToken));
    const quote = await getUniswapQuote({
      tokenIn: tokenInAddress,
      tokenOut: toTokenData.address,
      amountIn: amountInWei,
      feeTier,
    });

    if (!quote.success) {
      return { outputAmount: '0', success: false, error: quote.error };
    }

    const outputAmount = formatUnits(quote.amountOut, toTokenData.decimals);
    return { outputAmount, success: true, feeTierUsed: quote.feeTierUsed };
  } catch (error) {
    return { 
      outputAmount: '0', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
