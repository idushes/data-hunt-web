'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AuthModal from '@/components/auth/AuthModal';
import { hasAdminAccess } from './adminAccess';
import { productTools } from './tools';

function ToolsIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            <rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            <rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            <rect x="14" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            viewBox="0 0 20 20"
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            aria-hidden="true"
        >
            <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ToolsMenu({ compact = false }: { compact?: boolean }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={compact ? 'Open tools menu' : undefined}
                className={
                    compact
                        ? 'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10'
                        : 'inline-flex items-center gap-1.5 transition-colors hover:text-white'
                }
            >
                {compact ? <ToolsIcon /> : <><span>Tools</span><ChevronIcon open={open} /></>}
            </button>

            {open ? (
                <div
                    role="menu"
                    className={`absolute top-full z-50 mt-3 w-72 overflow-hidden rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-2xl shadow-black/70 ${compact ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}
                >
                    {productTools.map((tool) => (
                        <Link
                            key={tool.href}
                            href={tool.href}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                        >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tool.tone} font-bold text-black`}>
                                {tool.name.slice(0, 1)}
                            </span>
                            <span className="min-w-0">
                                <span className="block font-semibold text-white group-hover:text-violet-100">{tool.name}</span>
                                <span className="block truncate text-xs text-zinc-500">{tool.description}</span>
                            </span>
                        </Link>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function Header() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let active = true;
        const checkAuth = async () => {
            const token = localStorage.getItem('data_hunt_token');
            setIsAuthenticated(!!token);
            setIsAdmin(false);
            if (token) {
                const allowed = await hasAdminAccess(token);
                if (active) setIsAdmin(allowed);
            }
        };

        void checkAuth();

        const handleStorage = () => void checkAuth();
        window.addEventListener('storage', handleStorage);
        return () => {
            active = false;
            window.removeEventListener('storage', handleStorage);
        };
    }, [isAuthModalOpen]); // Re-check when modal state changes

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                            D
                        </div>
                        <span className="hidden text-lg font-bold tracking-wide text-white sm:inline">DataHunt</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <Link href="/#sources" className="hover:text-white transition-colors">Sources</Link>
                        <Link href="/#workflow" className="hover:text-white transition-colors">How it works</Link>
                        <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
                        <Link href="/requests" className="hover:text-white transition-colors">Requests</Link>
                        {isAuthenticated ? (
                            <Link href="/links" className="hover:text-white transition-colors">My links</Link>
                        ) : null}
                        <ToolsMenu />
                    </nav>

                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="md:hidden">
                            <ToolsMenu compact />
                        </div>
                        {isAuthenticated ? (
                            <Link
                                href="/links"
                                aria-label="Open copied links"
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 md:hidden"
                            >
                                Links
                            </Link>
                        ) : null}
                        {!isAdmin ? (
                            <Link
                                href="/requests"
                                aria-label="Open feature requests"
                                className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 md:hidden"
                            >
                                Ideas
                            </Link>
                        ) : null}
                        <Link
                            href="/sheets"
                            aria-label="Open Google Sheets helper"
                            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition-all hover:bg-violet-100 sm:px-4"
                        >
                            <span className="sm:hidden">Sheets</span>
                            <span className="hidden sm:inline">Open Sheets helper</span>
                        </Link>
                        {isAdmin ? (
                            <Link
                                href="/admin/analytics"
                                aria-label="Open admin analytics"
                                className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 sm:px-4"
                            >
                                Admin
                            </Link>
                        ) : null}
                        {isAuthenticated ? (
                            <Link
                                href="/account"
                                aria-label="Open account"
                                className="px-3 sm:px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 backdrop-blur-sm flex items-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="hidden sm:inline">Account</span>
                            </Link>
                        ) : (
                            <button
                                onClick={() => setIsAuthModalOpen(true)}
                                className="px-3 sm:px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 backdrop-blur-sm"
                            >
                                <span className="sm:hidden">Login</span>
                                <span className="hidden sm:inline">Log in</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </>
    );
}
