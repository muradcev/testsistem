import { ReactNode } from 'react'
import clsx from 'clsx'
import {
  InboxIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  UserGroupIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'

type EmptyStateVariant = 'default' | 'search' | 'noData' | 'noUsers' | 'noLocations'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title?: string
  description?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  action?: ReactNode
  className?: string
}

const variantConfig = {
  default: {
    icon: InboxIcon,
    title: 'Veri Bulunamadı',
    description: 'Henüz gösterilecek veri yok.',
  },
  search: {
    icon: MagnifyingGlassIcon,
    title: 'Sonuç Bulunamadı',
    description: 'Arama kriterlerinize uygun sonuç bulunamadı. Farklı anahtar kelimeler deneyin.',
  },
  noData: {
    icon: DocumentIcon,
    title: 'Veri Yok',
    description: 'Bu bölümde henüz veri bulunmuyor.',
  },
  noUsers: {
    icon: UserGroupIcon,
    title: 'Kullanıcı Bulunamadı',
    description: 'Gösterilecek kullanıcı yok.',
  },
  noLocations: {
    icon: MapPinIcon,
    title: 'Konum Verisi Yok',
    description: 'Bu şoför için konum verisi bulunmuyor.',
  },
}

export function EmptyState({
  variant = 'default',
  title,
  description,
  icon: CustomIcon,
  action,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const Icon = CustomIcon || config.icon

  return (
    <div className={clsx('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {title || config.title}
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
        {description || config.description}
      </p>
      {action && <div>{action}</div>}
    </div>
  )
}
