import React, { useState } from 'react';
import { Icon } from './Icon';

export const HumanEnhancer: React.FC = () => {
  const [model, setModel] = useState('pro');
  const [count, setCount] = useState(4);
  const [ethnicity, setEthnicity] = useState('mixed');

  return (
    <div className="h-full grid grid-cols-12 gap-0 overflow-hidden bg-surface">
      {/* Canvas: Architectural Render Area */}
      <section className="col-span-12 lg:col-span-8 p-8 relative flex flex-col h-full">
        <div className="mb-6">
          <h1 className="text-[#0F172A] text-2xl font-semibold font-headline">Human Enhancer</h1>
          <p className="text-[#475569] text-sm">Thêm con người 3D vào phối cảnh kiến trúc với tỷ lệ chính xác.</p>
        </div>
        <div className="flex-1 bg-surface-container-lowest rounded-xl overflow-hidden relative shadow-sm border border-outline-variant/10 group">
          <img 
            className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBDF96mzuKQvznJ6aIHYBvf9SKNBu3RfGEW9a6NEEoaeWs0q5sDN1LX4fBuqg5k8JGDrDLNme8NURpFqnhdxxNKPRhgGj2EqDSLUmo5Zla7tiuTacEhWD0EnqRK4GxICvEU_Vleh9QDo9HPTKKONEnoGKAb6iuFy011rbbgNPFTVbEv9VpY2JISP5QsSy1j9qf_5WVJWvpyUGxGEKOfjSbc3m1XNCBOXA_qIb8Z044pQ7Og7fX8e_9WI3G3dp9PQcubseT34BGxs_Jb" 
            alt="Render"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-96 border-2 border-dashed border-primary bg-primary/5 rounded-lg flex flex-col items-center justify-center backdrop-blur-[2px] cursor-move">
              <Icon name="person_add" className="text-primary text-4xl mb-2" />
              <p className="text-primary text-xs font-bold uppercase tracking-widest">Khu vực đặt người</p>
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full"></div>
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full"></div>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-primary rounded-full"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full"></div>
            </div>
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white">
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><Icon name="zoom_in" /></button>
            <div className="h-4 w-[1px] bg-slate-300"></div>
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><Icon name="pan_tool" /></button>
            <div className="h-4 w-[1px] bg-slate-300"></div>
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><Icon name="undo" /></button>
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600"><Icon name="redo" /></button>
          </div>
        </div>
      </section>

      {/* Settings Panel */}
      <aside className="col-span-12 lg:col-span-4 bg-white border-l border-outline-variant/10 p-8 overflow-y-auto h-full flex flex-col gap-8 custom-scrollbar">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Cấu hình Enhancer</h2>
          <div className="space-y-3 mb-8">
            <label className="text-xs font-semibold text-[#0F172A] block uppercase">Mô hình AI</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setModel('pro')}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${model === 'pro' ? 'border-primary bg-primary/5' : 'border-slate-100'}`}
              >
                <span className={`text-xs font-bold ${model === 'pro' ? 'text-primary' : 'text-slate-700'}`}>Pro</span>
                <span className="text-[10px] text-slate-500">Chất lượng cao nhất</span>
              </button>
              <button 
                onClick={() => setModel('nano')}
                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${model === 'nano' ? 'border-primary bg-primary/5' : 'border-slate-100'}`}
              >
                <span className={`text-xs font-bold ${model === 'nano' ? 'text-primary' : 'text-slate-700'}`}>Nano Lite</span>
                <span className="text-[10px] text-slate-500">Tốc độ siêu nhanh</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[#0F172A] block uppercase">Số lượng tạo hình</label>
              <span className="text-xs font-bold text-primary">{count < 10 ? `0${count}` : count} bản</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="8" 
              value={count} 
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary" 
            />
            <div className="flex justify-between px-1">
              <span className="text-[10px] font-medium text-slate-400">01</span>
              <span className="text-[10px] font-medium text-slate-400">08</span>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <label className="text-xs font-semibold text-[#0F172A] block uppercase">Chủng tộc</label>
            <div className="grid grid-cols-3 gap-2">
              {['Châu Á', 'Châu Âu', 'Châu Phi', 'Hỗn hợp', 'Châu Mỹ'].map((item) => (
                <button 
                  key={item}
                  onClick={() => setEthnicity(item.toLowerCase())}
                  className={`py-2.5 px-2 text-[11px] rounded-lg transition-all ${
                    ethnicity === item.toLowerCase() 
                    ? 'bg-white ring-2 ring-primary ring-inset font-bold text-primary' 
                    : 'bg-slate-50 hover:bg-slate-100 font-semibold text-slate-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <label className="text-xs font-semibold text-[#0F172A] block uppercase">Trang phục</label>
            <select className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 pr-10 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 appearance-none text-ellipsis overflow-hidden whitespace-nowrap">
              <option>Thường ngày (Casual)</option>
              <option>Công sở (Professional)</option>
              <option>Sang trọng (Formal)</option>
              <option>Thể thao (Sporty)</option>
              <option>Mùa đông (Winter)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-[#0F172A] block uppercase">Mô tả thêm (Tùy chọn)</label>
            <textarea 
              className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400" 
              placeholder="Ví dụ: Một gia đình đang đi bộ, cầm túi xách..." 
              rows={3}
            ></textarea>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <button className="w-full bg-[#0F172A] text-white py-5 rounded-full font-bold text-sm flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 transition-all active:scale-95 duration-200">
            <Icon name="bolt" fill />
            Tạo hình AI ngay
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-4">Tiêu tốn 4 tín hiệu (Credits)</p>
        </div>
      </aside>
    </div>
  );
};
