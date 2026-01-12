import React from 'react'

type TooltipPosition = 'top' | 'bottom'

interface TooltipProps {
  title: string
  items: Array<{ id: string; name: string }>
  maxItems?: number
  position?: TooltipPosition
}

function Tooltip({
  title,
  items,
  maxItems = 5,
  position = 'bottom'
}: TooltipProps): React.ReactElement {
  const displayItems = items.slice(0, maxItems)
  const remainingCount = items.length - maxItems

  const positionClasses = position === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'

  const arrowClasses =
    position === 'bottom' ? 'bottom-full border-b-[#050505]' : 'top-full border-t-[#050505]'

  const arrowBorderClasses =
    position === 'bottom'
      ? 'border-l-4 border-r-4 border-b-4 border-transparent border-b-[#050505]'
      : 'border-l-4 border-r-4 border-t-4 border-transparent border-t-[#050505]'

  return (
    <div
      className={`absolute left-0 ${positionClasses} bg-[#050505] text-white text-xs rounded-lg py-2 px-3 z-30 min-w-[160px] max-w-[240px] shadow-lg pointer-events-none`}
    >
      <div className={`absolute left-4 ${arrowClasses} w-0 h-0 ${arrowBorderClasses}`} />
      <div className="font-semibold mb-1">{title}:</div>
      {displayItems.map((item) => (
        <div key={item.id} className="truncate">
          {item.name}
        </div>
      ))}
      {remainingCount > 0 && <div className="text-gray-400 mt-1">+{remainingCount} more</div>}
    </div>
  )
}

export default Tooltip
