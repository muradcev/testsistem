import { ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backButton?: boolean
  backTo?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  actions?: ReactNode
  tabs?: ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  backButton,
  backTo,
  icon: Icon,
  actions,
  tabs,
  breadcrumb,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <div className={clsx('mb-6', className)}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-3">
          <ol className="flex items-center gap-2 text-sm">
            {breadcrumb.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                {index > 0 && <span className="text-gray-300">/</span>}
                {item.href ? (
                  <a
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(item.href!)
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span className="text-gray-700 font-medium">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {backButton && (
            <button
              onClick={handleBack}
              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-3">{actions}</div>
        )}
      </div>

      {/* Tabs */}
      {tabs && <div className="mt-6">{tabs}</div>}
    </div>
  )
}
