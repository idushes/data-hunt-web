import Link from "next/link";

export default function Footer() {
    return (
        <footer className="border-t border-white/5 bg-black py-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-semibold text-white">DataHunt</p>
                    <p className="mt-1 text-sm text-zinc-600">Crypto → Sheets</p>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-zinc-500">
                    <Link href="/sheets" className="transition-colors hover:text-white">Sheets helper</Link>
                    <Link href="/requests" className="transition-colors hover:text-white">Feature requests</Link>
                    <span className="text-zinc-700">Tools:</span>
                    <Link href="/gmtrade" className="transition-colors hover:text-white">GMTrade</Link>
                    <Link href="/raydium" className="transition-colors hover:text-white">Raydium</Link>
                    <Link href="/uniswap" className="transition-colors hover:text-white">Uniswap</Link>
                    <a href="https://hunt.data.lisacorp.com/docs" className="transition-colors hover:text-white">API docs</a>
                    <span>&copy; {new Date().getFullYear()}</span>
                </div>
            </div>
        </footer>
    );
}
