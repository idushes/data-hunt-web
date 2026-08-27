'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import Header from '@/components/landing/Header';
import { ACCOUNT_PLANS } from '@/components/account/plans';

interface TokenInfo {
    id: string;
    current: boolean;
    created_at: number;
    is_active: boolean;
    purpose: 'session' | 'sheets';
}

const SHEETS_ACCESS_STORAGE_KEY = 'datahunt:sheets:access:v1';
const AUTH_CHANGED_EVENT = 'data-hunt-auth';

interface AddressInfo {
    id: number;
    address: string;
    network: string;
    can_auth: boolean;
}

interface ChainInfo {
    id: string;
    name: string;
}

interface WindowWithEthereum extends Window {
    ethereum?: ethers.Eip1193Provider;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export default function AccountPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [tokens, setTokens] = useState<TokenInfo[]>([]);
    const [addresses, setAddresses] = useState<AddressInfo[]>([]);
    const [newAddress, setNewAddress] = useState('');
    const [chains, setChains] = useState<ChainInfo[]>([]);
    const [selectedNetwork, setSelectedNetwork] = useState('eth');
    const [status, setStatus] = useState<string>('');
    const [account, setAccount] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    async function fetchTokens(token: string) {
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
    }

    async function fetchAddresses(token: string) {
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
    }

