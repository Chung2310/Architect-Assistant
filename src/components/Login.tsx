import React, { useState } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }
    if (isSignUp && !displayName) {
      setError("Vui lòng nhập tên hiển thị.");
      return;
    }
    
    try {
      setError(null);
      if (isSignUp) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
      navigate('/home');
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Đăng nhập hoặc đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-br from-surface via-surface-container-low to-primary/5">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-white/60 backdrop-blur-xl shadow-sm shadow-[#0f172a]/5 flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-primary font-bold text-xl tracking-tighter">iGen</span>
          <span className="text-on-surface font-manrope text-sm font-semibold tracking-tight">- Trợ lý AI cho Kiến trúc sư</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-slate-500 hover:bg-slate-100 transition-colors p-2 rounded-lg">
            <Icon name="language" />
            <span className="text-xs font-medium">VN</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md">
          {/* Glassmorphic Card */}
          <div className="bg-surface-container-lowest shadow-2xl shadow-on-surface/5 rounded-xl p-8 md:p-12 relative overflow-hidden">
            {/* Brand Anchor & Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
                <Icon name="architecture" className="text-primary text-3xl" />
              </div>
              <h1 className="text-on-surface font-headline text-2xl font-semibold mb-2">iGen - Trợ lý AI cho Kiến trúc sư</h1>
              <p className="text-on-surface-variant font-body text-sm">
                {isSignUp ? 'Tạo tài khoản mới để bắt đầu' : 'Chào mừng bạn trở lại với không gian sáng tạo iGen'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
                {error}
              </div>
            )}

            {/* Form Section */}
            <form className="space-y-6" onSubmit={handleEmailAuth}>
              {isSignUp && (
                <div>
                  <label className="block text-on-surface-variant font-label text-xs mb-2 px-1">Tên hiển thị của bạn</label>
                  <input 
                    className="w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3.5 px-4 text-on-surface placeholder:text-slate-400 transition-all outline-none" 
                    placeholder="Nguyen Van A" 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-on-surface-variant font-label text-xs mb-2 px-1">Địa chỉ email của bạn</label>
                <input 
                  className="w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3.5 px-4 text-on-surface placeholder:text-slate-400 transition-all outline-none" 
                  placeholder="email@gmail.com" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2 px-1">
                  <label className="block text-on-surface-variant font-label text-xs">Mật khẩu của bạn</label>
                  {!isSignUp && <a className="text-primary font-label text-[10px] hover:underline" href="#">Quên mật khẩu?</a>}
                </div>
                <div className="relative">
                  <input 
                    className="w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-3.5 px-4 text-on-surface placeholder:text-slate-400 transition-all outline-none" 
                    placeholder="••••••••" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="pt-2">
                <button className="w-full bg-[#0F172A] text-white font-label text-sm font-semibold py-4 rounded-full hover:bg-slate-800 active:scale-[0.98] transition-all duration-200" type="submit">
                  {isSignUp ? 'Đăng ký' : 'Đăng nhập'}
                </button>
              </div>
            </form>

            {/* Footer Text */}
            <div className="mt-8 text-center">
              <p className="text-on-surface-variant font-body text-xs">
                {isSignUp ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
                <button 
                  type="button"
                  className="text-primary font-semibold hover:underline" 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                >
                  {isSignUp ? 'Đăng nhập' : 'Đăng ký ngay'}
                </button>
              </p>
            </div>

            {/* Subtle Decorative Background Element */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
          </div>

          {/* Supporting Footer Info */}
          <div className="mt-12 text-center space-y-4">
            <div className="flex justify-center gap-8 text-[10px] text-slate-400 font-label tracking-wider uppercase">
              <a className="hover:text-primary transition-colors" href="#">Điều khoản</a>
              <a className="hover:text-primary transition-colors" href="#">Chính sách bảo mật</a>
              <a className="hover:text-primary transition-colors" href="#">Trợ giúp</a>
            </div>
            <p className="text-[10px] text-slate-300 font-body">© 2024 iGen AI Architecture. All rights reserved.</p>
          </div>
        </div>
      </main>
      <div className="h-12"></div>
    </div>
  );
};
