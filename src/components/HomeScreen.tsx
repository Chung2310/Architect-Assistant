import React from 'react';
import { Icon } from './Icon';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface ToolCardProps {
  title: string;
  description: string;
  image: string;
  icon: string;
  slug: string;
  onClick: () => void;
  index: number;
  isLocked?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, image, icon, slug, onClick, index, isLocked }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    whileHover={isLocked ? {} : { y: -6, scale: 1.015 }}
    whileTap={isLocked ? {} : { scale: 0.99 }}
    onClick={onClick}
    className={`group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer ${isLocked ? 'opacity-55 grayscale-[20%] hover:opacity-70' : ''
      }`}
  >
    <div className="h-[240px] relative overflow-hidden">
      <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" src={image} alt={title} referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
      <div className="absolute top-6 left-6 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 transition-transform duration-300 group-hover:rotate-6">
        <Icon name={icon} className="text-white" />
      </div>
      {isLocked && (
        <div className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
          <Icon name="lock" className="text-white text-sm animate-pulse" />
        </div>
      )}
    </div>
    <div className="p-8">
      <div className="text-[11px] font-mono font-medium text-primary/80 mb-3 bg-primary/10 inline-block px-2.5 py-1 rounded-md tracking-wider transition-colors duration-300 group-hover:bg-primary/20 group-hover:text-primary">
        {isLocked ? "COMING SOON" : slug}
      </div>
      <h3 className="text-xl font-semibold mb-3 text-on-surface">
        <span className="text-primary font-bold">iGen</span> {title}
      </h3>
      <p className="text-on-surface-variant text-sm leading-relaxed mb-6 h-12 overflow-hidden">
        {description}
      </p>
      <button className="inline-flex items-center gap-2 text-primary font-bold text-xs tracking-wider group-hover:gap-4 transition-all uppercase bg-transparent border-0 cursor-pointer">
        {isLocked ? "ĐANG PHÁT TRIỂN" : "SỬ DỤNG TÍNH NĂNG"}
        <Icon name={isLocked ? "construction" : "arrow_forward"} className="text-sm" />
      </button>
    </div>
  </motion.div>
);

