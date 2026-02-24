import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// Define types locally if not shared yet, or import from a shared types file
export interface TokenChange {
    token_id: string;
    symbol: string;
    name: string;
    logo_url: string | null;
    amount: number;
    amount_raw: number;
    value_usd: number | null;
    price: number | null;
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

    // Main details
    const mainLogo = tx.project_logo_url || tx.cex_logo_url;
    
    // Determine title
    let mainName = tx.project_name || tx.cex_name;
    if (!mainName) {
        if (tx.tx_name === 'transfer') {
            mainName = 'Transfer';
        } else if (tx.tx_name === 'approve') {
            mainName = 'Approval';
        } else if (tx.tx_name) {
            mainName = tx.tx_name.charAt(0).toUpperCase() + tx.tx_name.slice(1);
        } else {
            mainName = 'Unknown';
        }
    }

    const date = new Date(tx.timestamp * 1000);
    const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Action Category
    const directionLabel = (tx.cate_id || tx.description || 'Action').toUpperCase();
    let directionColorBg = 'bg-zinc-800 text-zinc-300';
    if (tx.cate_id === 'receive') directionColorBg = 'bg-green-500/10 text-green-400 border border-green-500/20';
    else if (tx.cate_id === 'send') directionColorBg = 'bg-red-500/10 text-red-400 border border-red-500/20';
    else if (tx.cate_id === 'swap' || directionLabel === 'SWAP') directionColorBg = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    else if (directionLabel.includes('APPROVE') || directionLabel.includes('REVOKE')) directionColorBg = 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';

    const outgoing = tx.token_changes.filter(t => t.amount <= 0); 
    const incoming = tx.token_changes.filter(t => t.amount > 0);

    const [copied, setCopied] = useState(false);
    const [jsonCopied, setJsonCopied] = useState(false);

