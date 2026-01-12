import React, { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { roomsAtom, syncAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { createOrGetRoom, deleteRoom } from '../services/firebase'
import { writeAuditLog } from '../services/auditLog'
import type { Room } from '../types'

function RoomsPage(): React.ReactElement {
  const rooms = useAtomValue(roomsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)
  const [isAdding, setIsAdding] = useState(false)
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newRoomCapacity, setNewRoomCapacity] = useState(4)
  const [isImporting, setIsImporting] = useState(false)
  const [csvInput, setCsvInput] = useState('')

  const handleAddRoom = async () => {
    if (!newRoomNumber.trim()) return
    try {
      const room = await createOrGetRoom(newRoomNumber.trim(), newRoomCapacity)
      await writeAuditLog(userName || 'Unknown', 'create', 'room', room.id, room.roomNumber)
      addToast({ type: 'success', message: `Room "${room.roomNumber}" created` })
      setNewRoomNumber('')
      setNewRoomCapacity(4)
      setIsAdding(false)
      sync()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to create room' })
    }
  }

  const handleDeleteRoom = async (room: Room) => {
    const warningMsg =
      room.currentOccupancy > 0
        ? `Delete room "${room.roomNumber}"? ${room.currentOccupancy} participants will be unassigned.`
        : `Delete room "${room.roomNumber}"?`
    if (!confirm(warningMsg)) return
    try {
      await deleteRoom(room.id)
      await writeAuditLog(userName || 'Unknown', 'delete', 'room', room.id, room.roomNumber)
      addToast({ type: 'success', message: `Room "${room.roomNumber}" deleted` })
      sync()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to delete room' })
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

    addToast({ type: 'success', message: `Imported ${created} rooms` })
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

    addToast({ type: 'success', message: `Imported ${created} rooms from CSV` })
    sync()
  }

  const getOccupancyColor = (room: Room) => {
    const ratio = room.currentOccupancy / room.maxCapacity
    if (ratio >= 1) return 'bg-[#FFEBEE] text-[#FA383E]'
    if (ratio >= 0.75) return 'bg-[#FFF3E0] text-[#F57C00]'
    return 'bg-[#EFFFF6] text-[#31A24C]'
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#050505]">Rooms</h1>
          <p className="text-[#65676B] mt-1">Manage accommodation rooms</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsImporting(!isImporting)}
            className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-lg text-sm font-semibold hover:bg-[#F0F2F5] transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors"
          >
            Add Room
          </button>
        </div>
      </div>

      {isImporting && (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-6">
          <h3 className="font-semibold text-[#050505] mb-3">Import Rooms</h3>
          <div className="flex gap-4 mb-3">
            <button
              onClick={handleFileImport}
              className="px-4 py-2 border border-[#1877F2] text-[#1877F2] rounded-lg text-sm font-semibold hover:bg-[#E7F3FF] transition-colors"
            >
              Choose CSV File
            </button>
            <span className="text-[#65676B] text-sm self-center">
              or paste below (room,capacity per line)
            </span>
          </div>
          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="101,4&#10;102,4&#10;103,6"
            className="w-full px-3 py-2 border border-[#DADDE1] rounded-lg text-sm h-32 resize-none outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setIsImporting(false)
                setCsvInput('')
              }}
              className="px-4 py-2 text-[#65676B] text-sm font-semibold hover:bg-[#F0F2F5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImportCSV}
              disabled={!csvInput.trim()}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-6">
          <h3 className="font-semibold text-[#050505] mb-3">Add New Room</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomNumber}
              onChange={(e) => setNewRoomNumber(e.target.value)}
              placeholder="Room number"
              autoFocus
              className="flex-1 px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
            />
            <input
              type="number"
              value={newRoomCapacity}
              onChange={(e) => setNewRoomCapacity(parseInt(e.target.value) || 4)}
              min={1}
              placeholder="Capacity"
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
              Cancel
            </button>
            <button
              onClick={handleAddRoom}
              disabled={!newRoomNumber.trim()}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-[#DADDE1] overflow-hidden">
        {rooms.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-[#65676B] text-lg">No rooms yet</div>
            <p className="text-[#65676B] mt-2 text-sm">Add rooms for participant accommodation</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F0F2F5] border-b border-[#DADDE1]">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Room
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Occupancy
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr
                  key={room.id}
                  className="border-b border-[#DADDE1] last:border-b-0 hover:bg-[#F7F8FA]"
                >
                  <td className="px-4 py-3 font-medium text-[#050505]">Room {room.roomNumber}</td>
                  <td className="px-4 py-3 text-[#65676B]">
                    {room.currentOccupancy} / {room.maxCapacity}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getOccupancyColor(room)}`}
                    >
                      {room.currentOccupancy >= room.maxCapacity ? 'Full' : 'Available'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteRoom(room)}
                      className="text-[#FA383E] hover:underline text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default RoomsPage
