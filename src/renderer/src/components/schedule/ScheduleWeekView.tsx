import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  schedulesAtom,
  selectedDateAtom,
  updateScheduleAtom,
  scheduleViewModeAtom,
  customStartDateAtom,
  customEndDateAtom
} from '../../stores/scheduleStore'
import type { ScheduleEvent } from '../../types'
import ScheduleEventCard from './ScheduleEventCard'
import QuickAddPopover from './QuickAddPopover'
import {
  HOURS,
  getWeekDates,
  getCustomDateRange,
  getEventsForDay,
  calculateEventPosition,
  isToday,
  groupOverlappingEvents,
  createDateWithTime,
  getCurrentTimePosition
} from './scheduleUtils'

interface ScheduleWeekViewProps {
  onEventClick: (event: ScheduleEvent) => void
  onOpenAddModal: (date: Date, startTime: string, endTime: string) => void
}

const HOUR_HEIGHT = 60 // pixels per hour
const HALF_HOUR_HEIGHT = 30 // pixels per 30 minutes

// Convert Y position to time (hours and minutes)
const yToTime = (y: number): { hours: number; minutes: number } => {
  const totalMinutes = Math.floor(y / HALF_HOUR_HEIGHT) * 30 + HOURS[0] * 60
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return { hours, minutes }
}

// Convert time to Y position
const timeToY = (hours: number, minutes: number): number => {
  const totalMinutes = hours * 60 + minutes - HOURS[0] * 60
  return (totalMinutes / 30) * HALF_HOUR_HEIGHT
}

