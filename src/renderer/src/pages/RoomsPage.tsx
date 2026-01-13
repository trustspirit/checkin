import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { roomsAtom, participantsAtom, syncAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { createOrGetRoom, deleteRoom } from '../services/firebase'
import { writeAuditLog } from '../services/auditLog'
import type { Room } from '../types'
import { ViewMode, RoomStatus } from '../types'
import { ViewModeToggle, Tooltip, StatusDot, getRoomStatus, ImportCSVPanel } from '../components'

function RoomsPage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const rooms = useAtomValue(roomsAtom)
  const participants = useAtomValue(participantsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)
  const [isAdding, setIsAdding] = useState(false)
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newRoomCapacity, setNewRoomCapacity] = useState(4)
  const [isImporting, setIsImporting] = useState(false)
  const [csvInput, setCsvInput] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.List)
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  const handleAddRoom = async () => {
    if (!newRoomNumber.trim()) return
    try {
      const room = await createOrGetRoom(newRoomNumber.trim(), newRoomCapacity)
      await writeAuditLog(userName || 'Unknown', 'create', 'room', room.id, room.roomNumber)
      addToast({ type: 'success', message: t('room.roomCreated', { number: room.roomNumber }) })
      setNewRoomNumber('')
      setNewRoomCapacity(4)
      setIsAdding(false)
      sync()
    } catch (error) {
      addToast({ type: 'error', message: t('toast.createFailed') })
    }
  }

  const handleDeleteRoom = async (room: Room) => {
    const warningMsg =
      room.currentOccupancy > 0
        ? t('room.confirmDeleteWithParticipants', { number: room.roomNumber, count: room.currentOccupancy })
        : t('room.confirmDelete', { number: room.roomNumber })
    if (!confirm(warningMsg)) return
    try {
      await deleteRoom(room.id)
      await writeAuditLog(userName || 'Unknown', 'delete', 'room', room.id, room.roomNumber)
      addToast({ type: 'success', message: t('room.roomDeleted', { number: room.roomNumber }) })
      sync()
    } catch (error) {
      addToast({ type: 'error', message: t('toast.deleteFailed') })
    }
  }

  const handleImportCSV = async () => {
    if (!csvInput.trim()) return
    const lines = csvInput
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    let created = 0

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim())
      const roomNumber = parts[0]
      const capacity = parseInt(parts[1]) || 4
      if (!roomNumber) continue
      try {
        const room = await createOrGetRoom(roomNumber, capacity)
        await writeAuditLog(userName || 'Unknown', 'import', 'room', room.id, room.roomNumber)
        created++
      } catch {
        console.error(`Failed to create room: ${roomNumber}`)
      }
    }

    addToast({ type: 'success', message: t('room.importedCount', { count: created }) })
    setCsvInput('')
    setIsImporting(false)
    sync()
  }

  const handleFileImport = async () => {
    const content = await window.electronAPI.openFileDialog()
    if (!content) return

    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const hasHeader =
      lines[0]?.toLowerCase().includes('room') || lines[0]?.toLowerCase().includes('capacity')
    const dataLines = hasHeader ? lines.slice(1) : lines
    let created = 0

    for (const line of dataLines) {
      const parts = line.split(',').map((p) => p.trim())
      const roomNumber = parts[0]
      const capacity = parseInt(parts[1]) || 4
      if (!roomNumber) continue
      try {
        const room = await createOrGetRoom(roomNumber, capacity)
        await writeAuditLog(userName || 'Unknown', 'import', 'room', room.id, room.roomNumber)
        created++
      } catch {
        console.error(`Failed to create room: ${roomNumber}`)
      }
    }

    addToast({ type: 'success', message: t('room.importedFromCSV', { count: created }) })
    sync()
  }

  const getOccupancyBadgeColor = (room: Room) => {
    const ratio = room.currentOccupancy / room.maxCapacity
    if (ratio >= 1) return 'bg-[#FFEBEE] text-[#FA383E]'
    if (ratio >= 0.75) return 'bg-[#FFF3E0] text-[#F57C00]'
    return 'bg-[#EFFFF6] text-[#31A24C]'
  }

  const getRoomParticipants = (roomId: string) => {
    return participants.filter((p) => p.roomId === roomId)
  }

  const getStatusLabel = (status: RoomStatus): string => {
    switch (status) {
      case RoomStatus.Full:
        return t('room.full')
      case RoomStatus.AlmostFull:
        return t('room.almostFull')
      case RoomStatus.Available:
        return t('room.available')
      default:
        return t('participant.unknown')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#050505]">{t('room.title')}</h1>
          <p className="text-[#65676B] mt-1">{t('room.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <button
            onClick={() => setIsImporting(!isImporting)}
            className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-lg text-sm font-semibold hover:bg-[#F0F2F5] transition-colors"
          >
            {t('nav.importCSV')}
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors"
          >
            {t('room.addRoom')}
          </button>
        </div>
      </div>

      {isImporting && (
        <ImportCSVPanel
          title={t('room.importRooms')}
          placeholder={t('room.importPlaceholder')}
          helpText={t('room.importHelpText')}
          csvInput={csvInput}
          onCsvInputChange={setCsvInput}
          onFileSelect={handleFileImport}
          onImport={handleImportCSV}
          onCancel={() => {
            setIsImporting(false)
            setCsvInput('')
          }}
        />
      )}

      {isAdding && (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-6">
          <h3 className="font-semibold text-[#050505] mb-3">{t('room.addNewRoom')}</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomNumber}
              onChange={(e) => setNewRoomNumber(e.target.value)}
              placeholder={t('room.roomNumberPlaceholder')}
              autoFocus
              className="flex-1 px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
            />
            <input
              type="number"
              value={newRoomCapacity}
              onChange={(e) => setNewRoomCapacity(parseInt(e.target.value) || 4)}
              min={1}
              placeholder={t('room.capacity')}
              className="w-24 px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
            />
            <button
              onClick={() => {
                setIsAdding(false)
                setNewRoomNumber('')
                setNewRoomCapacity(4)
              }}
              className="px-4 py-2 text-[#65676B] text-sm font-semibold hover:bg-[#F0F2F5] rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAddRoom}
              disabled={!newRoomNumber.trim()}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
            >
              {t('common.add')}
            </button>
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-12 text-center">
          <div className="text-[#65676B] text-lg">{t('room.noRooms')}</div>
          <p className="text-[#65676B] mt-2 text-sm">{t('room.noRoomsDesc')}</p>
        </div>
      ) : viewMode === ViewMode.List ? (
        <div className="bg-white rounded-lg border border-[#DADDE1]">
          <table className="w-full">
            <thead className="bg-[#F0F2F5] border-b border-[#DADDE1] rounded-t-lg">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold rounded-tl-lg">
                  {t('participant.room')}
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  {t('room.occupancy')}
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  {t('common.status')}
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold rounded-tr-lg">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => {
                const roomParticipants = getRoomParticipants(room.id)
                const status = getRoomStatus(room.currentOccupancy, room.maxCapacity)
                return (
                  <tr
                    key={room.id}
                    className="border-b border-[#DADDE1] last:border-b-0 hover:bg-[#F7F8FA] cursor-pointer relative"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                    onMouseEnter={() => setHoveredRoomId(room.id)}
                    onMouseLeave={() => setHoveredRoomId(null)}
                  >
                    <td className="px-4 py-3 font-medium text-[#050505] relative">
                      {t('participant.room')} {room.roomNumber}
                      {hoveredRoomId === room.id && roomParticipants.length > 0 && (
                        <Tooltip
                          title="Participants"
                          items={roomParticipants.map((p) => ({ id: p.id, name: p.name }))}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#65676B]">
                      {room.currentOccupancy} / {room.maxCapacity}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getOccupancyBadgeColor(room)}`}
                      >
                        {room.currentOccupancy >= room.maxCapacity ? t('room.full') : t('room.available')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRoom(room)
                        }}
                        className="text-[#FA383E] hover:underline text-sm font-semibold"
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map((room) => {
            const roomParticipants = getRoomParticipants(room.id)
            const status = getRoomStatus(room.currentOccupancy, room.maxCapacity)
            return (
              <div
                key={room.id}
                className="relative bg-white rounded-lg border border-[#DADDE1] p-4 hover:shadow-md hover:border-[#1877F2] transition-all cursor-pointer"
                onClick={() => navigate(`/rooms/${room.id}`)}
                onMouseEnter={() => setHoveredRoomId(room.id)}
                onMouseLeave={() => setHoveredRoomId(null)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-[#050505] text-lg">{t('participant.room')} {room.roomNumber}</h3>
                    <p className="text-sm text-[#65676B]">
                      {room.currentOccupancy} / {room.maxCapacity} {t('room.occupied')}
                    </p>
                  </div>
                  <StatusDot status={status} />
                </div>

                <div className="flex justify-between items-center">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${getOccupancyBadgeColor(room)}`}
                  >
                    {room.currentOccupancy >= room.maxCapacity ? t('room.full') : t('room.available')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteRoom(room)
                    }}
                    className="text-[#FA383E] hover:underline text-xs font-semibold"
                  >
                    {t('common.delete')}
                  </button>
                </div>

                {hoveredRoomId === room.id && roomParticipants.length > 0 && (
                  <Tooltip
                    title="Participants"
                    items={roomParticipants.map((p) => ({ id: p.id, name: p.name }))}
                    position="top"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RoomsPage
