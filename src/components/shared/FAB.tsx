import React from 'react'
import { Plus } from 'lucide-react'

interface FABProps {
  onClick: () => void
}

export const FAB: React.FC<FABProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="md:hidden fixed bottom-20 right-4 w-[52px] h-[52px] bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
    >
      <Plus size={24} />
    </button>
  )
}