function ScheduleWeekView({
  onEventClick,
  onOpenAddModal
}: ScheduleWeekViewProps): React.ReactElement {
  const schedules = useAtomValue(schedulesAtom)
  const selectedDate = useAtomValue(selectedDateAtom)
  const viewMode = useAtomValue(scheduleViewModeAtom)
  const customStartDate = useAtomValue(customStartDateAtom)
  const customEndDate = useAtomValue(customEndDateAtom)
  const updateSchedule = useSetAtom(updateScheduleAtom)

  // Get dates based on view mode
  const weekDates = useMemo(() => {
    if (viewMode === 'custom') {
      return getCustomDateRange(customStartDate, customEndDate)
    }
    return getWeekDates(selectedDate)
  }, [viewMode, selectedDate, customStartDate, customEndDate])

  const containerRef = useRef<HTMLDivElement>(null)

  // Quick add state
  const [quickAdd, setQuickAdd] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    date: Date
    startTime: Date
    endTime: Date
  } | null>(null)

  // Drag selection state (now using minutes for 30-min precision)
  const [dragSelection, setDragSelection] = useState<{
    dayIndex: number
    startHours: number
    startMinutes: number
    endHours: number
    endMinutes: number
  } | null>(null)
  const isDragging = useRef(false)
  const justFinishedDragging = useRef(false)

  // Keep selection visible while quick add is open
  const [persistedSelection, setPersistedSelection] = useState<{
    dayIndex: number
    startHours: number
    startMinutes: number
    endHours: number
    endMinutes: number
  } | null>(null)

  // Event drag state
  const [draggedEvent, setDraggedEvent] = useState<ScheduleEvent | null>(null)
  const [dropTarget, setDropTarget] = useState<{ dayIndex: number; hours: number; minutes: number } | null>(null)

  // Hover highlight state
  const [hoverCell, setHoverCell] = useState<{ dayIndex: number; hours: number; minutes: number } | null>(null)

  const handleCellHover = useCallback((e: React.MouseEvent, dayIndex: number) => {
    // Don't show hover when dragging selection, dragging event, or quick add is open
    if (isDragging.current || draggedEvent || quickAdd) return

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const { hours, minutes } = yToTime(y)

    // Clamp to valid range
    const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

    setHoverCell({ dayIndex, hours: clampedHours, minutes })
  }, [draggedEvent, quickAdd])

  const handleCellLeave = useCallback(() => {
    if (!draggedEvent) {
      setHoverCell(null)
    }
  }, [draggedEvent])

  const handleEventHoverStart = useCallback(() => {
    setHoverCell(null)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if (e.button !== 0) return // Only left click

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const { hours, minutes } = yToTime(y)

    // Clamp to valid range
    const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

    isDragging.current = true
    setHoverCell(null) // Clear hover when starting drag selection
    setDragSelection({
      dayIndex,
      startHours: clampedHours,
      startMinutes: minutes,
      endHours: clampedHours,
      endMinutes: minutes + 30 >= 60 ? 0 : minutes + 30
    })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!isDragging.current || !dragSelection || dragSelection.dayIndex !== dayIndex) return

      const rect = e.currentTarget.getBoundingClientRect()
      const y = Math.max(0, Math.min(e.clientY - rect.top, HOURS.length * HOUR_HEIGHT))
      const { hours, minutes } = yToTime(y)

      // Clamp to valid range
      const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1] + 1, hours))

      setDragSelection((prev) => {
        if (!prev) return null
        return { ...prev, endHours: clampedHours, endMinutes: minutes }
      })
    },
    [dragSelection]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || !dragSelection) {
        isDragging.current = false
        return
      }

      isDragging.current = false
      justFinishedDragging.current = true

      const date = weekDates[dragSelection.dayIndex]

      // Calculate start and end times
      const startTotal = dragSelection.startHours * 60 + dragSelection.startMinutes
      const endTotal = dragSelection.endHours * 60 + dragSelection.endMinutes

      const minTotal = Math.min(startTotal, endTotal)
      const maxTotal = Math.max(startTotal, endTotal)

      // Ensure minimum 30 min duration
      const finalEndTotal = maxTotal <= minTotal ? minTotal + 30 : maxTotal

      const startTime = createDateWithTime(date, Math.floor(minTotal / 60), minTotal % 60)
      const endTime = createDateWithTime(date, Math.floor(finalEndTotal / 60), finalEndTotal % 60)

      // Persist the selection for display while quick add is open
      setPersistedSelection({
        dayIndex: dragSelection.dayIndex,
        startHours: Math.floor(minTotal / 60),
        startMinutes: minTotal % 60,
        endHours: Math.floor(finalEndTotal / 60),
        endMinutes: finalEndTotal % 60
      })

      setQuickAdd({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        date,
        startTime,
        endTime
      })

      setDragSelection(null)
    },
    [dragSelection, weekDates]
  )

  const handleCellClick = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      // Skip if we just finished dragging (to avoid overwriting persistedSelection)
      if (justFinishedDragging.current) {
        justFinishedDragging.current = false
        return
      }
      // Only handle single click (not drag)
      if (isDragging.current) return

      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const { hours, minutes } = yToTime(y)

      // Clamp to valid range
      const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

      const date = weekDates[dayIndex]
      const startTime = createDateWithTime(date, clampedHours, minutes)
      // Default to 30 min duration for click
      const endMinutes = minutes + 30
      const endTime = createDateWithTime(
        date,
        endMinutes >= 60 ? clampedHours + 1 : clampedHours,
        endMinutes >= 60 ? 0 : endMinutes
      )

      // Persist the selection for display while quick add is open
      setPersistedSelection({
        dayIndex,
        startHours: clampedHours,
        startMinutes: minutes,
        endHours: endMinutes >= 60 ? clampedHours + 1 : clampedHours,
        endMinutes: endMinutes >= 60 ? 0 : endMinutes
      })

      setQuickAdd({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        date,
        startTime,
        endTime
      })
    },
    [weekDates]
  )

  // Event drag handlers
  const handleEventDragStart = useCallback((event: ScheduleEvent) => {
    setDraggedEvent(event)
    setHoverCell(null) // Clear hover when starting event drag
  }, [])

  const handleEventDragEnd = useCallback(() => {
    setDraggedEvent(null)
    setDropTarget(null)
    setHoverCell(null) // Clear hover when ending event drag
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, dayIndex: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const { hours, minutes } = yToTime(y)

      // Clamp to valid range
      const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

      setDropTarget({ dayIndex, hours: clampedHours, minutes })
    },
    []
  )

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, dayIndex: number) => {
      e.preventDefault()

      try {
        const eventData = JSON.parse(e.dataTransfer.getData('application/json')) as ScheduleEvent
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const { hours, minutes } = yToTime(y)

        // Clamp to valid range
        const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

        // Calculate duration of the original event
        const originalStart = new Date(eventData.startTime)
        const originalEnd = new Date(eventData.endTime)
        const durationMs = originalEnd.getTime() - originalStart.getTime()

        // New start time
        const targetDate = weekDates[dayIndex]
        const newStartTime = createDateWithTime(targetDate, clampedHours, minutes)
        const newEndTime = new Date(newStartTime.getTime() + durationMs)

        // Update the event
        await updateSchedule({
          id: eventData.id,
          data: {
            startTime: newStartTime,
            endTime: newEndTime
          }
        })
      } catch (error) {
        console.error('Failed to drop event:', error)
      }

      setDraggedEvent(null)
      setDropTarget(null)
      setHoverCell(null)
      setPersistedSelection(null)
    },
    [weekDates, updateSchedule]
  )

  const nowPosition = getCurrentTimePosition(HOUR_HEIGHT, HOURS[0])
  const showNowLine = nowPosition >= 0 && nowPosition <= HOURS.length * HOUR_HEIGHT

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E4E6EB] overflow-hidden">
      {/* Scrollable container for both header and content */}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        {/* Header with day names - sticky */}
        <div
          className="grid border-b border-[#E4E6EB] sticky top-0 z-40 bg-white"
          style={{ gridTemplateColumns: `60px repeat(${weekDates.length}, 1fr)` }}
        >
          <div className="p-2 border-r border-[#E4E6EB] bg-white" />
          {weekDates.map((date, index) => {
            const today = isToday(date)
            return (
              <div
                key={index}
                className={`p-3 text-center border-r border-[#E4E6EB] last:border-r-0 ${
                  today ? 'bg-[#E7F3FF]' : 'bg-white'
                }`}
              >
                <div className="text-xs text-[#65676B] uppercase">
                  {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                </div>
                <div
                  className={`text-lg font-semibold ${
                    today
                      ? 'w-8 h-8 bg-[#1877F2] text-white rounded-full mx-auto flex items-center justify-center'
                      : 'text-[#050505]'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div
          className="grid relative"
          style={{ gridTemplateColumns: `60px repeat(${weekDates.length}, 1fr)` }}
        >
          {/* Time labels */}
          <div className="border-r border-[#E4E6EB] pt-0">
            {HOURS.map((hour, index) => (
              <div
                key={hour}
                className={`h-[60px] text-xs text-[#65676B] text-right pr-2 flex items-start justify-end ${index === 0 ? 'pt-1' : ''}`}
              >
                <span className="-mt-2">{hour.toString().padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => {
            const dayEvents = getEventsForDay(schedules, date)
            const eventGroups = groupOverlappingEvents(dayEvents)
            const today = isToday(date)
            const isDropTarget = dropTarget?.dayIndex === dayIndex

            return (
              <div
                key={dayIndex}
                className={`relative border-r border-[#E4E6EB] last:border-r-0 cursor-pointer ${
                  today ? 'bg-[#F8FBFF]' : ''
                } ${isDropTarget && draggedEvent ? 'bg-[#E7F3FF]/50' : ''}`}
                onMouseDown={(e) => !draggedEvent && handleMouseDown(e, dayIndex)}
                onMouseMove={(e) => {
                  !draggedEvent && handleMouseMove(e, dayIndex)
                  handleCellHover(e, dayIndex)
                }}
                onMouseUp={(e) => !draggedEvent && handleMouseUp(e)}
                onClick={(e) => !draggedEvent && handleCellClick(e, dayIndex)}
                onMouseLeave={handleCellLeave}
                onDragOver={(e) => handleDragOver(e, dayIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dayIndex)}
              >
                {/* Hour and half-hour lines */}
                {HOURS.map((hour) => (
                  <div key={hour} className="h-[60px] border-b border-[#E4E6EB] last:border-b-0 relative">
                    {/* Half-hour line */}
                    <div className="absolute left-0 right-0 top-[30px] border-b border-[#E4E6EB]/50 border-dashed" />
                  </div>
                ))}

                {/* Hover highlight */}
                {hoverCell && hoverCell.dayIndex === dayIndex && !dragSelection && !draggedEvent && (
                  <div
                    className="absolute left-1 right-1 bg-[#1877F2]/10 rounded-md pointer-events-none z-5 transition-all duration-75"
                    style={{
                      top: timeToY(hoverCell.hours, hoverCell.minutes),
                      height: HALF_HOUR_HEIGHT
                    }}
                  />
                )}

                {/* Drag selection overlay */}
                {dragSelection && dragSelection.dayIndex === dayIndex && (() => {
                  const startTotal = dragSelection.startHours * 60 + dragSelection.startMinutes
                  const endTotal = dragSelection.endHours * 60 + dragSelection.endMinutes
                  const minTotal = Math.min(startTotal, endTotal)
                  const maxTotal = Math.max(startTotal, endTotal)
                  const top = timeToY(Math.floor(minTotal / 60), minTotal % 60)
                  const height = Math.max(((maxTotal - minTotal) / 60) * HOUR_HEIGHT, HALF_HOUR_HEIGHT)
                  return (
                    <div
                      className="absolute left-1 right-1 bg-[#1877F2]/20 border-2 border-[#1877F2] border-dashed rounded-lg pointer-events-none z-10"
                      style={{ top, height }}
                    />
                  )
                })()}

                {/* Persisted selection overlay (shown while quick add is open) */}
                {persistedSelection && persistedSelection.dayIndex === dayIndex && !dragSelection && (() => {
                  const startTotal = persistedSelection.startHours * 60 + persistedSelection.startMinutes
                  const endTotal = persistedSelection.endHours * 60 + persistedSelection.endMinutes
                  const top = timeToY(persistedSelection.startHours, persistedSelection.startMinutes)
                  const height = Math.max(((endTotal - startTotal) / 60) * HOUR_HEIGHT, HALF_HOUR_HEIGHT)
                  return (
                    <div
                      className="absolute left-1 right-1 bg-[#1877F2]/20 border-2 border-[#1877F2] rounded-lg pointer-events-none z-10"
                      style={{ top, height }}
                    />
                  )
                })()}

                {/* Drop preview indicator */}
                {draggedEvent && isDropTarget && dropTarget && (() => {
                  const originalStart = new Date(draggedEvent.startTime)
                  const originalEnd = new Date(draggedEvent.endTime)
                  const durationMs = originalEnd.getTime() - originalStart.getTime()
                  const durationMins = durationMs / (1000 * 60)
                  const top = timeToY(dropTarget.hours, dropTarget.minutes)
                  const height = (durationMins / 60) * HOUR_HEIGHT
                  return (
                    <div
                      className="absolute left-1 right-1 bg-[#1877F2]/30 border-2 border-[#1877F2] rounded-lg pointer-events-none z-10"
                      style={{ top, height: Math.max(height, HALF_HOUR_HEIGHT) }}
                    />
                  )
                })()}

                {/* Events */}
                {eventGroups.map((group, groupIndex) => {
                  const width = 100 / group.length

                  return group.map((event, eventIndex) => {
                    const { top, height } = calculateEventPosition(event, HOUR_HEIGHT, HOURS[0])
                    const leftPercent = eventIndex * width
                    const widthPercent = width - 2 // Small gap between overlapping events

                    return (
                      <ScheduleEventCard
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        onDragStart={handleEventDragStart}
                        onDragEnd={handleEventDragEnd}
                        onHoverStart={handleEventHoverStart}
                        compact={height < 40}
                        style={{
                          top: `${top}px`,
                          height: `${height - 4}px`,
                          left: `calc(${leftPercent}% + 4px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                          zIndex: 20 + groupIndex
                        }}
                      />
                    )
                  })
                })}

                {/* Now indicator */}
                {today && showNowLine && (
                  <div
                    className="absolute left-0 right-0 z-30 pointer-events-none"
                    style={{ top: nowPosition }}
                  >
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5" />
                      <div className="flex-1 h-0.5 bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Add Popover */}
      {quickAdd && (
        <QuickAddPopover
          isOpen={quickAdd.isOpen}
          onClose={() => {
            setQuickAdd(null)
            setPersistedSelection(null)
          }}
          position={quickAdd.position}
          date={quickAdd.date}
          startTime={quickAdd.startTime}
          endTime={quickAdd.endTime}
          onOpenFullModal={onOpenAddModal}
        />
      )}
    </div>
  )
}

export default ScheduleWeekView
