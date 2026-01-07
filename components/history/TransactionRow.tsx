import React, { useState } from 'react';

// Define types locally if not shared yet, or import from a shared types file
export interface TokenChange {
    token_id: string;
    symbol: string;
    name: string;
    logo_url: string | null;
    amount: number;
    amount_raw: number;
    value_usd: number;
    price: number;
}

export interface Transaction {
    tx_hash: string;
    chain: string;
    timestamp: number;
    date_time: string;
    cate_id: string | null;
    tx_name: string;
    project_id: string | null;
    project_name: string | null;
    project_logo_url: string | null;
    cex_id: string | null;
    cex_name: string | null;
    cex_logo_url: string | null;
    wallet_addr: string;
    other_addr: string;
    usd_gas_fee: number | null;
    eth_gas_fee: number | null;
    token_changes: TokenChange[];
    description: string;
    is_scam: boolean;
}

interface TransactionRowProps {
    tx: Transaction;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ tx }) => {
    const [showJson, setShowJson] = useState(false);

    // Determine the main icon to show (Project > CEX > Default Chain/Tx Type)
    const mainLogo = tx.project_logo_url || tx.cex_logo_url;
    const mainName = tx.project_name || tx.cex_name || tx.tx_name || 'Unknown';

    // Format Date
    const date = new Date(tx.timestamp * 1000);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const dateString = `${day}-${month}-${year}`;
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Determine direction color/label based on cate_id or token changes
    const directionLabel = tx.cate_id || tx.description;
    let directionColor = 'text-zinc-400';

    if (tx.cate_id === 'receive') {
        directionColor = 'text-green-400';
    } else if (tx.cate_id === 'send') {
        directionColor = 'text-red-400';
    } else if (tx.tx_name === 'swap' || tx.description === 'Swap') {
        directionColor = 'text-blue-400';
    }

    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (tx.wallet_addr) {
            await navigator.clipboard.writeText(tx.wallet_addr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex flex-col gap-1 p-2 rounded-xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-800/50 transition-colors">
            <div className="flex flex-col md:flex-row gap-2 w-full">
                {/* Left: Time & Type */}
                <div className="flex items-start gap-4 md:w-1/4 min-w-[180px]">
                    <div className="flex flex-col">
                        <span className="text-sm font-mono text-zinc-400">{dateString}</span>
                        <span className="text-xs text-zinc-600">{timeString}</span>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            {mainLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mainLogo} alt={mainName} className="w-5 h-5 rounded-full" />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">?</div>
                            )}
                            <span className="text-sm font-medium text-zinc-200 truncate max-w-[120px]">{mainName}</span>
                        </div>
                        <span className={`text-xs font-medium uppercase mt-0.5 ${directionColor}`}>
                            {directionLabel}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono mt-1 break-all truncate w-24">
                            {tx.tx_hash.slice(0, 6)}...{tx.tx_hash.slice(-4)}
                        </span>
                    </div>
                </div>

                {/* Middle: Chain, Wallet & Gas */}
                <div className="hidden md:flex flex-col md:w-1/6 space-y-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-500 uppercase bg-white/5 px-1.5 py-0.5 rounded">{tx.chain}</span>
                    </div>

                    {/* Wallet Address Copy */}
                    <div
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 cursor-pointer group bg-white/5 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors w-fit"
                        title={tx.wallet_addr}
                    >
                        <span className="text-xs text-zinc-500 uppercase">
                            ...{tx.wallet_addr.slice(-4)}
                        </span>
                        {copied ? (
                            <span className="text-[8px] text-green-400 font-medium">✓</span>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 text-zinc-600 group-hover:text-blue-400 transition-colors">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" />
                            </svg>
                        )}
                    </div>

                    {tx.usd_gas_fee !== null && (
                        <span className="text-[10px] text-zinc-600">
                            Gas: ${tx.usd_gas_fee.toFixed(2)}
                        </span>
                    )}
                </div>

                {/* Right: Token Changes */}
                <div className="flex-1 flex flex-col gap-1">
                    {tx.token_changes.map((change, idx) => {
                        const isPositive = change.amount > 0;
                        const directionColor = isPositive ? 'text-green-400' : 'text-red-400';
                        const sign = isPositive ? '+' : '';

                        return (
                            <div key={idx} className="flex items-center justify-between text-sm bg-black/20 py-1 px-2 rounded-lg">
                                <div className="flex items-center gap-2">
                                    {change.logo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={change.logo_url} alt={change.symbol} className="w-5 h-5 rounded-full" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-zinc-800" />
                                    )}
                                    <div className="flex flex-col">
                                        <span className="font-medium text-zinc-200">{change.symbol}</span>
                                        {change.price > 0 && <span className="text-[10px] text-zinc-500">${change.price.toLocaleString()}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`font-mono font-medium ${directionColor}`}>
                                        {change.value_usd !== 0
                                            ? (() => {
                                                const val = Math.abs(change.value_usd);
                                                const digits = val < 1 ? 2 : 0;
                                                return `${sign}$${val.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
                                            })()
                                            : '$0'
                                        }
                                    </span>
                                    {/* Token Amount (Secondary, Gray) */}
                                    <span className="text-xs text-zinc-500">
                                        {change.amount}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Actions: JSON Toggle */}
                <div className="flex items-start">
                    <button
                        onClick={() => setShowJson(!showJson)}
                        className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                        title="View Raw JSON"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* JSON View */}
            {showJson && (
                <div className="w-full mt-2 p-2 bg-black rounded-lg border border-zinc-800 overflow-x-auto">
                    <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                        {JSON.stringify(tx, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default TransactionRow;