    const handleCopy = async () => {
        if (tx.wallet_addr) {
            await navigator.clipboard.writeText(tx.wallet_addr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCopyJson = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(JSON.stringify(tx, null, 2));
        setJsonCopied(true);
        setTimeout(() => setJsonCopied(false), 2000);
    };

    // Helpers
    const formatNumber = (num: number, price: number | null = null) => {
        const abs = Math.abs(num);
        if (abs === 0) return '0';
        if (abs < 0.000001) return '< 0.000001';
        
        // If price is known, format based on token value
        if (price !== null && price > 0) {
            if (price > 50) {
                // High price token (e.g. BTC, ETH): keep precision, do not round aggressively
                return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
            } else if (price < 5) {
                // Low price token (e.g. USDC, Meme coins): can round out decimals if amount is large
                if (abs >= 100) {
                    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
                } else {
                    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
                }
            }
        }
        
        // Default fallback formatting
        if (abs > 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (abs > 10) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
        return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    const formatUsd = (num: number) => {
        const abs = Math.abs(num);
        if (abs === 0) return '$0.00';
        if (abs < 0.01) return '< $0.01';
        return `$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    let primaryUsdValue = 0;
    
    // Explicit determination of USD display mode (+, -, or neutral)
    let usdSignMode: 'positive' | 'negative' | 'neutral' = 'neutral';
    
    if (tx.cate_id === 'send' || directionLabel.includes('SEND')) {
        usdSignMode = 'negative';
        primaryUsdValue = outgoing.reduce((sum, t) => sum + Math.abs(t.value_usd || 0), 0);
    } else if (tx.cate_id === 'receive' || directionLabel.includes('RECEIVE')) {
        usdSignMode = 'positive';
        primaryUsdValue = incoming.reduce((sum, t) => sum + Math.abs(t.value_usd || 0), 0);
    } else if (incoming.length > 0 && outgoing.length > 0) {
        const inUsd = incoming.reduce((sum, t) => sum + Math.abs(t.value_usd || 0), 0);
        const outUsd = outgoing.reduce((sum, t) => sum + Math.abs(t.value_usd || 0), 0);
        
        if (inUsd > 0 && outUsd > 0) {
            const diff = inUsd - outUsd;
            if (Math.abs(diff) > 0.001) {
                usdSignMode = diff > 0 ? 'positive' : 'negative';
                primaryUsdValue = Math.abs(diff);
            } else {
                usdSignMode = 'neutral';
                primaryUsdValue = inUsd;
            }
        } else {
            usdSignMode = 'neutral';
            primaryUsdValue = inUsd || outUsd;
        }
    } else if (incoming.length > 0) {
        usdSignMode = 'positive';
        primaryUsdValue = incoming.reduce((sum, t) => sum + Math.abs(t.value_usd || 0), 0);
    } else if (outgoing.length > 0) {
        usdSignMode = directionLabel.includes('APPROVE') ? 'neutral' : 'negative';
        primaryUsdValue = outgoing.reduce((sum, t) => sum + Math.abs(t.value_usd || 0), 0);
    } else {
        usdSignMode = 'neutral';
        primaryUsdValue = 0;
    }

    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 bg-zinc-900/30 hover:bg-zinc-800/40 border-b border-white/5 transition-colors w-full group text-sm">
            
            {/* 1. Meta (Logo, Title, Type, Date, Chain) */}
            <div className="flex items-center gap-3 md:w-1/3 min-w-[200px] shrink-0">
                <div className="relative shrink-0">
                    {mainLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mainLogo} alt={mainName} className="w-8 h-8 rounded-full object-cover bg-zinc-800/50" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-500 font-bold">
                            {mainName ? mainName.charAt(0).toUpperCase() : '?'}
                        </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-900 text-[8px] font-bold text-white uppercase" title={tx.chain}>
                        {tx.chain.substring(0, 3)}
                    </div>
                </div>
                
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100 truncate text-[15px]">{mainName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0 uppercase ${directionColorBg}`}>
                            {directionLabel.length > 15 ? directionLabel.substring(0,15) : directionLabel}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-zinc-500 mt-0.5">
                        <span className="shrink-0">{dateString} {timeString}</span>
                        <span className="text-zinc-700">•</span>
                        <div
                            onClick={handleCopy}
                            className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                        >
                            <span className="font-mono">
                                {tx.wallet_addr.slice(0, 4)}...{tx.wallet_addr.slice(-4)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Token Flow */}
            <div className="flex-1 flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-hide py-1">
                {/* Outgoing Tokens */}
                {outgoing.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {outgoing.map((t, idx) => (
                            <div 
                                key={idx} 
                                className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded border border-white/5 w-fit cursor-default"
                                title={t.price ? `Price: $${t.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : undefined}
                            >
                                <span className="text-[13px] font-medium text-zinc-300">
                                    {t.amount === 0 && directionLabel.includes('APPROVE') ? '0' : `-${formatNumber(Math.abs(t.amount), t.price)}`}
                                </span>
                                {t.logo_url && (
                                    <img src={t.logo_url} className="w-5 h-5 rounded-full bg-zinc-800 shrink-0" alt={t.symbol} />
                                )}
                                <span className="text-[13px] text-zinc-400">{t.symbol}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Arrow */}
                {outgoing.length > 0 && incoming.length > 0 && (
                    <span className="text-zinc-600 text-[14px] px-1">→</span>
                )}

                {/* Incoming Tokens */}
                {incoming.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {incoming.map((t, idx) => (
                            <div 
                                key={idx} 
                                className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 w-fit cursor-default"
                                title={t.price ? `Price: $${t.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : undefined}
                            >
                                <span className="text-[13px] font-medium text-green-400">
                                    +{formatNumber(t.amount, t.price)}
                                </span>
                                {t.logo_url && (
                                    <img src={t.logo_url} className="w-5 h-5 rounded-full bg-zinc-800 shrink-0" alt={t.symbol} />
                                )}
                                <span className="text-[13px] text-zinc-300">{t.symbol}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Value & Actions */}
            <div className="flex items-center gap-4 shrink-0 text-right min-w-[120px]">
                <div className="flex flex-col items-end justify-center">
                    {primaryUsdValue > 0 ? (
                        <span className={`text-[15px] font-mono font-bold ${
                            usdSignMode === 'positive' ? 'text-green-400' : 
                            usdSignMode === 'negative' ? 'text-zinc-100' : 'text-zinc-200'
                        }`}>
                            {usdSignMode === 'positive' ? '+' : usdSignMode === 'negative' ? '-' : ''}
                            {formatUsd(primaryUsdValue)}
                        </span>
                    ) : (
                        <span className="text-[12px] text-zinc-600 italic">No Value</span>
                    )}
                    
                    {tx.usd_gas_fee !== null && (
                        <span className="text-[11px] text-zinc-500 mt-0.5">
                            Gas: {formatUsd(tx.usd_gas_fee)}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a className="p-1.5 text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors" title="EtherScan/Debank" target="_blank" href={tx.chain === 'eth' ? `https://etherscan.io/tx/${tx.tx_hash}` : `https://debank.com/tx/${tx.tx_hash}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                    </a>
                    <button onClick={() => setShowJson(!showJson)} className={`p-1.5 rounded transition-colors ${showJson ? 'bg-zinc-700 text-white' : 'bg-zinc-800/50 text-zinc-500 hover:text-white hover:bg-zinc-700/50'}`} title="View Code">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* JSON Modal */}
            {showJson && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-default"
                    onClick={(e) => { e.preventDefault(); setShowJson(false); }}
                >
                    <div 
                        className="bg-zinc-900 border border-white/10 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl cursor-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-lg font-semibold text-zinc-100">Transaction Raw Data</h3>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleCopyJson}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition-colors border border-white/10"
                                >
                                    {jsonCopied ? (
                                        <>
                                            <span className="text-green-400">✓</span>
                                            <span>Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" /></svg>
                                            <span>Copy JSON</span>
                                        </>
                                    )}
                                </button>
                                <button onClick={e => { e.stopPropagation(); setShowJson(false); }} className="p-1.5 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-0 overflow-y-auto text-left bg-[#1E1E1E] rounded-b-xl border-t border-black/40">
                            <SyntaxHighlighter 
                                language="json" 
                                style={vscDarkPlus}
                                customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                            >
                                {JSON.stringify(tx, null, 2)}
                            </SyntaxHighlighter>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionRow;
