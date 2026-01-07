'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/landing/Header';
import TransactionRow, { Transaction } from '@/components/history/TransactionRow';

const LIMIT_OPTIONS = [25, 50, 100, 200];

export default function HistoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Params
    const skipParam = searchParams.get('skip');
    const skip = skipParam ? parseInt(skipParam, 10) : 0;

    const limitParam = searchParams.get('limit');
    let limit = limitParam ? parseInt(limitParam, 10) : 25;
    if (!LIMIT_OPTIONS.includes(limit)) limit = 25; // fallback

    useEffect(() => {
        const storedToken = localStorage.getItem('data_hunt_token');
        if (!storedToken) {
            router.push('/');
            return;
        }
        setAccessToken(storedToken);
    }, [router]);

    useEffect(() => {
        if (!accessToken) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://0.0.0.0:8111';
                const res = await fetch(`${apiUrl}/debank/history/readable?skip=${skip}&limit=${limit}&include_scam=false`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (res.ok) {
                    const data: Transaction[] = await res.json();
                    setTransactions(data);
                    if (data.length < limit) {
                        setHasMore(false);
                    } else {
                        setHasMore(true);
                    }
                } else {
                    console.error('Failed to fetch history');
                }
            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [accessToken, skip, limit]);

    const handleLimitChange = (newLimit: number) => {
        router.push(`/history?skip=0&limit=${newLimit}`);
    };

    const handleNext = () => {
        const newSkip = skip + limit;
        router.push(`/history?skip=${newSkip}&limit=${limit}`);
    };

    const handlePrevious = () => {
        const newSkip = Math.max(0, skip - limit);
        router.push(`/history?skip=${newSkip}&limit=${limit}`);
    };

    return (
        <div className="min-h-screen bg-black text-gray-100">
            <Header />

            <main className="max-w-7xl mx-auto px-4 md:px-6 py-24 space-y-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Transaction History
                        </h1>
                        <p className="text-zinc-400 mt-1 text-sm">View all your cross-chain activity</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={limit}
                            onChange={(e) => handleLimitChange(Number(e.target.value))}
                            className="bg-zinc-900 border border-zinc-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 text-white"
                        >
                            {LIMIT_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt} per page</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : transactions.length > 0 ? (
                    <div className="space-y-2">
                        {transactions.map((tx) => (
                            <TransactionRow key={`${tx.tx_hash}-${tx.chain}-${tx.wallet_addr}`} tx={tx} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-zinc-500">
                        No transactions found.
                    </div>
                )}

                {/* Pagination */}
                <div className="flex justify-center items-center gap-4 pt-8">
                    <button
                        onClick={handlePrevious}
                        disabled={skip === 0 || loading}
                        className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        Previous
                    </button>
                    <span className="text-xs text-zinc-500 font-mono">
                        Page {Math.floor(skip / limit) + 1}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={!hasMore || loading}
                        className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        Next
                    </button>
                </div>
            </main>
        </div>
    );
}
