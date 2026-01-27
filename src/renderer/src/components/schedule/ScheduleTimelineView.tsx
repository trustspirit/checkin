import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  schedulesAtom,
  selectedDateAtom,
  scheduleViewModeAtom,
  customStartDateAtom,
  customEndDateAtom,
  updateScheduleAtom
} from '../../stores/scheduleStore'
import type { ScheduleEvent } from '../../types'
import ScheduleEventCard from './ScheduleEventCard'
import QuickAddPopover from './QuickAddPopover'
import {
  HOURS,
  getWeekDates,
  getCustomDateRange,
  getEventsForDay,
  calculateHorizontalEventPosition,
  isToday,
  createDateWithTime
} from './scheduleUtils'

interface ScheduleTimelineViewProps {
  onEventClick: (event: ScheduleEvent) => void
  onOpenAddModal: (date: Date, startTime: string, endTime: string) => void
}

const HOUR_WIDTH = 80 // pixels per hour
const HALF_HOUR_WIDTH = 40 // pixels per 30 minutes
const ROW_HEIGHT = 80 // pixels per row

// Convert X position to time (hours and minutes)
const xToTime = (x: number): { hours: number; minutes: number } => {
  const totalMinutes = Math.floor(x / HALF_HOUR_WIDTH) * 30 + HOURS[0] * 60
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return { hours, minutes }
}

// Convert time to X position
const timeToX = (hours: number, minutes: number): number => {
  const totalMinutes = hours * 60 + minutes - HOURS[0] * 60
  return (totalMinutes / 30) * HALF_HOUR_WIDTH
}

