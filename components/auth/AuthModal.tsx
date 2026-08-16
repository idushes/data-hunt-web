'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import {
    isUserRejectedWalletRequest,
    trackFunnelEvent,
} from '@/components/analytics/funnelTracker';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    redirectTo?: string | null;
    onAuthenticated?: () => void;
}

export default function AuthModal({
    isOpen,
    onClose,
    redirectTo,
    onAuthenticated,
}: AuthModalProps) {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (!isOpen) return null;

    const signAndLogin = async () => {
        trackFunnelEvent('login_clicked');
        setStatus('Initializing...');
        setLoading(true);
        let failureRecorded = false;

        try {
            if (typeof window === 'undefined' || !window.ethereum) {
                trackFunnelEvent('wallet_missing');
                setStatus('MetaMask not installed');
                setLoading(false);
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum);

            // Request accounts (connect if not connected)
            setStatus('Requesting wallet connection...');
            let accounts: string[];
            try {
                accounts = await provider.send("eth_requestAccounts", []);
            } catch (error) {
                if (isUserRejectedWalletRequest(error)) {
                    trackFunnelEvent('wallet_connection_rejected');
                } else {
                    trackFunnelEvent('login_failed');
                }
                failureRecorded = true;
                throw error;
            }

            if (accounts.length === 0) {
                trackFunnelEvent('wallet_connection_rejected');
                setStatus('No accounts found');
                setLoading(false);
                return;
            }

            const account = accounts[0];
            setStatus('Signing message...');

            const signer = await provider.getSigner();
            const message = "Login to Data Hunt Web3 Portal";
            let signature: string;
            trackFunnelEvent('signature_requested');
            try {
                signature = await signer.signMessage(message);
            } catch (error) {
                if (isUserRejectedWalletRequest(error)) {
                    trackFunnelEvent('signature_rejected');
                } else {
                    trackFunnelEvent('login_failed');
                }
                failureRecorded = true;
                throw error;
            }

            setStatus('Verifying & Logging in...');

            // Call backend
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hunt.data.lisacorp.com';
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
                trackFunnelEvent('login_succeeded');
                setStatus('Login successful!');
                localStorage.setItem('data_hunt_token', data.access_token);
                window.dispatchEvent(new Event('data-hunt-auth'));

                // Close modal and redirect
                setTimeout(() => {
                    onAuthenticated?.();
                    onClose();
                    if (redirectTo !== null) {
                        router.push(redirectTo ?? '/account');
                    }
                }, 1000);
            } else {
                trackFunnelEvent('login_failed');
                failureRecorded = true;
                setStatus(`Login failed: ${data.detail || 'Unknown error'}`);
            }

        } catch (error: unknown) {
            if (!failureRecorded) {
                // Connection/signature failures were recorded in their scoped handlers.
                // This covers provider and network failures before a response is received.
                trackFunnelEvent('login_failed');
            }
            console.error(error);
            setStatus(`Error: ${error instanceof Error ? error.message : 'Failed to login'}`);
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
                                <span className="transition-transform group-hover:translate-x-0.5">→</span>
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
