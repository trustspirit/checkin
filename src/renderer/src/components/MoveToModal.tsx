import React from 'react'
import type { Group, Room } from '../types'

interface MoveToRoomModalProps {
  type: 'room'
  selectedCount: number
  items: Room[]
  currentId: string | null
  isMoving: boolean
  error: string | null
  onMove: (item: Room) => void
  onClose: () => void
}

interface MoveToGroupModalProps {
  type: 'group'
  selectedCount: number
  items: Group[]
  currentId: string | null
  isMoving: boolean
  error: string | null
  onMove: (item: Group) => void
  onClose: () => void
}

type MoveToModalProps = MoveToRoomModalProps | MoveToGroupModalProps

function MoveToModal(props: MoveToModalProps): React.ReactElement {
  const { type, selectedCount, items, currentId, isMoving, error, onClose } = props

  const title =
    type === 'room'
      ? `Move ${selectedCount} participant(s) to another room`
      : `Move ${selectedCount} participant(s) to another group`

  const filteredItems = items.filter((item) => item.id !== currentId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 border border-[#DADDE1]">
        <h3 className="text-xl font-bold text-[#050505] mb-4">{title}</h3>

        {error && (
          <div className="mb-4 p-3 bg-[#FFEBEE] border border-[#FFCDD2] text-[#FA383E] rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {type === 'room' &&
            (filteredItems as Room[]).map((room) => {
              const available = room.maxCapacity - room.currentOccupancy
              const canFit = available >= selectedCount
              return (
                <button
                  key={room.id}
                  onClick={() => (props as MoveToRoomModalProps).onMove(room)}
                  disabled={!canFit || isMoving}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    canFit
                      ? 'border-[#DADDE1] hover:bg-[#F0F2F5]'
                      : 'border-gray-100 bg-[#F0F2F5] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[#050505]">Room {room.roomNumber}</span>
                    <span className={`text-sm ${canFit ? 'text-[#31A24C]' : 'text-[#FA383E]'}`}>
                      {available} available
                    </span>
                  </div>
                </button>
              )
            })}

          {type === 'group' &&
            (filteredItems as Group[]).map((group) => (
              <button
                key={group.id}
                onClick={() => (props as MoveToGroupModalProps).onMove(group)}
                disabled={isMoving}
                className="w-full p-3 rounded-lg border border-[#DADDE1] text-left hover:bg-[#F0F2F5] transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#050505]">{group.name}</span>
                  <span className="text-sm text-[#65676B]">{group.participantCount} members</span>
                </div>
              </button>
            ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isMoving}
            className="px-4 py-2 bg-[#E4E6EB] text-[#050505] rounded-md hover:bg-[#D8DADF] font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default MoveToModal
