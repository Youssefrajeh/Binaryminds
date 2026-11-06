import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router";
import { AuthProvider } from "./context/AuthProvider";
import { SocketProvider } from "./context/SocketProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";
import { PageTitle } from "./components/PageTitle";
import { SkipLink } from "./components/SkipLink";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LandingPage } from "./pages/LandingPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyPage } from "./pages/VerifyPage";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ProfilePage } from "./pages/ProfilePage";
import { EditProfilePage } from "./pages/EditProfilePage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { MembersPage } from "./pages/MembersPage";
import { StudyGroupsPage } from "./pages/StudyGroupsPage";
import { TermsPage } from "./pages/TermsPage";
import { AboutPage } from "./pages/AboutPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { CreateListingPage } from "./pages/CreateListingPage";
import { ListingDetailsPage } from "./pages/ListingDetailsPage";
import { LostFoundPage } from "./pages/LostFoundPage";
import { CreateLostFoundPage } from "./pages/CreateLostFoundPage";
import { EventsPage } from "./pages/EventsPage";
import { RoleRoute } from "./components/RoleRoute";

const EventFormPage = lazy(() => import("./pages/EventFormPage").then((module) => ({ default: module.EventFormPage })));
const MessagesPage = lazy(() => import("./pages/MessagesPage").then((module) => ({ default: module.MessagesPage })));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage").then((module) => ({ default: module.AdminUsersPage })));
const AdminReportsPage = lazy(() => import("./pages/AdminReportsPage").then((module) => ({ default: module.AdminReportsPage })));
const EventManagementPage = lazy(() => import("./pages/EventManagementPage").then((module) => ({ default: module.EventManagementPage })));
const FileLibraryPage = lazy(() => import("./pages/FileLibraryPage").then((module) => ({ default: module.FileLibraryPage })));
const StudyGroupDetailsPage = lazy(() => import("./pages/StudyGroupDetailsPage").then((module) => ({ default: module.StudyGroupDetailsPage })));

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageTitle />
      <SkipLink />
      <AuthProvider>
        <SocketProvider>
          <Suspense fallback={<p role="status" className="min-h-screen bg-canvas p-10 text-center text-ink-soft">Loading page...</p>}>
          <Routes>
            <Route path="/admin" element={<RoleRoute roles={["ADMINISTRATOR"]}><Navigate to="/admin/reports" replace /></RoleRoute>} />
            <Route path="/admin/users" element={<RoleRoute roles={["ADMINISTRATOR"]}><AdminUsersPage /></RoleRoute>} />
            <Route path="/admin/reports" element={<RoleRoute roles={["ADMINISTRATOR"]}><AdminReportsPage /></RoleRoute>} />
            <Route path="/events/manage" element={<RoleRoute roles={["ORGANIZER", "ADMINISTRATOR"]}><EventManagementPage /></RoleRoute>} />
            <Route path="/study-groups/:id" element={<ProtectedRoute><StudyGroupDetailsPage /></ProtectedRoute>} />
            <Route path="/files" element={<ProtectedRoute><FileLibraryPage /></ProtectedRoute>} />
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <EditProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/u/:userId"
              element={
                <ProtectedRoute>
                  <PublicProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <MembersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/study-groups"
              element={
                <ProtectedRoute>
                  <StudyGroupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute>
                  <MarketplacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace/new"
              element={
                <ProtectedRoute>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace/:id/edit"
              element={
                <ProtectedRoute>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace/:id"
              element={
                <ProtectedRoute>
                  <ListingDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lost-found"
              element={
                <ProtectedRoute>
                  <LostFoundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lost-found/new"
              element={
                <ProtectedRoute>
                  <CreateLostFoundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <EventsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/new"
              element={
                <ProtectedRoute>
                  <EventFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/:id/edit"
              element={
                <ProtectedRoute>
                  <EventFormPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
