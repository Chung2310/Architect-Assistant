import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { HomeScreen } from './components/HomeScreen';
import { TextureLab } from './components/TextureLab';
import { HumanEnhancer } from './components/HumanEnhancer';
import { VirtualStaging } from './components/VirtualStaging';
import { Visual } from './components/Visual';
import { Render } from './components/Render';
import { Video } from './components/Video';
import { Login } from './components/Login';
import { Promo } from './components/Promo';
import { AdminPanel } from './components/AdminPanel';
import { ApiKeySetup } from './components/ApiKeySetup';
import { Toaster } from 'sonner';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      setHasApiKey(!!user.hasSetupApiKey);
    } else {
      setHasApiKey(null);
    }
  }, [user]);

  const handleSetupComplete = async () => {
    if (user) {
      setHasApiKey(true);
      await refreshUser();
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path.startsWith('/') ? path : `/${path}`);
  };

  if (authLoading || (user && hasApiKey === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Login screen has its own layout/nav in the design
  if (location.pathname === '/login') {
    if (user) {
      return hasApiKey ? <Navigate to="/home" replace /> : <Navigate to="/setup-api-key" replace />;
    }
    return <Login onNavigate={handleNavigate} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // API Key setup screen has its own layout
  if (location.pathname === '/setup-api-key') {
    if (hasApiKey) {
      return <Navigate to="/home" replace />;
    }
    return <ApiKeySetup onSetupComplete={handleSetupComplete} />;
  }

  if (!hasApiKey) {
    return <Navigate to="/setup-api-key" replace />;
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <Layout currentScreen={location.pathname} onNavigate={handleNavigate}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<Login onNavigate={handleNavigate} />} />
          <Route path="/setup-api-key" element={<ApiKeySetup onSetupComplete={handleSetupComplete} />} />
          <Route path="/home" element={<HomeScreen onNavigate={handleNavigate} />} />
          <Route path="/tools/texture-lab" element={<TextureLab />} />
          <Route path="/tools/human-enhancer" element={<HumanEnhancer />} />
          <Route path="/tools/virtual-staging" element={<VirtualStaging />} />
          <Route path="/tools/visual" element={<Visual />} />
          <Route path="/tools/rendering" element={<Render />} />
          <Route path="/tools/video" element={<Video />} />
          <Route path="/promo" element={<Promo />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
