import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { HistoryModal } from './HistoryModal';

interface PricingItem {
  name: string;
  subtitle: string;
  price: string | {
    headers: string[];
    rows: {
      label: string;
      values: string[];
    }[];
  };
  unit: string;
}

interface PricingSection {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  items: PricingItem[];
}

const pricingSections: PricingSection[] = [
  {
    id: 'image',
    title: 'Hình ảnh',
    icon: 'image',
    iconColor: 'text-[#0ea5e9]',
    iconBg: 'bg-[#0ea5e9]/10',
    items: [
      {
        name: 'iGen-3.1-flash-image-preview',
        subtitle: '1K: 27.5 | 2K: 42 (Tính theo Credit)',
        price: '27.5',
        unit: '/ ảnh'
      },
      {
        name: 'iGen-3-pro-image-preview',
        subtitle: '1K: 57 | 2K: 57 (Tính theo Credit)',
        price: '57',
        unit: '/ ảnh'
      }
    ]
  },
  {
    id: 'video',
    title: 'Video',
    icon: 'videocam',
    iconColor: 'text-cyan-500',
    iconBg: 'bg-cyan-500/10',
    items: [
      {
        name: 'iGen Veo 3.1 Fast',
        subtitle: '720p: 4s=162.0, 6s=243.0, 8s=324.0 | 1080p: 5s=194.4, 8s=291.6, 14s=388.8',
        price: {
          headers: ['Res', '4s', '6s', '8s'],
          rows: [
            { label: '720P', values: ['162.0', '243.0', '324.0'] },
            { label: '1080P', values: ['194.4', '291.6', '388.8'] }
          ]
        },
        unit: '/ video (lần)'
      },
      {
        name: 'iGen Veo 3.1 Lite',
        subtitle: '720p: 4s=81.0, 6s=121.5, 8s=162.0 | 1080p: 5s=129.6, 8s=194.4, 14s=259.2',
        price: {
          headers: ['Res', '4s', '6s', '8s'],
          rows: [
            { label: '720P', values: ['81.0', '121.5', '162.0'] },
            { label: '1080P', values: ['129.6', '194.4', '259.2'] }
          ]
        },
        unit: '/ video (lần)'
      }
    ]
  },
  {
    id: 'text',
    title: 'Văn bản / Prompt',
    icon: 'text_fields',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
    items: [
      {
        name: 'iGen 3.1 pro',
        subtitle: 'Cố định mỗi lần tạo',
        price: '10',
        unit: '/ lần'
      },
      {
        name: 'iGen 3.1 flash lite',
        subtitle: 'Cố định mỗi lần tạo',
        price: '1.5',
        unit: '/ lần'
      },
      {
        name: 'iGen 3 flash',
        subtitle: 'Cố định mỗi lần tạo',
        price: '2.5',
        unit: '/ lần'
      }
    ]
  }
];

