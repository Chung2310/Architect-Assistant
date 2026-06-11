import React, { useState } from 'react';
import { Icon } from './Icon';

export const Visual: React.FC = () => {
  const [projectType, setProjectType] = useState('apartment');
  const [quality, setQuality] = useState(75);
  const [aspectRatio, setAspectRatio] = useState('1:1');

  return (
    <div className="h-full flex flex-col lg:flex-row p-6 gap-8 bg-surface">
      {/* Left Workspace Area */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Top Toggle Navigation */}
        <div className="flex justify-center">
          <div className="bg-surface-container-low p-1.5 rounded-full flex items-center shadow-sm">
            <button className="px-8 py-2.5 rounded-full bg-white shadow-sm text-on-surface font-semibold text-sm transition-all">Render</button>
            <button className="px-8 py-2.5 rounded-full text-on-surface-variant hover:text-on-surface font-medium text-sm transition-all">Edit</button>
            <button className="px-8 py-2.5 rounded-full text-on-surface-variant hover:text-on-surface font-medium text-sm transition-all">Mood</button>
          </div>
        </div>
        {/* Main Viewport */}
        <div className="flex-1 relative rounded-xl overflow-hidden bg-slate-900 group min-h-[500px]">
          <img 
            className="w-full h-full object-cover opacity-80" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfYR7ZKVhfzsJEttn28fnSSW-nrS_4k2teL_Ae1_1fir2kRQWnWx5tHFVKKAleOuYgd7m06RaiHhrouViuHC_wYhbkBKBVLVd5h_VH-Jr7ab1WCpw2D2t2Ct384LtSv4qrUaZR6W6PltWAJvEfeuSGoXdWOw_SdgCJsbVu4bM-szqtTOBnV86AWD31b3zY9BKJdWvzqDEFF0qtDMXroYj4rc8S029c86Kx4_8y1f4e5EKP68Nob83rb3SDP_uQ2jzM27XEGtt6pVPW" 
            alt="Architecture"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
          <div className="absolute top-6 left-6 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-white text-xs font-semibold tracking-wide uppercase">AI VISUAL ENGINE ACTIVE</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md px-6">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto border border-white/20">
                <Icon name="light_mode" className="text-white text-3xl" />
              </div>
              <h2 className="text-white text-2xl font-bold">Chỉnh sửa Ánh sáng & Mood</h2>
              <p className="text-white/70 text-sm leading-relaxed">Kéo và thả tệp mô hình của bạn hoặc chọn một góc nhìn để bắt đầu quá trình tạo dựng hình ảnh thực tế với AI.</p>
              <button className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95">Bắt đầu ngay</button>
            </div>
          </div>
          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center">
            <div className="flex gap-2">
              <button className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                <Icon name="zoom_in" className="text-lg" />
              </button>
              <button className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                <Icon name="3d_rotation" className="text-lg" />
              </button>
            </div>
            <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 text-xs font-medium border border-white/5">
              Camera 01: Phối cảnh nội thất
            </div>
          </div>
        </div>
      </div>

      {/* Right Settings Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        <div className="bg-surface-container-lowest rounded-xl p-8 flex flex-col gap-8 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-on-surface font-bold text-lg">Cài đặt Visual</h3>
            <Icon name="tune" className="text-slate-400" />
          </div>
          {/* Project Type */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loại dự án</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'apartment', name: 'Chung cư cao cấp', icon: 'apartment' },
                { id: 'house', name: 'Nhà phố / Biệt thự', icon: 'home' },
                { id: 'office', name: 'Văn phòng / Studio', icon: 'storefront' }
              ].map(type => (
                <button 
                  key={type.id}
                  onClick={() => setProjectType(type.id)}
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    projectType === type.id 
                    ? 'bg-surface-container-low border border-primary/20 text-primary font-semibold' 
                    : 'hover:bg-surface-container-low text-on-surface-variant font-medium'
                  } text-sm`}
                >
                  <span className="flex items-center gap-3">
                    <Icon name={type.icon} className="text-lg" />
                    {type.name}
                  </span>
                  {projectType === type.id && <Icon name="check_circle" className="text-sm" />}
                </button>
              ))}
            </div>
          </div>
          {/* Quality */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chất lượng</label>
              <span className="text-xs font-bold text-primary">{quality === 100 ? 'MASTER' : quality === 75 ? '2K QHD' : 'DRAFT'}</span>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full">
              <div className="absolute h-full bg-gradient-to-r from-primary to-[#5ee6ff] rounded-full" style={{ width: `${quality}%` }}></div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="25"
                value={quality} 
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md pointer-events-none" style={{ left: `${quality}%`, marginLeft: '-8px' }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>DRAFT</span>
              <span>FINAL</span>
              <span>MASTER</span>
            </div>
          </div>
          {/* Aspect Ratio */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tỷ lệ khung hình</label>
            <div className="flex gap-3">
              {[
                { id: '1:1', icon: 'crop_square' },
                { id: '16:9', icon: 'crop_landscape' },
                { id: '4:5', icon: 'crop_portrait' }
              ].map(ratio => (
                <button 
                  key={ratio.id}
                  onClick={() => setAspectRatio(ratio.id)}
                  className={`flex-1 aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                    aspectRatio === ratio.id ? 'border-primary text-primary' : 'border-slate-100 text-slate-400 hover:border-slate-200'
                  }`}
                >
                  <Icon name={ratio.icon} />
                  <span className="text-[10px] font-bold">{ratio.id}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <button className="w-full bg-[#0F172A] text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors active:scale-95 duration-200">
              <Icon name="auto_awesome" className="text-lg" />
              Generate Visual
            </button>
            <p className="text-center text-[10px] text-slate-400 mt-4 leading-relaxed">Thời gian render dự kiến: ~45 giây<br/>Sử dụng GPU T4 kiến trúc thế hệ mới</p>
          </div>
        </div>
        {/* Secondary Module: Quick Presets */}
        <div className="bg-surface-container-low rounded-xl p-6 flex flex-col gap-4">
          <h4 className="text-on-surface font-bold text-sm">Presets Ánh sáng</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 rounded-lg bg-white overflow-hidden relative cursor-pointer group">
              <img className="w-full h-full object-cover group-hover:scale-110 transition-transform" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAx6u2XePaWIWl88MaHLW5-W2z-MuFl2NTF2c29Nh7RK-yElo3yFKN79zADZ9Ry3QIWN5Ta4D5tFujA6HRqbC_obWmAgzsIxWWoDozpwtPsP1twAYgOwVKYHB1P2Dg7jw3D_4Bc93za-mriv3irhrG9UnblilUqR74qUWgQTULtXtsdyjis2i_hBlJTpsnysTxnOEAyuWB2VVkInaVDEwYuNTeD1OfSTm9woap-q4t6nOCdEmcRSbe-_GhkGa71fFiFXRuC4huGsbRB" alt="Golden Hour" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/20 flex items-end p-2">
                <span className="text-white text-[10px] font-bold uppercase">Golden Hour</span>
              </div>
            </div>
            <div className="h-16 rounded-lg bg-white overflow-hidden relative cursor-pointer group">
              <img className="w-full h-full object-cover group-hover:scale-110 transition-transform" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUVvcU1nlSwDIjS839Qh6wYnRGAbFaSvRqsnA973CObcYzQVWar5-AIPWMqyNY7WiCg9fRjnpn4TMugIcQfnkjfpG4wNiphwzTIRjxlnO4SDmMu37zm9W4V5_OhYdS-ZS3zDNVWFzD_aNfG9hCkYFrqj_qh0_SyYQNMBuU8XVfDyxnN1_aytdg5jaWhbGcF6bL0NLZZSM21XfFE7ZsTkCQ3BXxiWfk8bJQW5sIzB8KTrsqzyPC1bqhRitHrEm03u0stZT2Dq-kAtVo" alt="Blue Night" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/20 flex items-end p-2">
                <span className="text-white text-[10px] font-bold uppercase">Blue Night</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
