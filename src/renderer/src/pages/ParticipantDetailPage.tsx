import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  checkInParticipant,
  checkOutParticipant,
  assignParticipantToGroup,
  assignParticipantToRoom,
  createOrGetGroup,
  createOrGetRoom,
  updateParticipant
} from '../services/firebase'
import { participantsAtom, groupsAtom, roomsAtom, syncAtom } from '../stores/dataStore'
import type { Participant, Group, Room, CheckInRecord } from '../types'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { writeAuditLog } from '../services/auditLog'
import { DetailPageSkeleton } from '../components'

interface EditFormData {
  name: string
  email: string
  phoneNumber: string
  gender: string
  age: string
  ward: string
  stake: string
  isPaid: boolean
  memo: string
}

function ParticipantDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const participants = useAtomValue(participantsAtom)
  const groups = useAtomValue(groupsAtom)
  const rooms = useAtomValue(roomsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)

  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [showGroupSelect, setShowGroupSelect] = useState(false)
  const [showRoomSelect, setShowRoomSelect] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newRoomCapacity, setNewRoomCapacity] = useState(4)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    email: '',
    phoneNumber: '',
    gender: '',
    age: '',
    ward: '',
    stake: '',
    isPaid: false,
    memo: ''
  })

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await sync()
      setIsLoading(false)
    }
    init()
  }, [sync])

  const participant = participants.find((p) => p.id === id) || null

  const handleCheckIn = async () => {
    if (!participant) return
    setIsCheckingIn(true)
    try {
      await checkInParticipant(participant.id)
      await writeAuditLog(
        userName || 'Unknown',
        'check_in',
        'participant',
        participant.id,
        participant.name
      )
      await sync()
    } catch (error) {
      console.error('Check-in error:', error)
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handleCheckOut = async (checkInId: string) => {
    if (!participant) return
    try {
      await checkOutParticipant(participant.id, checkInId)
      await writeAuditLog(
        userName || 'Unknown',
        'check_out',
        'participant',
        participant.id,
        participant.name
      )
      await sync()
    } catch (error) {
      console.error('Check-out error:', error)
    }
  }

  const handleGroupAssign = async (group: Group) => {
    if (!participant) return
    try {
      const oldGroup = participant.groupName
      await assignParticipantToGroup(participant.id, group.id, group.name)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participant.id,
        participant.name,
        {
          group: { from: oldGroup || null, to: group.name }
        }
      )
      await sync()
      setShowGroupSelect(false)
    } catch (error) {
      console.error('Group assignment error:', error)
    }
  }

  const handleNewGroup = async () => {
    if (!newGroupName.trim() || !participant) return
    try {
      const oldGroup = participant.groupName
      const group = await createOrGetGroup(newGroupName.trim())
      await assignParticipantToGroup(participant.id, group.id, group.name)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participant.id,
        participant.name,
        {
          group: { from: oldGroup || null, to: group.name }
        }
      )
      await sync()
      setNewGroupName('')
      setShowGroupSelect(false)
    } catch (error) {
      console.error('Create group error:', error)
    }
  }

  const handleRoomAssign = async (room: Room) => {
    if (!participant) return
    if (room.currentOccupancy >= room.maxCapacity) {
      alert('Room is at full capacity')
      return
    }
    try {
      const oldRoom = participant.roomNumber
      await assignParticipantToRoom(participant.id, room.id, room.roomNumber)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participant.id,
        participant.name,
        {
          room: { from: oldRoom || null, to: room.roomNumber }
        }
      )
      await sync()
      setShowRoomSelect(false)
    } catch (error) {
      console.error('Room assignment error:', error)
    }
  }

  const handleNewRoom = async () => {
    if (!newRoomNumber.trim() || !participant) return
    try {
      const oldRoom = participant.roomNumber
      const room = await createOrGetRoom(newRoomNumber.trim(), newRoomCapacity)
      await assignParticipantToRoom(participant.id, room.id, room.roomNumber)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participant.id,
        participant.name,
        {
          room: { from: oldRoom || null, to: room.roomNumber }
        }
      )
      await sync()
      setNewRoomNumber('')
      setNewRoomCapacity(4)
      setShowRoomSelect(false)
    } catch (error) {
      console.error('Create room error:', error)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
  }

  const getActiveCheckIn = (): CheckInRecord | undefined => {
    return participant?.checkIns.find((ci) => !ci.checkOutTime)
  }

  const startEditing = () => {
    if (!participant) return
    setEditForm({
      name: participant.name,
      email: participant.email,
      phoneNumber: participant.phoneNumber || '',
      gender: participant.gender || '',
      age: participant.age?.toString() || '',
      ward: participant.ward || '',
      stake: participant.stake || '',
      isPaid: participant.isPaid,
      memo: participant.memo || ''
    })
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditForm({
      name: '',
      email: '',
      phoneNumber: '',
      gender: '',
      age: '',
      ward: '',
      stake: '',
      isPaid: false,
      memo: ''
    })
  }

  const handleSaveEdit = async () => {
    if (!participant) return
    if (!editForm.name.trim() || !editForm.email.trim()) {
      addToast({ type: 'error', message: 'Name and email are required' })
      return
    }

    setIsSaving(true)
    try {
      const changes: Record<string, { from: unknown; to: unknown }> = {}

      if (editForm.name.trim() !== participant.name) {
        changes.name = { from: participant.name, to: editForm.name.trim() }
      }
      if (editForm.email.trim() !== participant.email) {
        changes.email = { from: participant.email, to: editForm.email.trim() }
      }
      if ((editForm.phoneNumber.trim() || '') !== (participant.phoneNumber || '')) {
        changes.phoneNumber = {
          from: participant.phoneNumber || null,
          to: editForm.phoneNumber.trim() || null
        }
      }
      if ((editForm.gender || '') !== (participant.gender || '')) {
        changes.gender = { from: participant.gender || null, to: editForm.gender || null }
      }
      if ((editForm.age ? parseInt(editForm.age) : null) !== (participant.age || null)) {
        changes.age = {
          from: participant.age || null,
          to: editForm.age ? parseInt(editForm.age) : null
        }
      }
      if ((editForm.ward.trim() || '') !== (participant.ward || '')) {
        changes.ward = { from: participant.ward || null, to: editForm.ward.trim() || null }
      }
      if ((editForm.stake.trim() || '') !== (participant.stake || '')) {
        changes.stake = { from: participant.stake || null, to: editForm.stake.trim() || null }
      }
      if (editForm.isPaid !== participant.isPaid) {
        changes.isPaid = { from: participant.isPaid, to: editForm.isPaid }
      }
      if ((editForm.memo.trim() || '') !== (participant.memo || '')) {
        changes.memo = { from: participant.memo || null, to: editForm.memo.trim() || null }
      }

      await updateParticipant(participant.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phoneNumber: editForm.phoneNumber.trim() || undefined,
        gender: editForm.gender || undefined,
        age: editForm.age ? parseInt(editForm.age) : undefined,
        ward: editForm.ward.trim() || undefined,
        stake: editForm.stake.trim() || undefined,
        isPaid: editForm.isPaid,
        memo: editForm.memo.trim() || undefined
      })

      if (Object.keys(changes).length > 0) {
        await writeAuditLog(
          userName || 'Unknown',
          'update',
          'participant',
          participant.id,
          participant.name,
          changes
        )
      }

      addToast({ type: 'success', message: 'Participant updated successfully' })
      setIsEditing(false)
      await sync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update participant'
      addToast({ type: 'error', message })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <DetailPageSkeleton type="participant" />
  }

  if (!participant) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-[#050505] mb-2">Participant not found</h2>
        <Link to="/" className="text-[#1877F2] hover:underline font-semibold">
          Back to search
        </Link>
      </div>
    )
  }

  const activeCheckIn = getActiveCheckIn()

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[#65676B] hover:text-[#1877F2] mb-6 font-semibold transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to search
      </Link>

      <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-[#050505]">{participant.name}</h1>
              {activeCheckIn ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-[#EFFFF6] text-[#31A24C] border border-[#31A24C]/20">
                  <div className="w-2 h-2 bg-[#31A24C] rounded-full animate-pulse"></div>
                  Checked In
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-[#F0F2F5] text-[#65676B]">
                  Not Checked In
                </span>
              )}
            </div>
            <p className="text-[#65676B] mt-1 text-lg">
              {participant.ward && participant.ward}
              {participant.stake && `, ${participant.stake}`}
            </p>
          </div>
          <div className="flex gap-3">
            {!isEditing && (
              <button
                onClick={startEditing}
                className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-md font-semibold hover:bg-[#F0F2F5] transition-colors"
              >
                Edit
              </button>
            )}
            {activeCheckIn ? (
              <button
                onClick={() => handleCheckOut(activeCheckIn.id)}
                disabled={isEditing}
                className="px-6 py-2 bg-[#FA383E] text-white rounded-md font-semibold hover:bg-[#D32F2F] transition-colors shadow-sm disabled:opacity-50"
              >
                Check Out
              </button>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={isCheckingIn || isEditing}
                className="px-6 py-2 bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] transition-colors shadow-sm disabled:opacity-50"
              >
                {isCheckingIn ? 'Checking in...' : 'Check In'}
              </button>
            )}
          </div>
        </div>

        {activeCheckIn && (
          <div className="bg-[#EFFFF6] border border-[#31A24C] rounded-md p-4 mb-6">
            <div className="flex items-center gap-2 text-[#31A24C]">
              <div className="w-3 h-3 bg-[#31A24C] rounded-full animate-pulse"></div>
              <span className="font-bold">Currently Checked In</span>
              <span className="text-[#31A24C]">since {formatDate(activeCheckIn.checkInTime)}</span>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#DADDE1]">
            <h2 className="text-lg font-bold text-[#050505]">Personal Information</h2>
            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="px-4 py-1.5 border border-[#DADDE1] text-[#65676B] rounded-md text-sm font-semibold hover:bg-[#F0F2F5] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-[#1877F2] text-white rounded-md text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
          {isEditing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Email *
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Gender
                </label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent bg-white"
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Age
                </label>
                <input
                  type="number"
                  value={editForm.age}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                  min={1}
                  max={150}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Ward
                </label>
                <input
                  type="text"
                  value={editForm.ward}
                  onChange={(e) => setEditForm({ ...editForm, ward: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Stake
                </label>
                <input
                  type="text"
                  value={editForm.stake}
                  onChange={(e) => setEditForm({ ...editForm, stake: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Payment Status
                </label>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isPaid: !editForm.isPaid })}
                  className={`w-full px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                    editForm.isPaid
                      ? 'bg-[#EFFFF6] text-[#31A24C] border border-[#31A24C]'
                      : 'bg-[#FFEBEE] text-[#FA383E] border border-[#FA383E]'
                  }`}
                >
                  {editForm.isPaid ? 'Paid' : 'Unpaid'}
                </button>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                  Memo
                </label>
                <textarea
                  value={editForm.memo}
                  onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent resize-none"
                  placeholder="Add notes about this participant..."
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Name
                </div>
                <div className="font-semibold text-[#050505]">{participant.name}</div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Email
                </div>
                <div className="font-semibold text-[#050505]">{participant.email}</div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Phone
                </div>
                <div className="font-semibold text-[#050505]">{participant.phoneNumber || '-'}</div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Gender
                </div>
                <div className="font-semibold text-[#050505] capitalize">
                  {participant.gender || '-'}
                </div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Age
                </div>
                <div className="font-semibold text-[#050505]">{participant.age || '-'}</div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Ward
                </div>
                <div className="font-semibold text-[#050505]">{participant.ward || '-'}</div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Stake
                </div>
                <div className="font-semibold text-[#050505]">{participant.stake || '-'}</div>
              </div>
              <div className="bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                  Payment Status
                </div>
                <div>
                  {participant.isPaid ? (
                    <span className="px-2 py-1 bg-[#EFFFF6] text-[#31A24C] rounded text-sm font-semibold">
                      Paid
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-[#FFEBEE] text-[#FA383E] rounded text-sm font-semibold">
                      Unpaid
                    </span>
                  )}
                </div>
              </div>
              {participant.memo && (
                <div className="col-span-2 md:col-span-3 bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                  <div className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold">
                    Memo
                  </div>
                  <div className="font-semibold text-[#050505] whitespace-pre-wrap">
                    {participant.memo}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#050505] mb-4 pb-2 border-b border-[#DADDE1]">
            Group & Room Assignment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Group Assignment */}
            <div>
              <div className="text-sm font-semibold text-[#65676B] mb-2">Group</div>
              <div className="flex items-center gap-3">
                {participant.groupName ? (
                  <span className="px-4 py-2 bg-[#E7F3FF] text-[#1877F2] rounded-md font-bold shadow-sm">
                    {participant.groupName}
                  </span>
                ) : (
                  <span className="px-4 py-2 bg-[#F0F2F5] text-[#65676B] rounded-md font-medium">
                    Not assigned
                  </span>
                )}
                <button
                  onClick={() => setShowGroupSelect(!showGroupSelect)}
                  className="text-[#1877F2] hover:underline text-sm font-semibold"
                >
                  {participant.groupName ? 'Change' : 'Assign'}
                </button>
              </div>
              {showGroupSelect && (
                <div className="mt-3 bg-white border border-[#DADDE1] rounded-lg shadow-xl p-4 z-10 relative">
                  <div className="text-sm font-bold text-[#050505] mb-2">Select Group</div>
                  <div className="max-h-48 overflow-y-auto mb-3 pr-1">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => handleGroupAssign(group)}
                        className="flex justify-between items-center px-3 py-2 hover:bg-[#F0F2F5] rounded cursor-pointer"
                      >
                        <span className="text-[#050505] font-medium">{group.name}</span>
                        <span className="text-xs bg-[#F0F2F5] px-2 py-1 rounded text-[#65676B] font-medium">
                          {group.participantCount} members
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#DADDE1] pt-3">
                    <div className="text-sm font-bold text-[#050505] mb-2">Or create new group</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group name"
                        className="flex-1 px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                      />
                      <button
                        onClick={handleNewGroup}
                        disabled={!newGroupName.trim()}
                        className="px-4 py-2 bg-[#1877F2] text-white rounded-md text-sm font-semibold hover:bg-[#166FE5] disabled:opacity-50"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Room Assignment */}
            <div>
              <div className="text-sm font-semibold text-[#65676B] mb-2">Room</div>
              <div className="flex items-center gap-3">
                {participant.roomNumber ? (
                  <span className="px-4 py-2 bg-[#F0F2F5] text-[#050505] rounded-md font-bold shadow-sm">
                    Room {participant.roomNumber}
                  </span>
                ) : (
                  <span className="px-4 py-2 bg-[#F0F2F5] text-[#65676B] rounded-md font-medium">
                    Not assigned
                  </span>
                )}
                <button
                  onClick={() => setShowRoomSelect(!showRoomSelect)}
                  className="text-[#1877F2] hover:underline text-sm font-semibold"
                >
                  {participant.roomNumber ? 'Change' : 'Assign'}
                </button>
              </div>
              {showRoomSelect && (
                <div className="mt-3 bg-white border border-[#DADDE1] rounded-lg shadow-xl p-4 z-10 relative">
                  <div className="text-sm font-bold text-[#050505] mb-2">Select Room</div>
                  <div className="max-h-48 overflow-y-auto mb-3 pr-1">
                    {rooms.map((room) => {
                      const isFull = room.currentOccupancy >= room.maxCapacity
                      return (
                        <div
                          key={room.id}
                          onClick={() => !isFull && handleRoomAssign(room)}
                          className={`flex justify-between items-center px-3 py-2 rounded ${
                            isFull
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-[#F0F2F5] cursor-pointer'
                          }`}
                        >
                          <span className="text-[#050505] font-medium">Room {room.roomNumber}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded font-semibold ${
                              isFull ? 'bg-[#FFEBEE] text-[#FA383E]' : 'bg-[#EFFFF6] text-[#31A24C]'
                            }`}
                          >
                            {room.currentOccupancy}/{room.maxCapacity}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="border-t border-[#DADDE1] pt-3">
                    <div className="text-sm font-bold text-[#050505] mb-2">Or create new room</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRoomNumber}
                        onChange={(e) => setNewRoomNumber(e.target.value)}
                        placeholder="Room number"
                        className="flex-1 px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                      />
                      <input
                        type="number"
                        value={newRoomCapacity}
                        onChange={(e) => setNewRoomCapacity(parseInt(e.target.value) || 4)}
                        placeholder="Max"
                        min={1}
                        className="w-20 px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                      />
                      <button
                        onClick={handleNewRoom}
                        disabled={!newRoomNumber.trim()}
                        className="px-4 py-2 bg-[#1877F2] text-white rounded-md text-sm font-semibold hover:bg-[#166FE5] disabled:opacity-50"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Check-in History */}
        <div>
          <h2 className="text-lg font-bold text-[#050505] mb-4 pb-2 border-b border-[#DADDE1]">
            Check-in History
          </h2>
          {participant.checkIns.length > 0 ? (
            <div className="space-y-2">
              {[...participant.checkIns].reverse().map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex justify-between items-center bg-[#F0F2F5] border border-transparent rounded-md px-4 py-3"
                >
                  <div>
                    <span className="font-semibold text-[#050505]">
                      In: {formatDate(checkIn.checkInTime)}
                    </span>
                    {checkIn.checkOutTime && (
                      <span className="text-[#65676B] ml-4 font-medium">
                        Out: {formatDate(checkIn.checkOutTime)}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold ${
                      checkIn.checkOutTime
                        ? 'bg-[#E4E6EB] text-[#65676B]'
                        : 'bg-[#EFFFF6] text-[#31A24C] border border-[#31A24C]/20'
                    }`}
                  >
                    {checkIn.checkOutTime ? 'Completed' : 'Active'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#65676B]">No check-in history</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ParticipantDetailPage
