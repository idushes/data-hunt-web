'use client';

import { useState } from 'react';
import { ethers } from 'ethers';

export default function Web3LoginPage() {
    const [account, setAccount] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [verificationResult, setVerificationResult] = useState<any>(null);

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
        setVerificationResult(null);

        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            const message = "Login to Data Hunt Web3 Portal";
            const signature = await signer.signMessage(message);

            setStatus('Verifying signature...');

            // Call backend
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
            const response = await fetch(`${apiUrl}/web3/verify`, {
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
                setStatus('Verification successful!');
                setVerificationResult(data);
            } else {
                setStatus(`Verification failed: ${data.detail || 'Unknown error'}`);
            }

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message || 'Failed to sign/login'}`);
        } finally {
            setLoading(false);
        }
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
                    ) : (
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
                    )}
                </div>

                {status && (
                    <div className={`p-4 rounded-lg text-sm border ${status.includes('successful') ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                        status.includes('Error') || status.includes('failed') ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                            'bg-zinc-800/50 border-zinc-700 text-zinc-300'
                        }`}>
                        {status}
                    </div>
                )}

                {verificationResult && (
                    <div className="mt-4 p-4 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono space-y-2 overflow-x-auto">
                        <div className="flex justify-between border-b border-zinc-800 pb-2 mb-2">
                            <span className="text-zinc-500">API Response</span>
                            <span className="text-green-500">200 OK</span>
                        </div>
                        <pre className="text-zinc-400">
                            {JSON.stringify(verificationResult, null, 2)}
                        </pre>
                    </div>
                )}

            </div>

            <div className="mt-8 text-zinc-600 text-xs text-center max-w-sm">
                <p>By connecting, you agree to sign a message for identity verification. No transaction gas fees are required.</p>
            </div>
        </div>
    );
}
