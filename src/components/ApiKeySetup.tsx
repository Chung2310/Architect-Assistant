import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { toast } from 'sonner';

interface ApiKeySetupProps {
  onSetupComplete?: () => void;
}

export const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onSetupComplete }) => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error('Vui lòng nhập mã iGen của bạn');
      return;
    }

    setIsSubmitting(true);
    try {
      // Gọi API cập nhật API key (mã iGen) của chính mình
      await apiClient.patch("/api/v1/users/me/api-key", {
        apiKey: code.trim(),
      });
      
      if (onSetupComplete) onSetupComplete();
      navigate('/home', { replace: true });
    } catch (error: any) {
      console.error("Error during setup:", error);
      toast.error(error.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f0f9ff] to-[#f8fafc] p-6 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#06b6d4] tracking-tight mb-4">iGen</h1>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Chào mừng bạn đến với iGen</h2>
        <p className="text-slate-500 text-lg">Hãy thiết lập tài khoản của bạn.</p>
      </div>

      <div className="max-w-2xl w-full bg-white rounded-2xl p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
        <div className="mb-8">
          <label className="block text-base font-bold text-slate-800 mb-3">
            Nhập mã iGen của bạn tại đây:
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Nhập mã iGen của bạn"
            className="w-full bg-slate-50 border border-slate-200 focus:border-[#0ea5e9] focus:ring-1 focus:ring-[#0ea5e9] rounded-xl p-3.5 text-sm text-slate-700 outline-none transition-all"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 px-6 bg-[#0ea5e9] hover:bg-[#0284c7] text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            "Xác nhận & Tiếp tục tới Bảng điều khiển"
          )}
        </button>
      </div>
    </div>
  );
};
