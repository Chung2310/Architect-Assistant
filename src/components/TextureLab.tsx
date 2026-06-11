import React, { useState } from 'react';
import { Icon } from './Icon';

export const TextureLab: React.FC = () => {
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(65);
  const [isSeamless, setIsSeamless] = useState(true);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Tool Header */}
      <div className="px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-on-surface font-headline">TextureLab</h2>
          <p className="text-on-surface-variant text-sm font-body">Xử lý vật liệu PBR thông minh bằng AI</p>
        </div>
        {/* Top Tabs */}
        <div className="bg-surface-container-low p-1 rounded-full flex gap-1">
          <button className="px-6 py-2 bg-white text-primary rounded-full shadow-sm text-xs font-bold tracking-wider">ALBEDO</button>
          <button className="px-6 py-2 text-on-surface-variant hover:bg-white/50 rounded-full text-xs font-bold tracking-wider transition-colors">ROUGHNESS</button>
          <button className="px-6 py-2 text-on-surface-variant hover:bg-white/50 rounded-full text-xs font-bold tracking-wider transition-colors">NORMAL</button>
        </div>
      </div>

      <div className="flex-1 px-8 pb-8 flex flex-col lg:flex-row gap-8 overflow-hidden">
        {/* Left Control Panel */}
        <section className="w-full lg:w-80 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {/* Sliders Card */}
          <div className="bg-surface-container-lowest p-8 rounded-xl flex flex-col gap-8 shadow-sm">
            <h3 className="text-sm font-bold text-on-surface tracking-tight flex items-center gap-2">
              <Icon name="tune" className="text-xs" />
              THÔNG SỐ CƠ BẢN
            </h3>
            {/* Slider: Độ sáng */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-on-surface-variant uppercase">Độ sáng</label>
                <span className="text-xs font-bold text-primary">{brightness}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={brightness} 
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary" 
              />
            </div>
            {/* Slider: Độ tương phản */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-on-surface-variant uppercase">Độ tương phản</label>
                <span className="text-xs font-bold text-primary">{contrast}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={contrast} 
                onChange={(e) => setContrast(parseInt(e.target.value))}
                className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-primary" 
              />
            </div>
          </div>

          {/* Checkbox/Toggle Card */}
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-on-surface">Kiểm tra Seamless</span>
                <span className="text-[10px] text-on-surface-variant">Tự động lặp lại texture</span>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isSeamless} 
                  onChange={() => setIsSeamless(!isSeamless)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          </div>

          {/* Asset Browser Card */}
          <div className="bg-surface-container-lowest p-6 rounded-xl flex-1 flex flex-col gap-4 shadow-sm min-h-[300px]">
            <h3 className="text-xs font-bold text-on-surface tracking-tight uppercase">Thư viện của bạn</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-square rounded-lg overflow-hidden bg-surface group relative cursor-pointer">
                <img className="w-full h-full object-cover transition-transform group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuByMrU3Oe4cnp5yaGRpI2p0RIbpG4uLUCd1nOyUIr3pS6kv0SPnMCEn0TvBkqshAEVGfdDu8SzrX4ah6yPWHlJL3X58TqHZbKmN4JRrZAv8geirC5EiqDy_uc6rIJuymCHxqXZcboo0DsvlrhS2yMGxGelv7s5ed4qyCj15cyhVUl1sHU0iYs2neeCn_mnR7EPmErTy-qA0nRMeXRNInS9TWvLRwc8y2zDgT9hikf6rWaHpavtOXTYRulD80JSl3TIxGIWr20wF4GZn" alt="Texture 1" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Icon name="check_circle" className="text-white" />
                </div>
              </div>
              <div className="aspect-square rounded-lg overflow-hidden bg-surface group relative cursor-pointer">
                <img className="w-full h-full object-cover transition-transform group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHhABdsTcB9l0HRm7DdcTic8kVN0vnsrfgjn3DFO5bVsblzqjYaP_wXLkb-upFBf1UigAAwMRl2xXTW4HhXnu83ZPm0aqE7gpDevzm0utmiMI4ZmugVImVsZ9mabsSFuuzw1Fje0vSRToA5S9EqleAM5BmkSVVy7G_m1ZLQow_Gf2jd3LgPuwXrDi-z0hbkfWFFkTRN_Ap-nqet9-l-6FQwH0fwnsOkpJ4x3c2s6TGXkD3L6VtUN-36ifZFW35RFDxQ7pH8khpXpeH" alt="Texture 2" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Icon name="add" className="text-white" />
                </div>
              </div>
              <div className="aspect-square rounded-lg overflow-hidden bg-surface group relative cursor-pointer">
                <img className="w-full h-full object-cover transition-transform group-hover:scale-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAW7WWf_4ihKacdDgd0nTrCpEfIBmMpv0ZsaTmR7tuojMHNj7X3bRQ9_0s_eMN5oSLHdMTdBdcAR8cpmBgxbmLN76BX2aE0bcmzCmBH4bt6mgFMmE37cQ-x3-9kKNF1eTF29nIBLkA8f_WxNkucuxbkG-XCLeBI0gDQacaHQiHRQ9NklQyrFxeBTzqdap1vJd6fkKZ0IV60sQgubIRxbvx3e97FpZ-LteriUMgQcS3U2GEg_xj57oljwqVD0LvbIOX0xckIQf--JGm4" alt="Texture 3" referrerPolicy="no-referrer" />
              </div>
              <div className="aspect-square rounded-lg border-2 border-dashed border-outline-variant flex items-center justify-center text-outline-variant hover:text-primary hover:border-primary transition-colors cursor-pointer">
                <Icon name="upload_file" className="text-3xl" />
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <button className="bg-[#0F172A] text-white py-5 rounded-xl font-bold text-sm flex items-center justify-center gap-3 active:scale-95 duration-200 shadow-lg shadow-[#0F172A]/20">
            <Icon name="auto_fix_high" />
            XUẤT TEXTURE PBR
          </button>
        </section>

        {/* Center Preview Area */}
        <section className="flex-1 bg-surface-container-low rounded-xl relative overflow-hidden texture-grid-pattern flex items-center justify-center">
          {/* Main Preview Frame */}
          <div className="relative w-full h-full max-w-4xl flex items-center justify-center p-12">
            <div className="relative aspect-square w-full max-h-full bg-white rounded-lg shadow-2xl overflow-hidden ring-8 ring-white/20 backdrop-blur-sm">
              {/* Simulated PBR Texture Preview */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIBDxF7Cp7oDBmi_tbELFmfkOE_KppALOefn7vumaF7ytm504W_0MkMIW4K3MKpkwRjP7MT3zIX_3R2HJ3vID_KZVqqk9pic5IYHM8mUFsIGlrNMMHpd1bC8miN-PunPtl-MY2PQel2vDewFAK64EdnM2_yHewFHG9xFhRnrnrfAqXFHalp_TyszxfpLO-p-VXroIJlYp01B10U1nfa2_0AUsWOYlH7Uz-5p8UgaTwuensmiDssNmw5USCbTiIaALp5KTzhpV9JGMU" alt="Texture Preview" referrerPolicy="no-referrer" />
              </div>
              {/* Seamless Pattern Overlay */}
              {isSeamless && (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 border border-white/30 pointer-events-none opacity-40">
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
                  <div className="border-r border-white/20"></div>
                  <div></div>
                </div>
              )}
              {/* Focus Reticle Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 border-2 border-white/50 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Toolbar */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/60 backdrop-blur-xl px-8 py-4 rounded-full flex items-center gap-8 shadow-xl shadow-black/5 ring-1 ring-black/5">
            <div className="flex items-center gap-4">
              <button className="text-on-surface-variant hover:text-primary transition-colors"><Icon name="zoom_in" /></button>
              <button className="text-on-surface-variant hover:text-primary transition-colors"><Icon name="zoom_out" /></button>
            </div>
            <div className="h-6 w-[1px] bg-outline-variant/30"></div>
            <div className="flex items-center gap-4">
              <button className="text-on-surface-variant hover:text-primary transition-colors"><Icon name="view_in_ar" /></button>
              <button className="text-on-surface-variant hover:text-primary transition-colors"><Icon name="layers" fill /></button>
              <button className="text-on-surface-variant hover:text-primary transition-colors"><Icon name="fullscreen" /></button>
            </div>
            <div className="h-6 w-[1px] bg-outline-variant/30"></div>
            <button className="flex items-center gap-2 text-xs font-bold text-on-surface">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              LIVE PREVIEW
            </button>
          </div>

          {/* Generation Progress */}
          <div className="absolute top-0 left-0 w-full h-1 bg-surface-container-high">
            <div className="h-full bg-gradient-to-r from-primary to-secondary-container" style={{ width: '75%' }}></div>
          </div>
        </section>
      </div>
    </div>
  );
};
