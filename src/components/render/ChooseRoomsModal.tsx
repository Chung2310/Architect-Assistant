import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Sofa,
  Utensils,
  Bath,
  Bed,
  ChefHat,
  Car,
  Briefcase,
  Sun,
  Trees,
  Dumbbell,
  Gamepad2,
  Shirt,
  Package,
  WashingMachine,
  Settings,
  Home
} from "lucide-react";

interface RoomSelection {
  name: string;
  count: number;
}

interface ChooseRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  floorsCount: number;
  initialSelection?: Record<number, RoomSelection[]>;
  onConfirm: (roomsString: string, roomSelection: Record<number, RoomSelection[]>) => void;
}

// Map room names to their labels and icons
const ROOM_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  "Phòng khách": { label: "Phòng khách", icon: Sofa },
  "Phòng bếp": { label: "Phòng bếp", icon: Utensils },
  "Phòng tắm lớn": { label: "Phòng tắm lớn", icon: Bath },
  "Phòng ngủ": { label: "Phòng ngủ", icon: Bed },
  "Phòng ăn": { label: "Phòng ăn", icon: ChefHat },
  "Nhà xe / Gara": { label: "Nhà xe / Gara", icon: Car },
  "Phòng làm việc": { label: "Phòng làm việc", icon: Briefcase },
  "Ban công": { label: "Ban công", icon: Sun },
  "Sân thượng": { label: "Sân thượng", icon: Trees },
  "Phòng vệ sinh phụ": { label: "Phòng vệ sinh phụ", icon: Bath },
  "Phòng sinh hoạt chung": { label: "Phòng sinh hoạt chung", icon: Sofa },
  "Phòng chơi game": { label: "Phòng chơi game", icon: Gamepad2 },
  "Phòng giải trí": { label: "Phòng giải trí", icon: Gamepad2 },
  "Phòng tập gym": { label: "Phòng tập gym", icon: Dumbbell },
  "Phòng thay đồ (Walk-in)": { label: "Phòng thay đồ (Walk-in)", icon: Shirt },
  "Phòng kho bếp (Pantry)": { label: "Phòng kho bếp (Pantry)", icon: Package },
  "Phòng giặt ủi": { label: "Phòng giặt ủi", icon: WashingMachine },
  "Phòng kỹ thuật": { label: "Phòng kỹ thuật", icon: Settings },
  "Lối vào / Sảnh đón (Entry)": { label: "Lối vào / Sảnh đón (Entry)", icon: Home },
  "Sảnh phụ (Mudroom)": { label: "Sảnh phụ (Mudroom)", icon: Home },
  "Hiên trước (Porch)": { label: "Hiên trước (Porch)", icon: Home },
  "Sân vườn": { label: "Sân vườn", icon: Trees },
};

const ALL_ROOM_NAMES = Object.keys(ROOM_META);

