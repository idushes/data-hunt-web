export default function Footer() {
    return (
        <footer className="py-12 border-t border-white/5 bg-black">
            <div className="max-w-7xl mx-auto px-6 text-center">
                <p className="text-gray-600 mb-4">
                    &copy; {new Date().getFullYear()} DataHunt. All rights reserved.
                </p>
                <div className="flex justify-center gap-6 text-sm text-gray-500">
                    <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-white transition-colors">Twitter</a>
                </div>
            </div>
        </footer>
    );
}
