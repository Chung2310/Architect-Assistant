import React from 'react';
import { Icon } from './Icon';

export const Promo: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-surface via-surface-container-low to-primary/5 p-6">
      {/* Promotion Card */}
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-[0px_48px_48px_rgba(15,23,42,0.04)] overflow-hidden relative">
        {/* Decorative Architectural Mesh Overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none texture-grid-pattern"></div>
        
        <div className="relative p-10 md:p-16 flex flex-col items-center text-center">
          {/* Partnership Branding Section */}
          <div className="flex flex-col items-center gap-8 mb-10 w-full">
            <div className="flex items-center gap-6 md:gap-10">
              <div className="flex flex-col items-center">
                <span className="text-primary font-extrabold text-3xl md:text-4xl tracking-tighter">iGen</span>
              </div>
              <div className="h-8 w-[1px] bg-outline-variant/30 rotate-12"></div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-2xl md:text-3xl tracking-tight text-[#4285F4]">G</span>
                <span className="font-bold text-2xl md:text-3xl tracking-tight text-[#EA4335]">o</span>
                <span className="font-bold text-2xl md:text-3xl tracking-tight text-[#FBBC05]">o</span>
                <span className="font-bold text-2xl md:text-3xl tracking-tight text-[#4285F4]">g</span>
                <span className="font-bold text-2xl md:text-3xl tracking-tight text-[#34A853]">l</span>
                <span className="font-bold text-2xl md:text-3xl tracking-tight text-[#EA4335]">e</span>
              </div>
            </div>
            <div className="inline-flex items-center px-4 py-1.5 bg-on-surface text-white rounded-full">
              <Icon name="verified" className="text-[16px] mr-2" fill />
              <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase">ĐỐI TÁC CHIẾN LƯỢC CỦA GOOGLE</span>
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-4 mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-on-surface leading-tight font-headline">
              Chương trình hợp tác cùng <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span><span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span>
            </h1>
            <p className="text-on-surface-variant text-lg max-w-md mx-auto leading-relaxed">
              Nhập mã đối tác của iGen do Google cung cấp để nhận $300 Credits
            </p>
          </div>

          {/* Action Form */}
          <div className="w-full max-w-md space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Icon name="confirmation_number" className="text-slate-400" />
              </div>
              <input 
                className="w-full pl-14 pr-6 py-5 bg-surface-container-low border border-outline-variant/20 rounded-xl text-on-surface placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all duration-300" 
                placeholder="Dán mã tại đây..." 
                type="text" 
              />
            </div>
            <button className="w-full py-5 px-8 bg-gradient-to-r from-primary to-[#006877] text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3">
              <span>Xác nhận mã và nhận $300 Credits</span>
              <Icon name="arrow_forward" />
            </button>
          </div>

          {/* Additional Info/Footer inside card */}
          <div className="mt-12 pt-8 border-t border-outline-variant/10 w-full flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-2">
              <Icon name="info" className="text-[14px]" />
              <span>Áp dụng cho tài khoản mới</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hover:text-primary cursor-pointer transition-colors">Điều khoản</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Bảo mật</span>
            </div>
          </div>
        </div>
      </div>

      {/* Background Visual Accents */}
      <div className="fixed top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-1/4 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <footer className="fixed bottom-0 w-full px-8 py-4 flex justify-center text-[10px] uppercase tracking-widest text-slate-400/50 pointer-events-none">
        Powered by iGen Intelligence Engine & Google Cloud Platform
      </footer>
    </div>
  );
};
