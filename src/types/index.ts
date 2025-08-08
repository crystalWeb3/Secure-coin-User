export interface WalletInfo {
  address: string;
  balance: string;
  isConnected: boolean;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  balance: string;
}

export interface AllowanceInfo {
  owner: string;
  spender: string;
  amount: string;
}

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  message?: string;
}

export interface ContractAddresses {
  paymentContract: string;
  usdtToken: string;
  admin: string;
} 