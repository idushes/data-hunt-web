'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthModal from '@/components/auth/AuthModal';

export default function Header() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        // Check auth status on mount and when modal closes
        const checkAuth = () => {
            const token = localStorage.getItem('data_hunt_token');
            setIsAuthenticated(!!token);
        };

        checkAuth();

        // Listen for storage events (logout in other tabs)
        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);
    }, [isAuthModalOpen]); // Re-check when modal state changes

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
                            D
                        </div>
                        <span className="text-lg font-bold tracking-wide text-white">DataHunt</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <Link href="/#zones" className="hover:text-white transition-colors">Zones</Link>
                        <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
                        <Link href="/#security" className="hover:text-white transition-colors">Security</Link>
                    </nav>

                    <div className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <Link
                                href="/account"
                                className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 backdrop-blur-sm flex items-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Account
                            </Link>
                        ) : (
                            <button
                                onClick={() => setIsAuthModalOpen(true)}
                                className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 backdrop-blur-sm"
                            >
                                Sign & Login
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
