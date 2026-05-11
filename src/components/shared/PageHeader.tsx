import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="mb-6">
      <h1 className="text-xl lg:text-2xl font-bold text-navy">{title}</h1>
      {subtitle && <p className="text-[13px] text-gray mt-1">{subtitle}</p>}
    </div>
  )
}
