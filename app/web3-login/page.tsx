'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface TokenInfo {
    id: string;
    current: boolean;
    created_at: number;
    is_active: boolean;
}

interface AddressInfo {
    id: number;
    address: string;
    network: string;
    can_auth: boolean;
}

export default function Web3LoginPage() {
    const [account, setAccount] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [tokens, setTokens] = useState<TokenInfo[]>([]);
    const [addresses, setAddresses] = useState<AddressInfo[]>([]);
    const [newAddress, setNewAddress] = useState('');

    const [chains, setChains] = useState<{ id: string, name: string }[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState('eth'); // Default to Ethereum ID 'eth' as per openapi

    useEffect(() => {
        // Check local storage on mount
        const storedToken = localStorage.getItem('data_hunt_token');
        if (storedToken) {
            setAccessToken(storedToken);
            setStatus('Restored session from local storage');
        }

        // Fetch available chains
        const fetchChains = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                const response = await fetch(`${apiUrl}/chains`);
                if (response.ok) {
                    const data = await response.json();
                    // Assuming data is array of objects or object with chain IDs
                    // Based on openapi summary, let's assume it returns a list of {id, name, ...} or similar.
                    // If it returns a dictionary, we will adapt.
                    // For now, let's handle if it returns an array.
                    if (Array.isArray(data)) {
                        setChains(data.sort((a, b) => a.name.localeCompare(b.name)));
                    } else if (typeof data === 'object') {
                        // If it is an object like { 'eth': 'Ethereum', ... } or similar
                        const chainList = Object.entries(data).map(([k, v]) => {
                            if (typeof v === 'object' && v !== null && 'name' in v) {
                                return { id: k, name: (v as any).name };
                            }
                            return { id: k, name: String(v) };
                        });
                        setChains(chainList.sort((a, b) => a.name.localeCompare(b.name)));
                    }
                }
            } catch (e) {
                console.error("Failed to fetch chains", e);
            }
        };
        fetchChains();

        // Check if wallet is already connected
        const checkWallet = async () => {
            if (typeof window !== 'undefined' && (window as any).ethereum) {
                try {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await provider.send("eth_accounts", []);
                    if (accounts.length > 0) {
                        setAccount(accounts[0]);
                    }
                } catch (e) {
                    console.error("Failed to check wallet connection", e);
                }
            }
        };
        checkWallet();
    }, []);

    const fetchTokens = async (token: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/tokens`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setTokens(data);
            }
        } catch (error) {
            console.error('Failed to fetch tokens', error);
        }
    };

    const fetchAddresses = async (token: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/addresses`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setAddresses(data);
            }
        } catch (error) {
            console.error('Failed to fetch addresses', error);
        }
    };

    useEffect(() => {
        if (accessToken) {
            fetchTokens(accessToken);
            fetchAddresses(accessToken);
        } else {
            setTokens([]);
            setAddresses([]);
        }
    }, [accessToken]);

    const connectWallet = async () => {
        setStatus('Connecting...');
        setLoading(true);
        try {
            if (typeof window === 'undefined' || !(window as any).ethereum) {
                setStatus('MetaMask not installed');
                setLoading(false);
                return;
            }

            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);

            if (accounts.length > 0) {
                setAccount(accounts[0]);
                setStatus('Wallet connected');
            } else {
                setStatus('No accounts found');
            }
        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message || 'Failed to connect'}`);
        } finally {
            setLoading(false);
        }
    };

    const signAndLogin = async () => {
        if (!account) return;

        setStatus('Signing message...');
        setLoading(true);
        setAccessToken(null);

        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            const message = "Login to Data Hunt Web3 Portal";
            const signature = await signer.signMessage(message);

            setStatus('Verifying signature & Logging in...');

            // Call backend
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: account,
                    message: message,
                    signature: signature,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('Login successful!');
                setAccessToken(data.access_token);
                localStorage.setItem('data_hunt_token', data.access_token);
            } else {
                setStatus(`Login failed: ${data.detail || 'Unknown error'}`);
            }

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message || 'Failed to sign/login'}`);
        } finally {
            setLoading(false);
        }
    };

    const deactivateToken = async (tokenId: string) => {
        if (!accessToken) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/deactivate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ token_id: tokenId })
            });

            if (response.ok) {
                // If we deactivated current token, logout
                const token = tokens.find(t => t.id === tokenId);
                if (token && token.current) {
                    logout();
                } else {
                    fetchTokens(accessToken); // Refresh list
                    setStatus('Session deactivated');
                }
            } else {
                setStatus('Failed to deactivate session');
            }
        } catch (error) {
            console.error(error);
            setStatus('Error deactivating session');
        }
    };

    const linkAddress = async () => {
        if (!newAddress || !accessToken) return;

        if (!ethers.isAddress(newAddress)) {
            setStatus('Invalid Ethereum address format');
            return;
        }

        setStatus('Linking address...');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/addresses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    address: newAddress,
                    network: selectedNetwork
                })
            });

            if (response.ok) {
                setNewAddress('');
                await fetchAddresses(accessToken);
                setStatus('Address linked successfully');
            } else {
                const data = await response.json();
                console.error('Link address failed:', data);
                setStatus(`Failed to link: ${data.detail || JSON.stringify(data) || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.error('Link address error:', error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const toggleAddressAuth = async (targetAddress: string, info: AddressInfo, enable: boolean) => {
        if (!accessToken) return;

        try {
            let signature = null;
            let message = null;

            if (enable) {
                // We need to sign a message with the target address to prove ownership
                // First, check if the current wallet account matches the target address
                if (!account || account.toLowerCase() !== targetAddress.toLowerCase()) {
                    // Try to request a switch or just prompt the user
                    setStatus(`Please switch your wallet to account ${targetAddress} to authorize it.`);

                    // Attempt to prompt wallet switch/connect
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await provider.send("eth_requestAccounts", []);
                    if (accounts.length > 0 && accounts[0].toLowerCase() === targetAddress.toLowerCase()) {
                        setAccount(accounts[0]);
                    } else {
                        return; // User didn't switch
                    }
                }

                setStatus('Signing authorization...');
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const signer = await provider.getSigner();

                // Ensure we are signing with the correct address
                const signerAddress = await signer.getAddress();
                if (signerAddress.toLowerCase() !== targetAddress.toLowerCase()) {
                    setStatus(`Wrong account. Expected ${targetAddress}, got ${signerAddress}`);
                    return;
                }

                message = `Authorize address ${targetAddress}`;
                signature = await signer.signMessage(message);
            }

            setStatus(`${enable ? 'Enabling' : 'Disabling'} authorization...`);
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/addresses/${targetAddress}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    enable: enable,
                    signature: signature,
                    message: message
                })
            });

            if (response.ok) {
                fetchAddresses(accessToken);
                setStatus(`Authorization ${enable ? 'enabled' : 'disabled'}`);
            } else {
                const data = await response.json();
                setStatus(`Failed to update auth: ${data.detail}`);
            }

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        }
    };

    const logout = async () => {
        if (accessToken) {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                await fetch(`${apiUrl}/web3/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
            } catch (ignore) {
                // Ignore logout errors
            }
        }

        setAccessToken(null);
        localStorage.removeItem('data_hunt_token');
        setTokens([]);
        setAddresses([]);
        setStatus('Logged out');
    };

    return (
        <div className="min-h-screen bg-black text-gray-100 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 space-y-8 relative overflow-hidden">

                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        Web3 Access
                    </h1>
                    <p className="text-zinc-400 text-sm">
                        Secure authentication via Ethereum signature
                    </p>
                </div>

                <div className="space-y-4">
                    {!account ? (
                        <button
                            onClick={connectWallet}
                            disabled={loading}
                            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? 'Connecting...' : 'Connect Wallet'}
                        </button>
                    ) : !accessToken ? (
                        <div className="space-y-6">
                            <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
                                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Connected Account</p>
                                <p className="text-sm font-mono text-zinc-300 break-all">{account}</p>
                            </div>

                            <button
                                onClick={signAndLogin}
                                disabled={loading}
                                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                            >
                                {loading ? 'Processing...' : 'Sign & Login'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                                <p className="text-green-400 font-semibold mb-2">Authenticated Successfully</p>

                                <div className="mb-3 pb-3 border-b border-green-500/20">
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Current Wallet</p>
                                    {account ? (
                                        <p className="text-sm font-mono text-green-100 break-all">{account}</p>
                                    ) : (
                                        <button
                                            onClick={connectWallet}
                                            disabled={loading}
                                            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                                        >
                                            Connect Wallet
                                        </button>
                                    )}
                                </div>

                                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Access Token</p>
                                <p className="text-xs font-mono text-zinc-300 break-all bg-zinc-950 p-2 rounded max-h-24 overflow-y-auto custom-scrollbar">
                                    {accessToken}
                                </p>
                            </div>

                            {/* Linked Addresses UI */}
                            <div className="space-y-2">
                                <h3 className="text-zinc-400 text-xs uppercase tracking-wider">Linked Addresses</h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {addresses.length === 0 ? (
                                        <div className="p-3 rounded border bg-zinc-900 border-zinc-800 text-xs text-center text-zinc-500 italic">
                                            No additional addresses linked
                                        </div>
                                    ) : (
                                        addresses.map(addr => {
                                            // Determine if this address is the current session address
                                            let isCurrentSession = false;
                                            if (accessToken) {
                                                try {
                                                    const payload = JSON.parse(atob(accessToken.split('.')[1]));
                                                    // Assuming the address is stored in 'sub' or a custom claim 'address'
                                                    // Standard claim 'sub' is usually the user ID or unique identifier. 
                                                    // For web3 auth, often 'sub' is the address or there is an 'address' field.
                                                    // We'll normalize to lowercase for comparison.
                                                    const tokenAddr = payload.address || payload.sub;
                                                    if (tokenAddr && typeof tokenAddr === 'string' && tokenAddr.toLowerCase() === addr.address.toLowerCase()) {
                                                        isCurrentSession = true;
                                                    }
                                                } catch (e) {
                                                    // Ignore parsing errors
                                                }
                                            }

                                            return (
                                                <div key={addr.id} className="p-3 rounded border bg-zinc-900 border-zinc-800 text-xs flex justify-between items-center">
                                                    <div>
                                                        <p className="text-zinc-300 font-mono text-[10px] break-all">{addr.address}</p>
                                                        <div className="flex gap-2 mt-1 flex-wrap">
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                                {chains.find(c => c.id === addr.network)?.name || addr.network}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${addr.can_auth ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                                {addr.can_auth ? 'LOGIN ENABLED' : 'LOGIN DISABLED'}
                                                            </span>
                                                            {isCurrentSession && (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400">
                                                                    CURRENT SESSION
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isCurrentSession && (
                                                        <button
                                                            onClick={() => toggleAddressAuth(addr.address, addr, !addr.can_auth)}
                                                            className={`px-2 py-1 rounded transition-colors text-[10px] ${addr.can_auth ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}`}
                                                        >
                                                            {addr.can_auth ? 'Disable' : 'Enable'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedNetwork}
                                            onChange={(e) => setSelectedNetwork(e.target.value)}
                                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 w-24"
                                        >
                                            {chains.map(chain => (
                                                <option key={chain.id} value={chain.id}>
                                                    {chain.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="0x..."
                                            value={newAddress}
                                            onChange={(e) => setNewAddress(e.target.value)}
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
                                        />
                                    </div>
                                    <button
                                        onClick={linkAddress}
                                        disabled={!newAddress}
                                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-xs disabled:opacity-50 font-medium"
                                    >
                                        Link Address
                                    </button>
                                </div>
                            </div>

                            {/* Active Sessions UI */}
                            <div className="space-y-2">
                                <h3 className="text-zinc-400 text-xs uppercase tracking-wider">Active Sessions</h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {tokens.map(token => (
                                        <div key={token.id} className={`p-3 rounded border text-xs flex justify-between items-center ${token.current ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800'}`}>
                                            <div>
                                                <p className="text-zinc-300 font-mono text-[10px] break-all mb-1">{token.id.substring(0, 16)}...</p>
                                                <div className="flex gap-2">
                                                    <span className="text-zinc-500">{new Date(token.created_at * 1000).toLocaleString()}</span>
                                                    {token.current && <span className="text-green-500 font-bold">CURRENT</span>}
                                                </div>
                                            </div>
                                            {!token.current && (
                                                <button
                                                    onClick={() => deactivateToken(token.id)}
                                                    className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded transition-colors"
                                                >
                                                    Deactivate
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={logout}
                                className="w-full py-3 px-4 bg-zinc-800 text-zinc-300 font-semibold rounded-lg hover:bg-zinc-700 transition-all duration-200"
                            >
                                Logout (Deactivate Current)
                            </button>
                        </div>
                    )}
                </div>

                {status && (
                    <div className={`p-4 rounded-lg text-sm border ${status.includes('successful') || status.includes('enabled') || status.includes('disabled') ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                        status.includes('Error') || status.includes('failed') || status.includes('Wrong') || status.includes('switch') ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                            'bg-zinc-800/50 border-zinc-700 text-zinc-300'
                        }`}>
                        {status}
                    </div>
                )}

            </div>

            <div className="mt-8 text-zinc-600 text-xs text-center max-w-sm">
                <p>By connecting, you agree to sign a message for identity verification. No transaction gas fees are required.</p>
            </div>
        </div>
    );
}
