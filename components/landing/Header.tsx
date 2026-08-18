'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthModal from '@/components/auth/AuthModal';
import { hasAdminAccess } from './adminAccess';

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
                        <Link href="/requests" className="hover:text-white transition-colors">Requests</Link>
                        {isAuthenticated ? (
                            <Link href="/links" className="hover:text-white transition-colors">My links</Link>
                        ) : null}
                        <Link href="/gmtrade" className="hover:text-white transition-colors">GMTRADE</Link>
                    </nav>

                    <div className="flex items-center gap-3 sm:gap-4">
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
                                <span className="hidden sm:inline">Sign & Login</span>
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
