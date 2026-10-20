import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Navbar } from './components/Navbar';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MyPetsPage } from './pages/MyPetsPage';
import { NewPetPage } from './pages/NewPetPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicationPage } from './pages/PublicationPage';
import { RegisterPage } from './pages/RegisterPage';

export function AppRoutes() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/publications/:id" element={<PublicationPage />} />
          <Route path="/my-pets" element={<RequireAuth><MyPetsPage /></RequireAuth>} />
          <Route path="/pets/new" element={<RequireAuth><NewPetPage /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route
            path="*"
            element={
              <p>
                Page not found. <Link to="/">Go home</Link>
              </p>
            }
          />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