function ScheduleTimelineView({
  onEventClick,
  onOpenAddModal
}: ScheduleTimelineViewProps): React.ReactElement {
  const schedules = useAtomValue(schedulesAtom)
  const selectedDate = useAtomValue(selectedDateAtom)
  const viewMode = useAtomValue(scheduleViewModeAtom)
  const customStartDate = useAtomValue(customStartDateAtom)
  const customEndDate = useAtomValue(customEndDateAtom)
  const updateSchedule = useSetAtom(updateScheduleAtom)
  const dates = useMemo(() => {
    if (viewMode === 'week') {
      return getWeekDates(selectedDate)
    } else if (viewMode === 'custom') {
      return getCustomDateRange(customStartDate, customEndDate)
    }
    return [selectedDate]
  }, [viewMode, selectedDate, customStartDate, customEndDate])

  // Quick add state
  const [quickAdd, setQuickAdd] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    date: Date
    startTime: Date
    endTime: Date
  } | null>(null)

  // Drag state (now using minutes for 30-min precision)
  const [dragSelection, setDragSelection] = useState<{
    rowIndex: number
    startHours: number
    startMinutes: number
    endHours: number
    endMinutes: number
  } | null>(null)
  const isDragging = useRef(false)
  const justFinishedDragging = useRef(false)

  // Keep selection visible while quick add is open
  const [persistedSelection, setPersistedSelection] = useState<{
    rowIndex: number
    startHours: number
    startMinutes: number
    endHours: number
    endMinutes: number
  } | null>(null)

  // Event drag state
  const [draggedEvent, setDraggedEvent] = useState<ScheduleEvent | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    rowIndex: number
    hours: number
    minutes: number
  } | null>(null)

  // Hover highlight state
  const [hoverCell, setHoverCell] = useState<{ rowIndex: number; hours: number; minutes: number } | null>(null)

  const handleCellHover = useCallback((e: React.MouseEvent, rowIndex: number) => {
    // Don't show hover when dragging selection, dragging event, or quick add is open
    if (isDragging.current || draggedEvent || quickAdd) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const { hours, minutes } = xToTime(x)

    // Clamp to valid range
    const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

    setHoverCell({ rowIndex, hours: clampedHours, minutes })
  }, [draggedEvent, quickAdd])

  const handleCellLeave = useCallback(() => {
    if (!draggedEvent) {
      setHoverCell(null)
    }
  }, [draggedEvent])

  const handleEventHoverStart = useCallback(() => {
    setHoverCell(null)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent, rowIndex: number) => {
    if (e.button !== 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const { hours, minutes } = xToTime(x)

    // Clamp to valid range
    const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

    isDragging.current = true
    setHoverCell(null) // Clear hover when starting drag selection
    setDragSelection({
      rowIndex,
      startHours: clampedHours,
      startMinutes: minutes,
      endHours: clampedHours,
      endMinutes: minutes + 30 >= 60 ? 0 : minutes + 30
    })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      if (!isDragging.current || !dragSelection || dragSelection.rowIndex !== rowIndex) return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, HOURS.length * HOUR_WIDTH))
      const { hours, minutes } = xToTime(x)

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

      const date = dates[dragSelection.rowIndex]

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
        rowIndex: dragSelection.rowIndex,
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
    [dragSelection, dates]
  )

  const handleCellClick = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      // Skip if we just finished dragging (to avoid overwriting persistedSelection)
      if (justFinishedDragging.current) {
        justFinishedDragging.current = false
        return
      }
      if (isDragging.current) return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const { hours, minutes } = xToTime(x)

      // Clamp to valid range
      const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

      const date = dates[rowIndex]
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
        rowIndex,
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
    [dates]
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

  const handleDragOver = useCallback((e: React.DragEvent, rowIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const { hours, minutes } = xToTime(x)

    // Clamp to valid range
    const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

    setDropTarget({ rowIndex, hours: clampedHours, minutes })
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, rowIndex: number) => {
      e.preventDefault()

      try {
        const eventData = JSON.parse(e.dataTransfer.getData('application/json')) as ScheduleEvent
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const { hours, minutes } = xToTime(x)

        // Clamp to valid range
        const clampedHours = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], hours))

        // Calculate duration of the original event
        const originalStart = new Date(eventData.startTime)
        const originalEnd = new Date(eventData.endTime)
        const durationMs = originalEnd.getTime() - originalStart.getTime()

        // New start time
        const targetDate = dates[rowIndex]
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
    [dates, updateSchedule]
  )

  // Current time indicator position
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = nowMinutes - HOURS[0] * 60
  const nowPosition = (nowOffset / 60) * HOUR_WIDTH
  const showNowLine = nowPosition >= 0 && nowPosition <= HOURS.length * HOUR_WIDTH

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E4E6EB] overflow-hidden">
      {/* Header with time labels */}
      <div className="flex border-b border-[#E4E6EB]">
        <div className="w-32 shrink-0 p-3 border-r border-[#E4E6EB] bg-[#F9FAFB]">
          <span className="text-sm font-medium text-[#65676B]">
            {viewMode === 'week' ? '날짜' : '시간'}
          </span>
        </div>
        <div className="flex overflow-x-auto">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex-shrink-0 border-r border-[#E4E6EB] last:border-r-0 flex"
              style={{ width: HOUR_WIDTH }}
            >
              <div className="flex-1 text-center py-2 border-r border-[#E4E6EB]/50 border-dashed">
                <span className="text-xs text-[#65676B]">{hour.toString().padStart(2, '0')}:00</span>
              </div>
              <div className="flex-1 text-center py-2">
                <span className="text-xs text-[#8A8D91]">:30</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline rows */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {dates.map((date, rowIndex) => {
          const dayEvents = getEventsForDay(schedules, date)
          const today = isToday(date)

          return (
            <div
              key={rowIndex}
              className={`flex border-b border-[#E4E6EB] last:border-b-0 ${
                today ? 'bg-[#F8FBFF]' : ''
              }`}
            >
              {/* Date label */}
              <div
                className={`w-32 shrink-0 p-3 border-r border-[#E4E6EB] ${
                  today ? 'bg-[#E7F3FF]' : 'bg-[#F9FAFB]'
                }`}
              >
                <div className="text-xs text-[#65676B]">
                  {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                </div>
                <div
                  className={`text-lg font-semibold ${today ? 'text-[#1877F2]' : 'text-[#050505]'}`}
                >
                  {date.getMonth() + 1}/{date.getDate()}
                </div>
              </div>

              {/* Timeline area */}
              <div
                className={`relative flex-1 cursor-pointer ${draggedEvent && dropTarget?.rowIndex === rowIndex ? 'bg-[#E7F3FF]/50' : ''}`}
                style={{ minWidth: HOURS.length * HOUR_WIDTH, height: ROW_HEIGHT }}
                onMouseDown={(e) => !draggedEvent && handleMouseDown(e, rowIndex)}
                onMouseMove={(e) => {
                  !draggedEvent && handleMouseMove(e, rowIndex)
                  handleCellHover(e, rowIndex)
                }}
                onMouseUp={(e) => !draggedEvent && handleMouseUp(e)}
                onClick={(e) => !draggedEvent && handleCellClick(e, rowIndex)}
                onMouseLeave={handleCellLeave}
                onDragOver={(e) => handleDragOver(e, rowIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, rowIndex)}
              >
                {/* Hour and half-hour grid lines */}
                <div className="absolute inset-0 flex">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-r border-[#E4E6EB] last:border-r-0 relative"
                      style={{ width: HOUR_WIDTH }}
                    >
                      {/* Half-hour line */}
                      <div className="absolute top-0 bottom-0 left-[40px] border-r border-[#E4E6EB]/50 border-dashed" />
                    </div>
                  ))}
                </div>

                {/* Hover highlight */}
                {hoverCell && hoverCell.rowIndex === rowIndex && !dragSelection && !draggedEvent && (
                  <div
                    className="absolute top-2 bottom-2 bg-[#1877F2]/10 rounded-md pointer-events-none z-5 transition-all duration-75"
                    style={{
                      left: timeToX(hoverCell.hours, hoverCell.minutes),
                      width: HALF_HOUR_WIDTH
                    }}
                  />
                )}

                {/* Drag selection overlay */}
                {dragSelection && dragSelection.rowIndex === rowIndex && (() => {
                  const startTotal = dragSelection.startHours * 60 + dragSelection.startMinutes
                  const endTotal = dragSelection.endHours * 60 + dragSelection.endMinutes
                  const minTotal = Math.min(startTotal, endTotal)
                  const maxTotal = Math.max(startTotal, endTotal)
                  const left = timeToX(Math.floor(minTotal / 60), minTotal % 60)
                  const width = Math.max(((maxTotal - minTotal) / 60) * HOUR_WIDTH, HALF_HOUR_WIDTH)
                  return (
                    <div
                      className="absolute top-2 bottom-2 bg-[#1877F2]/20 border-2 border-[#1877F2] border-dashed rounded-lg pointer-events-none z-10"
                      style={{ left, width }}
                    />
                  )
                })()}

                {/* Persisted selection overlay (shown while quick add is open) */}
                {persistedSelection && persistedSelection.rowIndex === rowIndex && !dragSelection && (() => {
                  const startTotal = persistedSelection.startHours * 60 + persistedSelection.startMinutes
                  const endTotal = persistedSelection.endHours * 60 + persistedSelection.endMinutes
                  const left = timeToX(persistedSelection.startHours, persistedSelection.startMinutes)
                  const width = Math.max(((endTotal - startTotal) / 60) * HOUR_WIDTH, HALF_HOUR_WIDTH)
                  return (
                    <div
                      className="absolute top-2 bottom-2 bg-[#1877F2]/20 border-2 border-[#1877F2] rounded-lg pointer-events-none z-10"
                      style={{ left, width }}
                    />
                  )
                })()}

                {/* Drop preview indicator */}
                {draggedEvent && dropTarget?.rowIndex === rowIndex && (() => {
                  const originalStart = new Date(draggedEvent.startTime)
                  const originalEnd = new Date(draggedEvent.endTime)
                  const durationMs = originalEnd.getTime() - originalStart.getTime()
                  const durationMins = durationMs / (1000 * 60)
                  const left = timeToX(dropTarget.hours, dropTarget.minutes)
                  const width = (durationMins / 60) * HOUR_WIDTH
                  return (
                    <div
                      className="absolute top-2 bottom-2 bg-[#1877F2]/30 border-2 border-[#1877F2] rounded-lg pointer-events-none z-10"
                      style={{ left, width: Math.max(width, HALF_HOUR_WIDTH) }}
                    />
                  )
                })()}

                {/* Events */}
                {dayEvents.map((event) => {
                  const { left, width } = calculateHorizontalEventPosition(
                    event,
                    HOUR_WIDTH,
                    HOURS[0]
                  )

                  return (
                    <ScheduleEventCard
                      key={event.id}
                      event={event}
                      onClick={onEventClick}
                      onDragStart={handleEventDragStart}
                      onDragEnd={handleEventDragEnd}
                      onHoverStart={handleEventHoverStart}
                      orientation="horizontal"
                      compact={width < 80}
                      style={{
                        left: `${left}px`,
                        width: `${width - 4}px`,
                        top: '8px',
                        bottom: '8px',
                        height: 'auto'
                      }}
                    />
                  )
                })}

                {/* Now indicator */}
                {today && showNowLine && (
                  <div
                    className="absolute top-0 bottom-0 z-30 pointer-events-none"
                    style={{ left: nowPosition }}
                  >
                    <div className="w-0.5 h-full bg-red-500" />
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
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

export default ScheduleTimelineView
