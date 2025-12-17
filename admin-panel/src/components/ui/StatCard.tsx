import clsx from 'clsx'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  color?: 'primary' | 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'yellow'
  className?: string
  onClick?: () => void
}

const colorVariants = {
  primary: {
    bg: 'bg-gradient-to-br from-primary-500 to-primary-600',
    iconBg: 'bg-primary-400/30',
    text: 'text-white',
    subtitleText: 'text-primary-100',
    trendBg: 'bg-white/20',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-400/30',
    text: 'text-white',
    subtitleText: 'text-emerald-100',
    trendBg: 'bg-white/20',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    iconBg: 'bg-blue-400/30',
    text: 'text-white',
    subtitleText: 'text-blue-100',
    trendBg: 'bg-white/20',
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-500 to-orange-600',
    iconBg: 'bg-orange-400/30',
    text: 'text-white',
    subtitleText: 'text-orange-100',
    trendBg: 'bg-white/20',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-500 to-red-600',
    iconBg: 'bg-red-400/30',
    text: 'text-white',
    subtitleText: 'text-red-100',
    trendBg: 'bg-white/20',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    iconBg: 'bg-purple-400/30',
    text: 'text-white',
    subtitleText: 'text-purple-100',
    trendBg: 'bg-white/20',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    iconBg: 'bg-amber-400/30',
    text: 'text-white',
    subtitleText: 'text-amber-100',
    trendBg: 'bg-white/20',
  },
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'primary',
  className,
  onClick,
}: StatCardProps) {
  const colors = colorVariants[color]

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-5 shadow-lg transition-all duration-300',
        colors.bg,
        onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-xl',
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-32 w-32 rounded-full bg-white/5" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className={clsx('text-sm font-medium', colors.subtitleText)}>
            {title}
          </p>
          <p className={clsx('mt-2 text-3xl font-bold', colors.text)}>
            {value}
          </p>
          {subtitle && (
            <p className={clsx('mt-1 text-sm', colors.subtitleText)}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={clsx('mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', colors.trendBg, colors.text)}>
              {trend.isPositive !== false ? (
                <ArrowUpIcon className="h-3 w-3" />
              ) : (
                <ArrowDownIcon className="h-3 w-3" />
              )}
              <span>{trend.value}%</span>
              {trend.label && <span className="opacity-75">vs {trend.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={clsx('rounded-xl p-3', colors.iconBg)}>
            <Icon className={clsx('h-6 w-6', colors.text)} />
          </div>
        )}
      </div>
    </div>
  )
}

interface MiniStatCardProps {
  title: string
  value: string | number
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color?: 'gray' | 'green' | 'blue' | 'orange' | 'red' | 'purple'
  className?: string
  onClick?: () => void
}

const miniColorVariants = {
  gray: {
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  green: {
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  blue: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  orange: {
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  red: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  purple: {
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
}

export function MiniStatCard({
  title,
  value,
  icon: Icon,
  color = 'gray',
  className,
  onClick,
}: MiniStatCardProps) {
  const colors = miniColorVariants[color]

  return (
    <div
      onClick={onClick}
      className={clsx(
        'flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-200',
        className
      )}
    >
      {Icon && (
        <div className={clsx('rounded-lg p-2.5', colors.iconBg)}>
          <Icon className={clsx('h-5 w-5', colors.iconColor)} />
        </div>
      )}
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
