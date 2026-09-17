import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { Sections } from "./components/Sections";

function App() {
  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <Nav />
      <Hero />
      <Sections />
      <Footer />
    </div>
  );
}

export default App;
