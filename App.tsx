import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { ChatInterface } from './pages/ChatInterface';
import { TasksView } from './pages/TasksView';
import { DocumentsView } from './pages/DocumentsView';
import { CalendarView } from './pages/CalendarView';
import { Profile } from './pages/Profile';
import { GalleryView } from './pages/GalleryView';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-jarvis-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-jarvis-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
      <Route path="/" element={<ProtectedRoute><ChatInterface /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><TasksView /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsView /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
      <Route path="/gallery" element={<ProtectedRoute><GalleryView /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}