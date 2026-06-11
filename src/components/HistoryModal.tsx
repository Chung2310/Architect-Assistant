import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { apiClient } from '../services/apiClient';

interface Transaction {
  _id: string;
  amount: number;
  type: string;
  model: string;
  timestamp: string;
}

interface HistoryModalProps {
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ onClose }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiClient.get("/api/v1/users/me/transactions?limit=100");
        if (res.success && Array.isArray(res.data)) {
          setTransactions(res.data);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'image': return { label: 'Tạo ảnh', icon: 'image', color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'video': return { label: 'Tạo video', icon: 'videocam', color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'audio': return { label: 'Tạo âm thanh', icon: 'music_note', color: 'text-yellow-500', bg: 'bg-yellow-50' };
      case 'topup': return { label: 'Nạp Credits', icon: 'account_balance_wallet', color: 'text-green-600', bg: 'bg-green-50' };
      default: return { label: 'Chat / Text', icon: 'chat', color: 'text-slate-500', bg: 'bg-slate-50' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Icon name="history" className="text-primary" />
            Lịch sử giao dịch
          </h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <Icon name="close" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto pr-2">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Icon name="receipt_long" className="text-4xl mb-3 opacity-50" />
              <p>Chưa có giao dịch nào.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(tx => {
                const typeInfo = getTypeLabel(tx.type);
                return (
                  <div key={tx._id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.bg} ${typeInfo.color}`}>
                        <Icon name={typeInfo.icon} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{typeInfo.label}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span>{formatDate(tx.timestamp)}</span>
                          <span>•</span>
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{tx.model || 'Unknown model'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === 'topup' ? (tx.amount >= 0 ? 'text-green-600' : 'text-red-500') : 'text-red-500'}`}>
                        {tx.type === 'topup' ? (tx.amount > 0 ? '+' : '') + tx.amount.toFixed(4) : '-' + tx.amount.toFixed(4)}
                      </p>
                      <p className="text-xs text-slate-500">Credits</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
