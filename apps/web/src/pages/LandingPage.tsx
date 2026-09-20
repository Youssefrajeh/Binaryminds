import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { Sections } from "../components/Sections";
import { Footer } from "../components/Footer";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <Nav />
      <Hero />
      <Sections />
      <Footer />
    </div>
  );
}
