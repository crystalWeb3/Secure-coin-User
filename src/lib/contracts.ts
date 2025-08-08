import { ethers } from 'ethers';

// Contract addresses from BSC Mainnet deployment
export const CONTRACT_ADDRESSES = {
  paymentContract: '0x11E4e896C6Bc7C39082E79B97722A4C973441556',
  usdtToken: '0x55d398326f99059fF775485246999027B3197955', // Real USDT on BSC Mainnet
  admin: '0x754Cda8029484677F63016b979ed3107056Ef008' // Update this to your admin address
};

// Contract ABIs (matching the actual smart contract)
export const PAYMENT_CONTRACT_ABI = [
  // View functions
  "function getAdmin() view returns (address)",
  "function getUSDTToken() view returns (address)",
  "function getTotalDepositedBNB() view returns (uint256)",
  "function getUserBNBBalance(address user) view returns (uint256)",
  "function getContractBalance() view returns (uint256)",
  
  // State changing functions
  "function depositBNB() payable",
  "function withdrawBNB(uint256 amount)",
  "function chargeUSDT(address user, uint256 amount)",
  "function chargeBNB(address user, uint256 amount)",
  "function updateUSDTToken(address newTokenAddress)",
  "function transferAdmin(address newAdmin)",
  "function recoverToken(address token, uint256 amount)"
];

export const USDT_TOKEN_ABI = [
  // View functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  
  // State changing functions
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

// Network configuration for BSC Mainnet
export const NETWORK_CONFIG = {
  chainId: 56, // BSC Mainnet
  chainName: 'BSC Mainnet',
  rpcUrl: 'https://bsc-dataseed.binance.org/',
  fallbackRpcUrls: [
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/',
    'https://bsc-dataseed4.binance.org/'
  ],
  explorer: 'https://bscscan.com/',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  }
};

// Helper function to get contract instance
export const getContract = (address: string, abi: ethers.ContractInterface) => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      return new ethers.Contract(address, abi, provider.getSigner());
    } catch (error: unknown) {
      console.error('Error creating contract instance:', error);
      return null;
    }
  }
  return null;
};

// Helper function to get payment contract
export const getPaymentContract = () => {
  return getContract(CONTRACT_ADDRESSES.paymentContract, PAYMENT_CONTRACT_ABI);
};

// Helper function to get USDT token contract
export const getUSDTContract = () => {
  return getContract(CONTRACT_ADDRESSES.usdtToken, USDT_TOKEN_ABI);
}; 