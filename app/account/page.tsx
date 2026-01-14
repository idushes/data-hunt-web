'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import Header from '@/components/landing/Header';

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

export default function AccountPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [tokens, setTokens] = useState<TokenInfo[]>([]);
    const [addresses, setAddresses] = useState<AddressInfo[]>([]);
    const [newAddress, setNewAddress] = useState('');
    const [chains, setChains] = useState<{ id: string, name: string }[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState('eth');
    const [status, setStatus] = useState<string>('');
    const [account, setAccount] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Update states
    const [updatingProtocols, setUpdatingProtocols] = useState(false);
    const [updatingTokens, setUpdatingTokens] = useState(false);
    const [updatingHistory, setUpdatingHistory] = useState(false);

    // Initial check and fetch
    useEffect(() => {
        const storedToken = localStorage.getItem('data_hunt_token');
        if (!storedToken) {
            router.push('/');
            return;
        }
        setAccessToken(storedToken);
        setLoading(false);

        // Fetch user's current wallet to check against
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

        // Fetch Chains
        const fetchChains = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                const response = await fetch(`${apiUrl}/chains`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setChains(data.sort((a, b) => a.name.localeCompare(b.name)));
                    } else if (typeof data === 'object') {
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

    }, [router]);

    // Data fetching once token is set
    useEffect(() => {
        if (accessToken) {
            fetchTokens(accessToken);
            fetchAddresses(accessToken);
        }
    }, [accessToken]);

    const fetchTokens = async (token: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/tokens`, {
                headers: { 'Authorization': `Bearer ${token}` }
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
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAddresses(data);
            }
        } catch (error) {
            console.error('Failed to fetch addresses', error);
        }
    };

    const logout = async () => {
        if (accessToken) {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                await fetch(`${apiUrl}/web3/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
            } catch (ignore) { }
        }
        localStorage.removeItem('data_hunt_token');
        router.push('/');
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
                setTimeout(() => setStatus(''), 3000);
            } else {
                const data = await response.json();
                setStatus(`Failed to link: ${data.detail || 'Unknown error'}`);
            }
        } catch (error: any) {
            setStatus(`Error: ${error.message}`);
        }
    };

    const toggleAddressAuth = async (targetAddress: string, enable: boolean) => {
        if (!accessToken) return;

        try {
            let signature = null;
            let message = null;

            if (enable) {
                // Check if current wallet matches target
                if (!account || account.toLowerCase() !== targetAddress.toLowerCase()) {
                    // Try switch/connect
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await provider.send("eth_requestAccounts", []);
                    if (accounts.length > 0 && accounts[0].toLowerCase() === targetAddress.toLowerCase()) {
                        setAccount(accounts[0]);
                    } else {
                        setStatus(`Please switch wallet to ${targetAddress} to authorize it.`);
                        return;
                    }
                }

                setStatus('Signing authorization...');
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const signer = await provider.getSigner();

                // Double check signer
                const signerAddress = await signer.getAddress();
                if (signerAddress.toLowerCase() !== targetAddress.toLowerCase()) {
                    setStatus(`Wrong account. Expected ${targetAddress}, got ${signerAddress}`);
                    return;
                }

                message = `Authorize address ${targetAddress}`;
                signature = await signer.signMessage(message);
            }

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
                await fetchAddresses(accessToken);
                setStatus(`Authorization ${enable ? 'enabled' : 'disabled'}`);
                setTimeout(() => setStatus(''), 3000);
            } else {
                const data = await response.json();
                setStatus(`Failed: ${data.detail}`);
            }
        } catch (error: any) {
            setStatus(`Error: ${error.message}`);
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
                const token = tokens.find(t => t.id === tokenId);
                if (token && token.current) {
                    logout();
                } else {
                    fetchTokens(accessToken);
                    setStatus('Session deactivated');
                    setTimeout(() => setStatus(''), 3000);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const copyToken = () => {
        if (accessToken) {
            navigator.clipboard.writeText(accessToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleUpdate = async (type: 'protocols' | 'tokens' | 'history') => {
        if (!accessToken) return;
        
        let endpoint = '';
        let setLocalLoading: (v: boolean) => void;

        switch (type) {
            case 'protocols':
                endpoint = '/debank/all_complex_protocol_list';
                setLocalLoading = setUpdatingProtocols;
                break;
            case 'tokens':
                endpoint = '/debank/all_token_list';
                setLocalLoading = setUpdatingTokens;
                break;
            case 'history':
                endpoint = '/debank/all_history';
                setLocalLoading = setUpdatingHistory;
                break;
        }

        setLocalLoading(true);
        setStatus(`Updating ${type}...`);
        
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                setStatus(`Successfully updated ${type}`);
                setTimeout(() => setStatus(''), 3000);
            } else {
                const data = await response.json();
                setStatus(`Failed to update ${type}: ${data.detail || 'Unknown error'}`);
            }
        } catch (error: any) {
            setStatus(`Error updating ${type}: ${error.message}`);
        } finally {
            setLocalLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-gray-100">
            <Header /> {/* Reusing Header, assuming it handles auth state changes gracefully */}

            <main className="max-w-7xl mx-auto px-6 py-24 space-y-12">
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Account Management
                        </h1>
                        <p className="text-zinc-400 mt-1 text-sm">Manage your linked addresses and active sessions</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={logout}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Status Message */}
                {status && (
                    <div className={`p-4 rounded-lg border ${status.includes('successful') || status.includes('enabled') || status.includes('disabled') ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-200'
                        }`}>
                        {status}
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Linked Addresses */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                            <h2 className="text-xl font-semibold mb-4">Linked Addresses</h2>

                            {/* Link New Address Form */}
                            <div className="flex gap-2 mb-6">
                                <select
                                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
                                    value={selectedNetwork}
                                    onChange={(e) => setSelectedNetwork(e.target.value)}
                                >
                                    {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
                                    value={newAddress}
                                    onChange={(e) => setNewAddress(e.target.value)}
                                />
                                <button
                                    onClick={linkAddress}
                                    disabled={!newAddress}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Link
                                </button>
                            </div>

                            {/* Address List */}
                            <div className="space-y-3">
                                {addresses.map(addr => {
                                    // Identify if this row is the current session address
                                    let isCurrentSession = false;
                                    try {
                                        if (accessToken) {
                                            const payload = JSON.parse(atob(accessToken.split('.')[1]));
                                            const tokenAddr = payload.address || payload.sub;
                                            if (tokenAddr && tokenAddr.toLowerCase() === addr.address.toLowerCase()) {
                                                isCurrentSession = true;
                                            }
                                        }
                                    } catch (e) { }

                                    return (
                                        <div key={addr.id} className="p-4 rounded-xl bg-zinc-950/50 border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                            <div className="overflow-hidden">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                                                        {chains.find(c => c.id === addr.network)?.name || addr.network}
                                                    </span>
                                                    {addr.can_auth ? (
                                                        <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                            AUTH ENABLED
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-zinc-500">AUTH DISABLED</span>
                                                    )}
                                                    {isCurrentSession && (
                                                        <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">CURRENT</span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-sm text-zinc-300 break-all">{addr.address}</p>
                                            </div>

                                            {!isCurrentSession && (
                                                <button
                                                    onClick={() => toggleAddressAuth(addr.address, !addr.can_auth)}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${addr.can_auth
                                                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                        }`}
                                                >
                                                    {addr.can_auth ? 'Disable Auth' : 'Enable Auth'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {addresses.length === 0 && (
                                    <p className="text-zinc-500 text-sm text-center py-4">No addresses linked yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Data Updates */}
                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                            <h2 className="text-xl font-semibold mb-4">Data Updates</h2>
                            <p className="text-sm text-zinc-400 mb-6">
                                Manually trigger data updates for your linked addresses. This may take a few minutes.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={() => handleUpdate('protocols')}
                                    disabled={updatingProtocols}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-zinc-950/50 border border-white/5 hover:bg-zinc-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updatingProtocols ? (
                                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    )}
                                    <span className="text-sm font-medium text-zinc-300">Protocols</span>
                                </button>

                                <button
                                    onClick={() => handleUpdate('tokens')}
                                    disabled={updatingTokens}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-zinc-950/50 border border-white/5 hover:bg-zinc-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updatingTokens ? (
                                        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    <span className="text-sm font-medium text-zinc-300">Tokens</span>
                                </button>

                                <button
                                    onClick={() => handleUpdate('history')}
                                    disabled={updatingHistory}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-zinc-950/50 border border-white/5 hover:bg-zinc-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updatingHistory ? (
                                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    <span className="text-sm font-medium text-zinc-300">History</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="h-fit bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Active Sessions</h2>
                            <button
                                onClick={copyToken}
                                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-300"
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-green-400">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                        </svg>
                                        <span>Copy API Token</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="space-y-3">
                            {tokens.map(token => (
                                <div key={token.id} className={`p-4 rounded-xl border flex justify-between items-center gap-4 ${token.current ? 'bg-zinc-800/40 border-blue-500/30' : 'bg-zinc-950/50 border-white/5'
                                    }`}>
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 mb-1">
                                            {token.current && (
                                                <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">CURRENT SESSION</span>
                                            )}
                                            <span className="text-xs text-zinc-500">
                                                {new Date(token.created_at * 1000).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="font-mono text-xs text-zinc-400 truncate w-full max-w-[200px]">{token.id}</p>
                                    </div>

                                    {!token.current && (
                                        <button
                                            onClick={() => deactivateToken(token.id)}
                                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-900/20 rounded transition-colors"
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
