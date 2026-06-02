import type { Metadata } from 'next'
import Sidebar from '@/components/admin/Sidebar'

export const metadata: Metadata = { title: 'Admin — Make My Coffee' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 min-h-screen">
        {children}
      </div>
    </div>
  )
}
