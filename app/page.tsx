import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Zones from '@/components/landing/Zones';
import Features from '@/components/landing/Features';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      <Header />
      <Hero />
      <Zones />
      <Features />
      <Footer />
    </main>
  );
}