export const ChooseRoomsModal: React.FC<ChooseRoomsModalProps> = ({
  isOpen,
  onClose,
  floorsCount,
  initialSelection,
  onConfirm,
}) => {
  const [roomsByFloor, setRoomsByFloor] = useState<Record<number, RoomSelection[]>>({});
  const [activeDropdownFloor, setActiveDropdownFloor] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize rooms selection
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (initialSelection && Object.keys(initialSelection).length > 0) {
        setRoomsByFloor(JSON.parse(JSON.stringify(initialSelection)));
      } else {
        const defaults: Record<number, RoomSelection[]> = {};
        for (let f = 1; f <= floorsCount; f++) {
          if (f === 1) {
            defaults[f] = [
              { name: "Phòng bếp", count: 1 },
              { name: "Phòng khách", count: 1 },
              { name: "Phòng tắm lớn", count: 1 },
              { name: "Sân vườn", count: 1 },
              { name: "Phòng ăn", count: 1 },
              { name: "Nhà xe / Gara", count: 1 },
            ];
          } else {
            defaults[f] = [
              { name: "Phòng ngủ", count: 2 },
              { name: "Phòng tắm lớn", count: 1 },
              { name: "Phòng sinh hoạt chung", count: 1 },
              { name: "Ban công", count: 1 },
              { name: "Phòng vệ sinh phụ", count: 1 },
              { name: "Phòng làm việc", count: 1 },
            ];
          }
        }
        setRoomsByFloor(defaults);
      }
      setActiveDropdownFloor(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, floorsCount, initialSelection]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownFloor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleIncrement = (floorNum: number, roomName: string) => {
    setRoomsByFloor((prev) => {
      const list = prev[floorNum] || [];
      const updated = list.map((r) =>
        r.name === roomName ? { ...r, count: r.count + 1 } : r
      );
      return { ...prev, [floorNum]: updated };
    });
  };

  const handleDecrement = (floorNum: number, roomName: string) => {
    setRoomsByFloor((prev) => {
      const list = prev[floorNum] || [];
      const target = list.find((r) => r.name === roomName);
      if (!target) return prev;

      let updated: RoomSelection[];
      if (target.count <= 1) {
        // Remove room
        updated = list.filter((r) => r.name !== roomName);
      } else {
        // Decrement room count
        updated = list.map((r) =>
          r.name === roomName ? { ...r, count: r.count - 1 } : r
        );
      }
      return { ...prev, [floorNum]: updated };
    });
  };

  const handleAddRoom = (floorNum: number, roomName: string) => {
    setRoomsByFloor((prev) => {
      const list = prev[floorNum] || [];
      const exists = list.find((r) => r.name === roomName);
      let updated: RoomSelection[];
      if (exists) {
        updated = list.map((r) =>
          r.name === roomName ? { ...r, count: r.count + 1 } : r
        );
      } else {
        updated = [...list, { name: roomName, count: 1 }];
      }
      return { ...prev, [floorNum]: updated };
    });
    setActiveDropdownFloor(null);
  };

  const handleReset = () => {
    const defaults: Record<number, RoomSelection[]> = {};
    for (let f = 1; f <= floorsCount; f++) {
      if (f === 1) {
        defaults[f] = [
          { name: "Phòng bếp", count: 1 },
          { name: "Phòng khách", count: 1 },
          { name: "Phòng tắm lớn", count: 1 },
          { name: "Sân vườn", count: 1 },
          { name: "Phòng ăn", count: 1 },
          { name: "Nhà xe / Gara", count: 1 },
        ];
      } else {
        defaults[f] = [
          { name: "Phòng ngủ", count: 2 },
          { name: "Phòng tắm lớn", count: 1 },
          { name: "Phòng sinh hoạt chung", count: 1 },
          { name: "Ban công", count: 1 },
          { name: "Phòng vệ sinh phụ", count: 1 },
          { name: "Phòng làm việc", count: 1 },
        ];
      }
    }
    setRoomsByFloor(defaults);
    setActiveDropdownFloor(null);
  };

  const handleConfirm = () => {
    const floors = Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b);
    let compiledString: string;

    if (floors.length === 1) {
      const list = roomsByFloor[floors[0]] || [];
      compiledString = list.map((r) => `${r.count} ${r.name}`).join(", ");
    } else {
      compiledString = floors
        .map((f) => {
          const floorLabel = `Tầng ${f}`;
          const list = roomsByFloor[f] || [];
          const roomsStr = list.map((r) => `${r.count} ${r.name}`).join(", ");
          return `${floorLabel}: ${roomsStr}`;
        })
        .join(". ");
    }

    onConfirm(compiledString, roomsByFloor);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141415] border border-[#2d2d30] rounded-2xl w-full max-w-[500px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-[#2d2d30] flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-bold tracking-wide text-slate-100 mx-auto">Thêm phòng</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#252526] rounded-lg text-slate-400 hover:text-slate-100 transition-colors absolute right-6"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Floor List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#2d2d30]">
          {Array.from({ length: floorsCount }).map((_, idx) => {
            const floorNum = idx + 1;
            const floorRooms = roomsByFloor[floorNum] || [];
            const isDropdownOpen = activeDropdownFloor === floorNum;

            return (
              <div
                key={floorNum}
                className="border border-[#2d2d30] rounded-xl bg-[#18181a] relative"
              >
                {/* Floor Header */}
                <div className="bg-[#1c1c1e] px-4 py-2.5 border-b border-[#2d2d30] text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {`Tầng ${floorNum}`}
                </div>

                {/* Rooms Rows */}
                <div className="divide-y divide-[#2d2d30]">
                  {floorRooms.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Chưa chọn phòng nào cho tầng này.
                    </div>
                  ) : (
                    floorRooms.map((room) => {
                      const meta = ROOM_META[room.name] || {
                        label: room.name,
                        icon: Bed,
                      };
                      const IconComponent = meta.icon;

                      return (
                        <div
                          key={room.name}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full border border-[#2d2d30] bg-[#111112] flex items-center justify-center text-slate-300">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-slate-200 text-xs font-medium">
                              {meta.label}
                            </span>
                          </div>

                          {/* Stepper control */}
                          <div className="flex items-center gap-2.5 border border-[#2d2d30] bg-[#111112] rounded-full px-2.5 py-1">
                            <button
                              onClick={() => handleDecrement(floorNum, room.name)}
                              className="text-slate-400 hover:text-rose-500 cursor-pointer select-none transition-colors"
                            >
                              {room.count === 1 ? (
                                <Trash2 className="w-3.5 h-3.5" />
                              ) : (
                                <Minus className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="text-slate-100 text-xs font-semibold w-4 text-center select-none">
                              {room.count}
                            </span>
                            <button
                              onClick={() => handleIncrement(floorNum, room.name)}
                              className="text-slate-400 hover:text-[#00B5CD] cursor-pointer select-none transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add room button and dropdown */}
                <div className="p-3 border-t border-[#2d2d30] flex justify-center relative">
                  <button
                    onClick={() =>
                      setActiveDropdownFloor(isDropdownOpen ? null : floorNum)
                    }
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-[#00b5cd] hover:bg-[#00b5cd]/5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm phòng
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div
                      ref={dropdownRef}
                      className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 bg-[#1c1c1e] border border-[#2d2d30] rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#2d2d30] divide-y divide-[#2d2d30]/50"
                    >
                      {ALL_ROOM_NAMES.map((name) => {
                        const meta = ROOM_META[name];
                        const ItemIcon = meta.icon;
                        return (
                          <button
                            key={name}
                            onClick={() => handleAddRoom(floorNum, name)}
                            className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-[#252526] hover:text-white flex items-center gap-2.5 transition-colors"
                          >
                            <ItemIcon className="w-3.5 h-3.5 text-slate-400" />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2d2d30] bg-[#111112] flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={handleReset}
            className="px-6 py-2 rounded-full border border-[#2d2d30] hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors"
          >
            Đặt lại
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 rounded-full bg-[#00B5CD] hover:bg-[#00b5cd]/90 text-white font-bold text-xs shadow-lg shadow-[#00b5cd]/10 transition-colors"
          >
            Sử dụng phòng đã chọn
          </button>
        </div>
      </div>
    </div>
  );
};
