import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { participantsAtom, roomsAtom, groupsAtom, syncAtom } from '../stores/dataStore'
import {
  updateRoom,
  removeParticipantFromRoom,
  assignParticipantToRoom
} from '../services/firebase'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { writeAuditLog } from '../services/auditLog'
import type { Room } from '../types'
import { DetailPageSkeleton } from '../components'

function RoomDetailPage(): React.ReactElement {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const rooms = useAtomValue(roomsAtom)
  const groups = useAtomValue(groupsAtom)
  const participants = useAtomValue(participantsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)

  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editRoomNumber, setEditRoomNumber] = useState('')
  const [editCapacity, setEditCapacity] = useState(4)

  const [movingParticipantId, setMovingParticipantId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await sync()
      setIsLoading(false)
    }
    init()
  }, [sync])

  const room = rooms.find((r) => r.id === id)
  const roomParticipants = participants.filter((p) => p.roomId === id)

  useEffect(() => {
    if (room) {
      setEditRoomNumber(room.roomNumber)
      setEditCapacity(room.maxCapacity)
    }
  }, [room])

  const handleSaveEdit = async () => {
    if (!room || !id) return
    if (!editRoomNumber.trim()) {
      addToast({ type: 'error', message: t('room.roomRequired') })
      return
    }

    if (editCapacity < room.currentOccupancy) {
      addToast({ type: 'error', message: t('room.capacityError') })
      return
    }

    setIsSaving(true)
    try {
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      if (editRoomNumber.trim() !== room.roomNumber) {
        changes.roomNumber = { from: room.roomNumber, to: editRoomNumber.trim() }
      }
      if (editCapacity !== room.maxCapacity) {
        changes.maxCapacity = { from: room.maxCapacity, to: editCapacity }
      }

      await updateRoom(id, {
        roomNumber: editRoomNumber.trim(),
        maxCapacity: editCapacity
      })

      if (Object.keys(changes).length > 0) {
        await writeAuditLog(
          userName || 'Unknown',
          'update',
          'room',
          id,
          `Room ${room.roomNumber}`,
          changes
        )
      }

      await sync()
      setIsEditing(false)
      addToast({ type: 'success', message: t('room.roomUpdated') })
    } catch (error) {
      console.error('Update room error:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update room'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(t('participant.removeFromRoom') + ` - ${participantName}?`)) return

    try {
      await removeParticipantFromRoom(participantId)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participantId,
        participantName,
        { room: { from: room?.roomNumber, to: null } }
      )
      await sync()
      addToast({ type: 'success', message: t('room.participantRemoved') })
    } catch (error) {
      console.error('Remove participant error:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove participant'
      })
    }
  }

  const handleMoveParticipant = async (
    participantId: string,
    participantName: string,
    targetRoom: Room
  ) => {
    if (!room) return

    try {
      await assignParticipantToRoom(participantId, targetRoom.id, targetRoom.roomNumber)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participantId,
        participantName,
        { room: { from: room.roomNumber, to: targetRoom.roomNumber } }
      )
      await sync()
      setMovingParticipantId(null)
      addToast({ type: 'success', message: t('room.movedToRoom', { number: targetRoom.roomNumber }) })
    } catch (error) {
      console.error('Move participant error:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to move participant'
      })
    }
  }

  const getCapacityColor = (current: number, max: number) => {
    const percentage = current / max
    if (percentage >= 1) return 'text-[#FA383E] bg-[#FFEBEE]'
    if (percentage >= 0.75) return 'text-[#F57C00] bg-[#FFF3E0]'
    return 'text-[#31A24C] bg-[#EFFFF6]'
  }

  if (isLoading) {
    return <DetailPageSkeleton type="room" />
  }

  if (!room) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-[#050505] mb-2">{t('room.roomNotFound')}</h2>
        <Link to="/rooms" className="text-[#1877F2] hover:underline font-semibold">
          {t('room.backToRooms')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/rooms"
        className="inline-flex items-center gap-2 text-[#65676B] hover:text-[#1877F2] mb-6 font-semibold transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('room.backToRooms')}
      </Link>

      <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm p-6 mb-6">
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-[#DADDE1]">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-end gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                    {t('room.roomNumber')}
                  </label>
                  <input
                    type="text"
                    value={editRoomNumber}
                    onChange={(e) => setEditRoomNumber(e.target.value)}
                    className="px-3 py-2 border border-[#DADDE1] rounded-md text-xl font-bold text-[#050505] w-40 outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                    {t('room.capacity')}
                  </label>
                  <input
                    type="number"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                    min={room.currentOccupancy}
                    className="px-3 py-2 border border-[#DADDE1] rounded-md text-xl font-bold text-[#050505] w-24 outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-bold text-[#050505] mb-2">{t('participant.room')} {room.roomNumber}</h1>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getCapacityColor(room.currentOccupancy, room.maxCapacity)}`}
                >
                  {room.currentOccupancy} / {room.maxCapacity} {t('room.occupied')}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-md font-semibold hover:bg-[#F0F2F5] transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
                >
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-md font-semibold hover:bg-[#F0F2F5] transition-colors"
              >
                {t('room.editRoom')}
              </button>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#050505] mb-4">
            {t('room.participantsCount', { count: roomParticipants.length })}
          </h2>

          {roomParticipants.length > 0 ? (
            <div className="space-y-3">
              {roomParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-4 bg-[#F0F2F5] rounded-lg border border-transparent hover:border-[#DADDE1] transition-colors group"
                >
                  <div>
                    <Link
                      to={`/participant/${participant.id}`}
                      className="text-lg font-semibold text-[#050505] hover:text-[#1877F2] hover:underline block"
                    >
                      {participant.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {participant.groupId && (
                        <Link
                          to={`/groups/${participant.groupId}`}
                          className="text-sm text-[#1877F2] hover:underline"
                        >
                          {groups.find((g) => g.id === participant.groupId)?.name ||
                            participant.groupName}
                        </Link>
                      )}
                      {participant.groupId && (participant.ward || participant.stake) && (
                        <span className="text-[#DADDE1]">•</span>
                      )}
                      {(participant.ward || participant.stake) && (
                        <span className="text-sm text-[#65676B]">
                          {participant.ward}
                          {participant.ward && participant.stake ? ', ' : ''}
                          {participant.stake}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMovingParticipantId(
                            movingParticipantId === participant.id ? null : participant.id
                          )
                        }
                        className="px-3 py-1.5 bg-white border border-[#DADDE1] text-[#1877F2] text-sm font-semibold rounded hover:bg-gray-50 transition-colors"
                      >
                        {t('common.move')}
                      </button>

                      {movingParticipantId === participant.id && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-[#DADDE1] rounded-lg shadow-xl py-2 z-20 max-h-64 overflow-y-auto">
                          <div className="px-3 py-2 border-b border-[#DADDE1] text-xs font-bold text-[#65676B] uppercase tracking-wide sticky top-0 bg-white">
                            {t('participant.selectRoom')}
                          </div>
                          {rooms
                            .filter((r) => r.id !== room.id)
                            .map((targetRoom) => {
                              const isFull = targetRoom.currentOccupancy >= targetRoom.maxCapacity
                              return (
                                <button
                                  key={targetRoom.id}
                                  onClick={() =>
                                    !isFull &&
                                    handleMoveParticipant(
                                      participant.id,
                                      participant.name,
                                      targetRoom
                                    )
                                  }
                                  disabled={isFull}
                                  className={`w-full text-left px-4 py-2 flex justify-between items-center ${
                                    isFull
                                      ? 'opacity-50 cursor-not-allowed bg-gray-50'
                                      : 'hover:bg-[#F0F2F5] cursor-pointer'
                                  }`}
                                >
                                  <span className="font-medium text-[#050505]">
                                    {t('participant.room')} {targetRoom.roomNumber}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      isFull
                                        ? 'bg-[#FFEBEE] text-[#FA383E]'
                                        : 'bg-[#EFFFF6] text-[#31A24C]'
                                    }`}
                                  >
                                    {targetRoom.currentOccupancy}/{targetRoom.maxCapacity}
                                  </span>
                                </button>
                              )
                            })}
                          {rooms.length <= 1 && (
                            <div className="px-4 py-3 text-sm text-[#65676B] text-center">
                              {t('room.noOtherRooms')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                      className="px-3 py-1.5 bg-white border border-[#DADDE1] text-[#FA383E] text-sm font-semibold rounded hover:bg-[#FFF5F5] transition-colors"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#F0F2F5] rounded-lg border-2 border-dashed border-[#DADDE1]">
              <p className="text-[#65676B] font-medium">{t('room.roomEmpty')}</p>
            </div>
          )}
        </div>
      </div>

      {movingParticipantId && (
        <div
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setMovingParticipantId(null)}
        />
      )}
    </div>
  )
}

export default RoomDetailPage
