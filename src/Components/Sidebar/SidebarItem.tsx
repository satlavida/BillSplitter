import type { ReactNode } from 'react';

interface SidebarItemProps {
  icon: ReactNode;
  label: ReactNode;
  isActive: boolean;
  onClick: (id: string | number) => void;
  id: string | number;
  isOpen: boolean;
}

const SidebarItem = ({ icon, label, isActive, onClick, id, isOpen }: SidebarItemProps) => {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center w-full p-3 mb-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      <span className={`${isOpen ? 'mr-3' : ''}`}>{icon}</span>
      {isOpen && <span className={`transition-opacity duration-200 ${isActive ? 'font-semibold' : ''}`}>{label}</span>}
    </button>
  );
};

export default SidebarItem;