interface LayoutProps {
  children: React.ReactNode;
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentScreen: _currentScreen, onNavigate }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const val = user ? parseFloat(String(user.credits)) : NaN;
  const credits = isNaN(val) ? "0.0000" : val.toFixed(4);
  const role = user?.role || "user";

  useEffect(() => {
    const handleShowTopUp = () => setShowTopUpModal(true);
    window.addEventListener('show-topup-modal', handleShowTopUp);
    return () => window.removeEventListener('show-topup-modal', handleShowTopUp);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white/60 backdrop-blur-xl shadow-sm shadow-[#0f172a]/5 flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="cursor-pointer flex items-center" onClick={() => onNavigate('home')}>
            <img 
              src="https://res.cloudinary.com/dgaofuhmv/image/upload/v1775301001/unnamed_tcmlmp.png" 
              alt="iGen Logo" 
              className="h-12 object-contain" 
              referrerPolicy="no-referrer" 
            />
          </h1>
          <span className="text-on-surface font-manrope text-sm font-semibold tracking-tight">- Trợ lý AI cho Kiến trúc sư</span>
        </div>
        <div className="flex items-center gap-4 relative">
          <button 
            onClick={() => setShowPricingModal(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Bảng giá"
          >
            <Icon name="info" className="text-xl" />
          </button>
          <div className="bg-surface-container-low px-4 py-2 rounded-full flex items-center gap-2">
            <Icon name="account_balance_wallet" className="text-primary text-sm" fill />
            <span className="font-semibold tracking-tight text-primary">{credits} Credits</span>
          </div>
          <button 
            onClick={() => setShowQRModal(true)}
            className="px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary/90 rounded-full transition-colors shadow-sm"
          >
            Nạp Credit
          </button>
          <div 
            className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-primary/20 cursor-pointer" 
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <img 
              src={(user as { photoURL?: string })?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuBoioX1HntdUy2M9iOwpmOON9HMNMVxAspmQbu4CIOS-pPzU41MeSxY0zZ3JRyPNJ2LYwz6WyLTN31b1nsjbguPJrTfZHYSjq0u5WEGLRE7eKQocsx587gmZAMFnZh0pqkPcANCNUaLzDamkllNv5JjFZP7-HuLPHFetlGPe_ppgH5Uz64cjPVhuD9fBc08FrblwaCSIb_tfoxFnV93P_MTPbFAZF9mXY5KsXirSq8Dw_xo1P880rnkBogLhaqcx0KmIZ_Z3iPx4heC"} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          
          {showDropdown && (
            <div className="absolute right-0 top-12 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 mb-2">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {role === 'admin' ? 'Admin' : (user?.displayName || 'Người dùng')}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              {role === 'admin' && (
                <button 
                  onClick={() => {
                    onNavigate('/admin');
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Icon name="admin_panel_settings" className="text-[18px]" />
                  Admin Panel
                </button>
              )}
              <button 
                onClick={() => {
                  setShowHistoryModal(true);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <Icon name="history" className="text-[18px]" />
                Lịch sử giao dịch
              </button>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <Icon name="logout" className="text-[18px]" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 pt-16 overflow-hidden max-w-full">
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Top Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="account_balance_wallet" className="text-3xl" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Hết Credits</h3>
            <p className="text-slate-600 mb-8">
              Bạn đã sử dụng hết số Credits hiện có. Vui lòng nạp thêm để tiếp tục sử dụng các dịch vụ AI của chúng tôi.
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowTopUpModal(false)}
                className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Đóng
              </button>
              <button 
                onClick={() => {
                  setShowTopUpModal(false);
                  setShowQRModal(true);
                }}
                className="px-6 py-2.5 text-sm font-medium bg-primary text-white hover:bg-primary/90 rounded-xl transition-colors shadow-sm"
              >
                Nạp thêm Credits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl text-center relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <Icon name="close" />
            </button>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Nạp Credits</h3>
            <div className="mb-6 flex justify-center">
              <img 
                src="https://res.cloudinary.com/dgaofuhmv/image/upload/v1775795716/aaaab39d22c3a39dfad2_fuvkyz.jpg" 
                alt="QR Code" 
                className="w-64 h-64 object-contain rounded-xl border border-slate-200"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-left bg-slate-50 p-4 rounded-xl text-sm text-slate-700 space-y-3">
              <p className="font-semibold text-slate-900">Khi chuyển khoản viết kèm ghi chú:</p>
              <p className="bg-white p-2 rounded border border-slate-200 font-mono text-center">Tên tài khoản + app1 hoặc app2</p>
              <p className="text-slate-500 italic">Ví dụ: nasagold1 + app1</p>
              <div className="h-px bg-slate-200 my-2"></div>
              <p className="font-semibold text-slate-900">Chú thích:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-medium text-primary">100 VND = 1 credit</span></li>
                <li>App 1: Trợ lý xây dựng thương hiệu cá nhân</li>
                <li>App 2: Trợ lý Kiến trúc sư</li>
              </ul>
              <div className="h-px bg-slate-200 my-2"></div>
              <p className="text-slate-600 italic">Nếu có thêm câu hỏi hoặc cần được hỗ trợ kỹ thuật, vui lòng liên hệ Zalo <a href="https://zalo.me/0353710189" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">0353710189</a></p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 relative">
              <button 
                onClick={() => setShowPricingModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Icon name="close" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Bảng giá dịch vụ</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chi phí được tính dựa trên số lượng Credit tiêu thụ cho mỗi đơn vị sử dụng.
                <span className="ml-1.5 text-[#0ea5e9] border-l border-slate-200 pl-1.5 inline-block font-semibold">Quy đổi: 100 VND = 1 Credit</span>
              </p>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {pricingSections.map((section) => (
                <div key={section.id} className="space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <div className={`w-8 h-8 rounded-lg ${section.iconBg} flex items-center justify-center ${section.iconColor}`}>
                      <Icon name={section.icon} className="text-base" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm md:text-base">{section.title}</h4>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 px-1 py-1">
                    <div className="col-span-6 md:col-span-7">Mô hình / Dịch vụ</div>
                    <div className="col-span-4 md:col-span-3 text-center">Giá (Credit)</div>
                    <div className="col-span-2 md:col-span-2 text-right">Đơn vị</div>
                  </div>

                  {/* List Items */}
                  <div className="divide-y divide-slate-100/50">
                    {section.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 py-3 px-1 items-center hover:bg-slate-50/50 rounded-lg transition-colors">
                        {/* Name & Sub */}
                        <div className="col-span-6 md:col-span-7 pr-2">
                          <div className="font-bold text-slate-800 text-xs md:text-[13px] leading-tight mb-0.5">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal leading-relaxed">
                            {item.subtitle}
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="col-span-4 md:col-span-3 flex justify-center items-center">
                          {typeof item.price === 'string' ? (
                            <span className="font-extrabold text-[#0ea5e9] text-sm md:text-base leading-none">
                              {item.price}
                            </span>
                          ) : (
                            <table className="text-[10px] text-center border-collapse">
                              <thead>
                                <tr className="text-[9px] text-slate-400 border-b border-slate-100">
                                  <th className="px-1 py-0.5 text-left font-normal">Res</th>
                                  {item.price.headers.slice(1).map((h, hIdx) => (
                                    <th key={hIdx} className="px-1 py-0.5 font-normal">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {item.price.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b last:border-0 border-slate-100/50">
                                    <td className="px-1 py-0.5 text-[9px] font-bold text-slate-500 text-left uppercase">
                                      {row.label}
                                    </td>
                                    {row.values.map((v, vIdx) => (
                                      <td key={vIdx} className="px-1 py-0.5 font-bold text-[#0ea5e9]">
                                        {v}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* Unit */}
                        <div className="col-span-2 md:col-span-2 text-right text-slate-400 text-[11px] md:text-xs">
                          {item.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Bottom Policy notice */}
              <div className="mt-6 py-3 px-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-[11px] text-slate-400 italic">
                * Bảng giá có thể thay đổi tùy theo chính sách của nhà cung cấp dịch vụ AI.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <HistoryModal onClose={() => setShowHistoryModal(false)} />
      )}
    </div>
  );
};
