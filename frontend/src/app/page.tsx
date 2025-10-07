import NavBar from '@/components/Navbar';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Features from '@/components/Features';
import Story from '@/components/Story';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/contexts/AuthContext';

export const dynamic = 'force-static';

function App() {
  return (
    <AuthProvider>
      <main className="relative min-h-screen w-screen overflow-x-hidden">
        <NavBar />
        <Hero />
        <About />
        <Features />
        <Story />
        <Contact />
        <Footer />
      </main>
    </AuthProvider>
  );
}

export default App;
