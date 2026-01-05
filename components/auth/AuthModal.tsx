'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (!isOpen) return null;

    const signAndLogin = async () => {
        setStatus('Initializing...');
        setLoading(true);

        try {
            if (typeof window === 'undefined' || !(window as any).ethereum) {
                setStatus('MetaMask not installed');
                setLoading(false);
                return;
            }

            const provider = new ethers.BrowserProvider((window as any).ethereum);

            // Request accounts (connect if not connected)
            setStatus('Requesting wallet connection...');
            const accounts = await provider.send("eth_requestAccounts", []);

            if (accounts.length === 0) {
                setStatus('No accounts found');
                setLoading(false);
                return;
            }

            const account = accounts[0];
            setStatus('Signing message...');

            const signer = await provider.getSigner();
            const message = "Login to Data Hunt Web3 Portal";
            const signature = await signer.signMessage(message);

            setStatus('Verifying & Logging in...');

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
                localStorage.setItem('data_hunt_token', data.access_token);

                // Close modal and redirect
                setTimeout(() => {
                    onClose();
                    router.push('/account');
                }, 1000);
            } else {
                setStatus(`Login failed: ${data.detail || 'Unknown error'}`);
            }

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message || 'Failed to login'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 space-y-6 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Decorative background elements matching the theme */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="text-center space-y-2 relative">
                    <h2 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        Web3 Access
                    </h2>
                    <p className="text-zinc-400 text-sm">
                        Connect and sign to verify ownership
                    </p>
                </div>

                <div className="space-y-4 relative">
                    <button
                        onClick={signAndLogin}
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Processing...
                            </span>
                        ) : (
                            <>
                                <span>Sign & Login With Wallet</span>
                                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                {status && (
                    <div className={`p-3 rounded-lg text-xs text-center border ${status.includes('successful') ? 'bg-green-500/10 border-green-500/20 text-green-200' :
                            status.includes('Error') || status.includes('failed') ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                                'bg-zinc-800/50 border-zinc-700 text-zinc-300'
                        } animate-in fade-in slide-in-from-bottom-2`}>
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
