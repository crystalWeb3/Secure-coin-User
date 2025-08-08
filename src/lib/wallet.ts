import { ethers } from "ethers";

export interface WalletInfo {
  address: string;
  chainId: number;
  isConnected: boolean;
}

export class WalletService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;

  async connectWallet(): Promise<WalletInfo> {
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error(
          "No wallet detected. Please install MetaMask or another wallet."
        );
      }

      // Request account access
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const account = accounts[0];

      // Create provider and signer
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();

      // Get network
      const network = await this.provider.getNetwork();
      const chainId = network.chainId;

      // Check if connected to BSC Mainnet
      if (chainId !== 56) {
        await this.switchToBSCMainnet();
      }

      return {
        address: account,
        chainId: chainId,
        isConnected: true,
      };
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw error;
    }
  }

  async switchToBSCMainnet(): Promise<void> {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No wallet detected");
    }

    try {
      // Try to switch to BSC Mainnet
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }], // 56 in hex
      });
    } catch (switchError: unknown) {
      // This error code indicates that the chain has not been added to MetaMask
      if (
        typeof switchError === "object" &&
        switchError !== null &&
        "code" in switchError &&
        (switchError as { code: number }).code === 4902
      ) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x38", // 56 in hex
                chainName: "Binance Smart Chain",
                nativeCurrency: {
                  name: "BNB",
                  symbol: "BNB",
                  decimals: 18,
                },
                rpcUrls: ["https://bsc-dataseed.binance.org/"],
                blockExplorerUrls: ["https://bscscan.com/"],
              },
            ],
          });
        } catch (addError) {
          throw new Error("Failed to add BSC Mainnet to wallet");
        }
      } else {
        throw new Error("Failed to switch to BSC Mainnet");
      }
    }
  }

  async disconnectWallet(): Promise<void> {
    this.provider = null;
    this.signer = null;
  }

  getProvider(): ethers.providers.Web3Provider | null {
    return this.provider;
  }

  getSigner(): ethers.Signer | null {
    return this.signer;
  }
}

export const walletService = new WalletService();