    // Initial check and fetch
    useEffect(() => {
        const initialize = async () => {
            const storedToken = localStorage.getItem('data_hunt_token');
            if (!storedToken) {
                router.push('/');
                return;
            }

            await Promise.resolve();
            setAccessToken(storedToken);
            setLoading(false);

            // Fetch user's current wallet to check against
            const checkWallet = async () => {
                const ethereum = (window as WindowWithEthereum).ethereum;
                if (!ethereum) return;
                try {
                    const provider = new ethers.BrowserProvider(ethereum);
                    const accounts = await provider.send("eth_accounts", []);
                    if (accounts.length > 0) {
                        setAccount(accounts[0]);
                    }
                } catch (e) {
                    console.error("Failed to check wallet connection", e);
                }
            };

            // Fetch Chains
            const fetchChains = async () => {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                    const response = await fetch(`${apiUrl}/chains`);
                    if (response.ok) {
                        const data: unknown = await response.json();
                        if (Array.isArray(data)) {
                            const chainList = data.flatMap((item): ChainInfo[] => {
                                if (!item || typeof item !== 'object') return [];
                                const candidate = item as { id?: unknown; name?: unknown };
                                if (
                                    typeof candidate.id !== 'string' ||
                                    typeof candidate.name !== 'string'
                                ) return [];
                                return [{ id: candidate.id, name: candidate.name }];
                            });
                            setChains(chainList.sort((a, b) => a.name.localeCompare(b.name)));
                        } else if (data && typeof data === 'object') {
                            const chainList = Object.entries(data).map(([k, v]) => {
                                if (typeof v === 'object' && v !== null && 'name' in v) {
                                    const name = (v as { name?: unknown }).name;
                                    return { id: k, name: typeof name === 'string' ? name : String(name) };
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

            await Promise.all([
                checkWallet(),
                fetchChains(),
                fetchTokens(storedToken),
                fetchAddresses(storedToken),
            ]);
            setDataLoading(false);
        };

        void initialize();
    }, [router]);

    const logout = async () => {
        if (accessToken) {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                await fetch(`${apiUrl}/web3/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
            } catch { }
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
        } catch (error: unknown) {
            setStatus(`Error: ${errorMessage(error)}`);
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
                    const ethereum = (window as WindowWithEthereum).ethereum;
                    if (!ethereum) {
                        setStatus('No browser wallet found');
                        return;
                    }
                    const provider = new ethers.BrowserProvider(ethereum);
                    const accounts = await provider.send("eth_requestAccounts", []);
                    if (accounts.length > 0 && accounts[0].toLowerCase() === targetAddress.toLowerCase()) {
                        setAccount(accounts[0]);
                    } else {
                        setStatus(`Please switch wallet to ${targetAddress} to authorize it.`);
                        return;
                    }
                }

                setStatus('Signing authorization...');
                const ethereum = (window as WindowWithEthereum).ethereum;
                if (!ethereum) {
                    setStatus('No browser wallet found');
                    return;
                }
                const provider = new ethers.BrowserProvider(ethereum);
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
        } catch (error: unknown) {
            setStatus(`Error: ${errorMessage(error)}`);
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
                if (token?.purpose === 'sheets') {
                    localStorage.removeItem(SHEETS_ACCESS_STORAGE_KEY);
                    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
                }
                if (token && token.current) {
                    logout();
                } else {
                    fetchTokens(accessToken);
                    setStatus(token?.purpose === 'sheets' ? 'Sheets access revoked' : 'Session deactivated');
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

    if (loading || dataLoading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-12 h-12 border-2 border-blue-500/30 rounded-full"></div>
                        <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-b-purple-500 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                    </div>
                    <p className="text-sm text-zinc-500 animate-pulse">Loading account data...</p>
                </div>
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
                        <p className="text-zinc-400 mt-1 text-sm">Manage your plan, linked addresses, and active sessions</p>
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

                <section aria-labelledby="plans-heading" className="space-y-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                                Freemium access
                            </div>
                            <h2 id="plans-heading" className="text-2xl font-semibold text-white">Plans</h2>
                            <p className="mt-1 text-sm text-zinc-400">
                                Start free. No credit card required.
                            </p>
                        </div>
                        <p className="max-w-md text-xs text-zinc-600 sm:text-right">
                            Preview pricing for the beta. Pro billing is not enabled yet.
                        </p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        {ACCOUNT_PLANS.map((plan) => {
                            const isCurrent = plan.status === 'current';
                            return (
                                <article
                                    key={plan.id}
                                    className={`relative overflow-hidden rounded-2xl border p-6 ${isCurrent
                                        ? 'border-violet-400/35 bg-gradient-to-br from-violet-500/15 via-zinc-900/70 to-blue-500/10 shadow-[0_0_50px_rgba(139,92,246,0.08)]'
                                        : 'border-white/10 bg-zinc-900/40'
                                        }`}
                                >
                                    {isCurrent ? (
                                        <div className="absolute right-4 top-4 rounded-full border border-violet-300/25 bg-violet-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                                            Current plan
                                        </div>
                                    ) : (
                                        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                            Coming soon
                                        </div>
                                    )}

                                    <div className="pr-28">
                                        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                                        <p className="mt-2 min-h-10 text-sm leading-5 text-zinc-400">{plan.description}</p>
                                    </div>

                                    <div className="mt-6 flex items-end gap-2">
                                        <span className="text-4xl font-bold tracking-tight text-white">{plan.price}</span>
                                        <span className="pb-1 text-sm text-zinc-500">{plan.cadence}</span>
                                    </div>

                                    <div className={`mt-5 rounded-xl border px-4 py-3 ${isCurrent
                                        ? 'border-violet-300/20 bg-violet-400/10 text-violet-100'
                                        : 'border-white/10 bg-black/20 text-zinc-200'
                                        }`}>
                                        <p className="text-sm font-semibold">{plan.requestAllowance}</p>
                                        <p className="mt-0.5 text-xs opacity-60">{plan.requestNote}</p>
                                    </div>

                                    <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-2.5">
                                                <span aria-hidden="true" className={isCurrent ? 'text-violet-300' : 'text-zinc-500'}>✓</span>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className={`mt-6 grid h-10 place-items-center rounded-lg text-sm font-semibold ${isCurrent
                                        ? 'border border-violet-300/20 bg-violet-400/15 text-violet-100'
                                        : 'cursor-not-allowed border border-white/10 bg-white/5 text-zinc-600'
                                        }`}>
                                        {isCurrent ? 'Free plan active' : 'Upgrade coming soon'}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

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
                                    } catch { }

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
                                            {token.purpose === 'sheets' && (
                                                <span className="text-[10px] font-bold text-violet-300 bg-violet-900/20 px-1.5 py-0.5 rounded">SHEETS ACCESS</span>
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
