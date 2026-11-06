import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { NotFoundState } from "../components/NotFoundState";
import { useAuth } from "../context/AuthContext";

export function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Nav />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <NotFoundState
          backTo={isAuthenticated ? "/marketplace" : "/"}
          backLabel={isAuthenticated ? "Go to Marketplace" : "Back to home"}
        />
      </main>
      <Footer />
    </div>
  );
}