export const HomeScreen: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const tools = [
    {
      id: 'rendering',
      title: 'RENDERING',
      description: 'Render nội/ngoại thất, cảnh quan, quy hoạch, floorplan, VR 360 với độ phân giải siêu thực.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBt7X0xsFG_TUqw5NaHGX-WPzlGP-zLW40rlzsiFf-dLdNlYb2nEn_XnO-QtL4lteoAC9hi10RI_zF9LPqTc7zdyXVCj2SproTb5Fsoei_wM-k-2deKjmmV3gPM6amPBMt11N4CuuNsi6gMV6UCCDP0hdmox_KYIxkJftC8S4zZ2FEpe69HtVnpHIhScvP2T-w_1XrkJ9G1Uob657Lbz4YcUs_o2rW1qnGI_G6cXxrCFjKovGjmItOgOcB5ifniY-cIPWTxq6rcwEy6',
      icon: 'architecture',
      slug: '/tools/rendering'
    },
     {
      id: 'floorplan',
      title: 'VẼ BẢN VẼ AI',
      description: 'Tự động phân chia mặt bằng phòng bằng AI, vẽ sơ đồ thiết kế 2D/3D chi tiết và xuất bản vẽ chất lượng cao.',
      image: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=800&q=80',
      icon: 'layers',
      slug: '/tools/floor-plan'
    },
    {
      id: 'video',
      title: 'VIDEO',
      description: 'Tạo kịch bản, video và add nhân vật vào phim kiến trúc/nội thất chuyên nghiệp.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBT9Y72EEVknotPzqvRmEfxhlqhQpn3oOsdUTR8AajP6R9KDiOOqgKYvjTgeAK4mfKc1FNa2OlFSeziL1CU-8xkPLHAY5sKNmM9jh2LB2lEMm9vN_J1dJX17qAD69KVVUPoAjYLOPVtZrcnPyHxUMXaWWciP7kLvRWIo_jMgla1wLJnSPBRffJ9XM29j_TzM3SpATXg2Z3ZGbaDjvEoWaShHCHKAhObVuuLZe9YYlsrUb5eu258Dh1OhWfEI-2ZIIi0B9b_SRgeBulC',
      icon: 'movie_filter',
      slug: '/tools/video'
    },
    {
      id: 'visual',
      title: 'VISUAL',
      description: 'Tạo mood lighting bám theo reference hoặc tự động tối ưu hóa ánh sáng tự nhiên.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrT07lYimACAEVMSvapV0UpOWNEBw7TI19qo19SJuIKIIoXtkeTipS04uVjNC8VwnYJlfu_NRHNZ88Lf3-oDMNpfnjjYXw_36lHk5aIBco46ic7NJb3l6XS93ZJq8nPuinVF3Ug7LTt5GOUHUZslVNwcxDotRSFtTi0ENQ5SBiWrWvVmiznaM4qimW3-T7qKMlcB20fZgFSVf4Z62WMjh6x9hnJdBXBQsvdFq75c7EEXAJvPdybUMv5V6GoROGPcEe6I3JqpEYcPCJ',
      icon: 'light_mode',
      slug: '/tools/visual'
    },
    {
      id: 'texturelab',
      title: 'TEXTURELAB',
      description: 'Tạo PBR texture từ ảnh gốc, fix seamless cho các vật liệu kiến trúc đặc thù.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC4TN4X5VCS0FsV__xWqobihbnj2pxRo_34fYf66-0f0DiFv6DNaYtlK6cncpu_U7rtSlh6fMqUEi2WvGV2gvmxW1D0H9WqwtX0g6Rf0M2q1OzGgA2hzx-cWZIeBZekYOZDq5YPD1RKn14sxd9AT5lORPOFm6jjvkCVJzen8gWk_pcrLmkwRY6bLFc64jVUnLTtk85e-4eKoyZ5oEBcgSy6uen73TXvN3YtQrBwupSP1qbzCbZtRbveD8RV2iZeb9cVPAKH7g588dJz',
      icon: 'texture',
      slug: '/tools/texture-lab'
    },
    {
      id: 'humanenhancer',
      title: 'HUMAN ENHANCER',
      description: 'Cải thiện người 3d render và add thêm người vào cảnh với tỷ lệ chính xác.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWZc-UM04oX9_EJW7kRooleJyFtrWWtwaD1EGY-culjX8xj3Advrw9nUetH0v1uk1YDApcs6qLIiFbtpLdawYb8I7UsxqCBQ7EFLFhdGSw_5Ep7OgHGG6n-cusTAEm-LQlZia1p4KeWn0nXri5jxPfrk2BRf3BfqGO4qph7EnEsMs6vXlojcWt1yAfT-z-rwNpVqswdjWBRDUu39jzIohwrjLQGKdz152Eoxh0PjfIsYwRsvN2vYXMgpIO9qbUSxmdhCEESNUSGfYD',
      icon: 'groups',
      slug: '/tools/human-enhancer'
    },
    {
      id: 'virtualstaging',
      title: 'VIRTUAL STAGING',
      description: 'Ghép nội thất vào phòng chính xác theo vị trí và moodboard thiết kế.',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9v5ApkYjTvNM3s20AAy_bjY8REe_ZTJ9vhka_sdsax96ToGzJsYwSTMdGs7pcgK1wgnh97g-6AJH_GTztS1pZ9bNWkuC5LgoKmO9gLO06X48eyDpL7Ui7UhxuVW0VSCQTw4P9YUf-3wHgPJLiJ33BWnK5EoSfYc69NXvGeSLuCipewqzjNunoyMiMiCSSuOOHyXG2BY10CEO3s2IUl-7zq_SZjW7x3BECf3oV93AC0xEYqprwKttWVn4Y1mBJsgT4EslE7P6ZdQKl',
      icon: 'chair',
      slug: '/tools/virtual-staging'
    }
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mb-12"
      >
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {tools.map((tool, index) => {
          const isLocked = tool.id !== 'rendering' && tool.id !== 'floorplan';
          return (
            <ToolCard
              key={tool.id}
              title={tool.title}
              description={tool.description}
              image={tool.image}
              icon={tool.icon}
              slug={tool.slug}
              index={index}
              isLocked={isLocked}
              onClick={() => {
                if (isLocked) {
                  toast.info("Tính năng này đang được phát triển và sẽ sớm ra mắt!");
                } else {
                  onNavigate(tool.slug);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
