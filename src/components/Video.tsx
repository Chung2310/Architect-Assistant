import React from 'react';
import { Icon } from './Icon';

export const Video: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-surface overflow-auto custom-scrollbar">
      <div className="max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 p-8">
        {/* Left Panel: Video Settings */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm shadow-[#0f172a]/5 space-y-8">
            <h2 className="text-on-surface font-headline text-lg font-bold">Cấu hình Video</h2>
            {/* Section: Tải ảnh bối cảnh */}
            <div className="space-y-4">
              <label className="block text-on-surface-variant font-label text-xs font-semibold uppercase tracking-wider">Tải ảnh bối cảnh</label>
              <div className="group relative aspect-video rounded-lg border-2 border-dashed border-outline-variant/30 hover:border-primary transition-all flex flex-col items-center justify-center bg-surface-container-low cursor-pointer">
                <Icon name="add_photo_alternate" className="text-3xl text-outline-variant group-hover:text-primary mb-2" />
                <span className="text-on-surface-variant font-label text-xs">Kéo thả hoặc nhấn để tải</span>
              </div>
            </div>
            {/* Section: Thêm nhân vật */}
            <div className="space-y-4">
              <label className="block text-on-surface-variant font-label text-xs font-semibold uppercase tracking-wider">Thêm nhân vật</label>
              <div className="grid grid-cols-3 gap-3">
                <button className="aspect-square rounded-lg bg-surface-container border border-outline-variant/10 overflow-hidden hover:ring-2 ring-primary transition-all">
                  <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPiexpoL2VQtqhFAbUpZigos2N7ClfV6EcvoSwNqZTHj5VMvDxIvIqnBjxG6ygAGPNavJP-FwLgmPgVuLjWgjDdf4gFHuf5TeVuo6okY1-0_X3orSxFoHxOkJjfei7jZQGmDYeXeMizunNHhjy7wKnq5sqsNo59Ps7DUhM8Tv38oeh1u9ekmh2VckZBDCZ8XDTDhB31pQrUholOqHMJ7hWZMoWISnSDhmEd6Qu_fgufBCrHuyTkfSG0e6cyn-OggkuoWYzh04zDE2f" alt="Char 1" referrerPolicy="no-referrer" />
                </button>
                <button className="aspect-square rounded-lg bg-surface-container border border-outline-variant/10 overflow-hidden hover:ring-2 ring-primary transition-all">
                  <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4c_euFCuAH3UKzz_SBifxhss_SaD-rSD62b7ZkO3b8y_p6deTJisGNvWIFTIey4OSpImFQUzAsGDVxj5v4_34EL0ej0IiLZuLHF1KFaTp_nHbyYVTHl9rS6bO5SeX8cplSTjgQrrBievf_G23T0b6a5xgMkeOheuHB6ZOJ6GrnM-T29Ferv5lqnVDvE_YHaTICY-ASwM-RIyneSvcdRTSrAgJ6E8fOjpDIRNCok7KhiB74EYxgIkC9qcMiw7EovmH9_HieGoxKRAd" alt="Char 2" referrerPolicy="no-referrer" />
                </button>
                <button className="aspect-square rounded-lg border-2 border-dashed border-outline-variant/30 flex items-center justify-center hover:bg-surface-container transition-all">
                  <Icon name="add" className="text-outline-variant" />
                </button>
              </div>
            </div>
            {/* Section: MC Bất động sản */}
            <div className="space-y-4">
              <label className="block text-on-surface-variant font-label text-xs font-semibold uppercase tracking-wider">MC Bất động sản</label>
              <select className="w-full bg-surface-container-low border-0 rounded-lg pr-10 text-sm font-manrope focus:ring-2 ring-primary appearance-none text-ellipsis overflow-hidden whitespace-nowrap">
                <option>MC Minh Anh (Nữ - Giọng miền Bắc)</option>
                <option>MC Hoàng Nam (Nam - Giọng miền Bắc)</option>
                <option>MC Bảo Thy (Nữ - Giọng miền Nam)</option>
              </select>
            </div>
            {/* Section: Tạo Kịch bản */}
            <div className="space-y-4">
              <label className="block text-on-surface-variant font-label text-xs font-semibold uppercase tracking-wider">Tạo Kịch bản AI</label>
              <textarea className="w-full bg-surface-container-low border-0 rounded-lg text-sm font-manrope focus:ring-2 ring-primary resize-none" placeholder="Nhập yêu cầu kịch bản hoặc dán nội dung tại đây..." rows={4}></textarea>
              <button className="w-full py-3 bg-on-surface text-surface-container-lowest rounded-full font-label text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                <Icon name="auto_awesome" className="text-lg" fill />
                Tạo nội dung AI
              </button>
            </div>
          </div>
        </section>

        {/* Center Area: Video Editor */}
        <section className="lg:col-span-9 flex flex-col gap-8">
          {/* Video Preview */}
          <div className="relative bg-on-surface aspect-[16/9] rounded-xl overflow-hidden shadow-2xl flex items-center justify-center group">
            <img className="absolute inset-0 w-full h-full object-cover opacity-60" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBraYQ5_wq5YovRc4XkkNrW1JbA2wMT2d8_NkObLgw_3nxzJonFvjhVW1Mj4sooXOfrinSb3_9ic9K7xzFMsAz0s7Vo8yZ-kKViWnB4wcHLrW8bf8K5O9XWvgVfljd9RsdEWSdklFm28kqPd3q4c1iFJPP2T0yhu4-IoPJFrrqbtH2RiNjcYu3zQon35P2qiZFrnVKoyw9N7QNpNXLpmBTBp92yUJq0tcmaNcUwO2Q0j_4Ufjx_5zSaHPbG7ryR2hjIuznDMIXQsSCy" alt="Preview" referrerPolicy="no-referrer" />
            <div className="relative z-10 w-48 h-48 rounded-full border-4 border-white/20 backdrop-blur-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform group-hover:border-white/40">
              <Icon name="play_arrow" className="text-6xl text-white" fill />
            </div>
            {/* Floating Controls Over Preview */}
            <div className="absolute bottom-6 right-6 flex gap-3">
              <button className="w-12 h-12 glass-panel rounded-full flex items-center justify-center text-on-surface hover:bg-white transition-all shadow-lg">
                <Icon name="hd" />
              </button>
              <button className="w-12 h-12 glass-panel rounded-full flex items-center justify-center text-on-surface hover:bg-white transition-all shadow-lg">
                <Icon name="fullscreen" />
              </button>
            </div>
          </div>

          {/* Video Timeline Simulator */}
          <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm shadow-[#0f172a]/5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors">
                  <Icon name="skip_previous" />
                </button>
                <button className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:bg-on-secondary-container transition-colors shadow-lg">
                  <Icon name="play_arrow" fill />
                </button>
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors">
                  <Icon name="skip_next" />
                </button>
                <span className="font-manrope text-sm font-semibold ml-4">00:12 / 01:45</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-6 py-2.5 bg-primary text-white rounded-full font-label text-xs font-bold hover:shadow-lg transition-all">Xuất Video</button>
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
                  <Icon name="settings" />
                </button>
              </div>
            </div>
            {/* Timeline Visualizer */}
            <div className="relative h-48 bg-surface rounded-lg overflow-hidden border border-outline-variant/10">
              {/* Time Markers */}
              <div className="h-8 border-b border-outline-variant/10 flex items-center px-4 gap-20">
                <span className="text-[10px] text-outline-variant font-bold">0:00</span>
                <span className="text-[10px] text-outline-variant font-bold">0:15</span>
                <span className="text-[10px] text-outline-variant font-bold">0:30</span>
                <span className="text-[10px] text-outline-variant font-bold">0:45</span>
                <span className="text-[10px] text-outline-variant font-bold">1:00</span>
                <span className="text-[10px] text-outline-variant font-bold">1:15</span>
              </div>
              {/* Track 1: Scene */}
              <div className="h-12 border-b border-outline-variant/5 flex items-center px-4 relative">
                <div className="absolute left-0 w-48 h-10 bg-primary/10 border-l-4 border-primary ml-4 rounded-r-md flex items-center px-3">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Cảnh 1: Phòng khách</span>
                </div>
                <div className="absolute left-52 w-64 h-10 bg-primary/10 border-l-4 border-primary rounded-r-md flex items-center px-3">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Cảnh 2: Ban công</span>
                </div>
              </div>
              {/* Track 2: MC/Avatar */}
              <div className="h-12 border-b border-outline-variant/5 flex items-center px-4 relative">
                <div className="absolute left-8 w-80 h-10 bg-primary-container/20 border-l-4 border-primary ml-4 rounded-r-md flex items-center px-3">
                  <span className="text-[10px] font-bold text-on-primary-container uppercase tracking-tight">MC Minh Anh - Lời thoại mở đầu</span>
                </div>
              </div>
              {/* Track 3: Audio/Music */}
              <div className="h-12 flex items-center px-4 relative">
                <div className="absolute left-0 w-full h-8 bg-surface-container-highest/50 mx-4 rounded-md flex items-center px-3">
                  <div className="flex gap-1 h-4 items-center">
                    <div className="w-1 h-3 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-5 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-2 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-4 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-6 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-3 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-5 bg-outline-variant rounded-full"></div>
                  </div>
                  <span className="text-[10px] font-bold text-outline ml-3 uppercase tracking-tight">Nhạc nền: Cinematic Architectural</span>
                </div>
              </div>
              {/* Playhead Indicator */}
              <div className="absolute top-0 bottom-0 left-[240px] w-[2px] bg-red-500 z-20 shadow-[0_0_8px_rgba(186,26,26,0.5)]">
                <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full ring-4 ring-white"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
