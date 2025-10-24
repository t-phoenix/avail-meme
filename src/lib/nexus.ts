import { NexusSDK } from "@avail-project/nexus-core";

export const sdk = new NexusSDK({ network: "mainnet" });

const NEXUS_INIT_KEY = 'nexus_initialized';

// Thin wrapper that calls sdk.isInitialized() from the SDK
export function isInitialized() {
  return sdk.isInitialized();
}

// Check if SDK was previously initialized (from localStorage)
export function wasPreviouslyInitialized() {
  return localStorage.getItem(NEXUS_INIT_KEY) === 'true';
}

export async function initializeWithProvider(provider: any) {
  if (!provider) throw new Error("No EIP-1193 provider (e.g., MetaMask) found");

  //If the SDK is already initialized, return
  if (sdk.isInitialized()) return;

  //If the SDK is not initialized, initialize it with the provider passed as a parameter
  await sdk.initialize(provider);
  
  // Store initialization state in localStorage
  localStorage.setItem(NEXUS_INIT_KEY, 'true');
}

export async function deinit() {
  //If the SDK is not initialized, return
  if (!sdk.isInitialized()) return;

  //If the SDK is initialized, de-initialize it
  await sdk.deinit();
  
  // Clear initialization state from localStorage
  localStorage.removeItem(NEXUS_INIT_KEY);
}

export async function getUnifiedBalances() {
  //Get the unified balances from the SDK
  return await sdk.getUnifiedBalances();
}
