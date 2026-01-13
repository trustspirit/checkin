import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [memoValue, setMemoValue] = useState('')
  const [isSavingMemo, setIsSavingMemo] = useState(false)
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

  const handleTogglePayment = async () => {
    if (!participant) return
    setIsUpdatingPayment(true)
    try {
      const newStatus = !participant.isPaid
      await updateParticipant(participant.id, { isPaid: newStatus })
      await writeAuditLog(
        userName || 'Unknown',
        'update',
        'participant',
        participant.id,
        participant.name,
        { isPaid: { from: participant.isPaid, to: newStatus } }
      )
      addToast({
        type: 'success',
        message: `Payment status updated to ${newStatus ? 'Paid' : 'Unpaid'}`
      })
      await sync()
    } catch (error) {
      console.error('Payment update error:', error)
      addToast({ type: 'error', message: 'Failed to update payment status' })
    } finally {
      setIsUpdatingPayment(false)
      setShowPaymentConfirm(false)
    }
  }

  const handleStartEditMemo = () => {
    if (!participant) return
    setMemoValue(participant.memo || '')
    setIsEditingMemo(true)
  }

  const handleCancelEditMemo = () => {
    setIsEditingMemo(false)
    setMemoValue('')
  }

  const handleSaveMemo = async () => {
    if (!participant) return
    const newMemo = memoValue.trim()
    const oldMemo = participant.memo || ''

    if (newMemo === oldMemo) {
      setIsEditingMemo(false)
      return
    }

    setIsSavingMemo(true)
    try {
      await updateParticipant(participant.id, { memo: newMemo })
      await writeAuditLog(
        userName || 'Unknown',
        'update',
        'participant',
        participant.id,
        participant.name,
        { memo: { from: oldMemo || null, to: newMemo || null } }
      )
      addToast({ type: 'success', message: 'Memo updated' })
      await sync()
      setIsEditingMemo(false)
    } catch (error) {
      console.error('Memo update error:', error)
      addToast({ type: 'error', message: 'Failed to update memo' })
    } finally {
      setIsSavingMemo(false)
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
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[#65676B] hover:text-[#050505] hover:bg-[#F0F2F5] rounded-md font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
        <span className="text-[#DADDE1]">|</span>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[#65676B] hover:text-[#1877F2] font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          Go to Search
        </Link>
      </div>

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPaymentConfirm(true)}
                    disabled={isUpdatingPayment || isEditing}
                    className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      participant.isPaid
                        ? 'bg-[#EFFFF6] text-[#31A24C] hover:bg-[#D4EDDA] border border-[#31A24C]/20'
                        : 'bg-[#FFEBEE] text-[#FA383E] hover:bg-[#FFCDD2] border border-[#FA383E]/20'
                    }`}
                  >
                    {isUpdatingPayment ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <>
                        {participant.isPaid ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </>
                    )}
                    {participant.isPaid ? 'Paid' : 'Unpaid'}
                    {!isEditing && (
                      <svg
                        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                    )}
                  </button>
                  {!isEditing && <span className="text-xs text-[#65676B]">Click to change</span>}
                </div>
              </div>
              <div className="col-span-2 md:col-span-3 bg-[#F0F2F5] rounded-md p-3 border border-transparent">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                    Memo
                  </div>
                  {!isEditing && !isEditingMemo && (
                    <button
                      onClick={handleStartEditMemo}
                      className="text-xs text-[#1877F2] hover:underline font-semibold"
                    >
                      {participant.memo ? 'Edit' : 'Add memo'}
                    </button>
                  )}
                </div>
                {isEditingMemo ? (
                  <div className="space-y-2">
                    <textarea
                      value={memoValue}
                      onChange={(e) => setMemoValue(e.target.value)}
                      rows={3}
                      placeholder="Add notes about this participant..."
                      className="w-full px-3 py-2 border border-[#DADDE1] rounded-md text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent resize-none bg-white"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelEditMemo}
                        disabled={isSavingMemo}
                        className="px-3 py-1.5 text-sm text-[#65676B] hover:bg-[#E4E6EB] rounded-md font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveMemo}
                        disabled={isSavingMemo}
                        className="px-3 py-1.5 text-sm bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSavingMemo && (
                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        )}
                        {isSavingMemo ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : participant.memo ? (
                  <div className="font-semibold text-[#050505] whitespace-pre-wrap">
                    {participant.memo}
                  </div>
                ) : (
                  <div className="text-[#65676B] text-sm italic">No memo added</div>
                )}
              </div>
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

        {/* Check-in/Check-out History */}
        <div>
          <h2 className="text-lg font-bold text-[#050505] mb-4 pb-2 border-b border-[#DADDE1]">
            Check-in / Check-out History
          </h2>
          {participant.checkIns.length > 0 ? (
            <div className="space-y-4">
              {[...participant.checkIns].reverse().map((checkIn, index) => {
                const duration = checkIn.checkOutTime
                  ? Math.round(
                      (checkIn.checkOutTime.getTime() - checkIn.checkInTime.getTime()) / 1000 / 60
                    )
                  : null
                const formatDuration = (minutes: number) => {
                  if (minutes < 60) return `${minutes}m`
                  const hours = Math.floor(minutes / 60)
                  const mins = minutes % 60
                  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
                }

                return (
                  <div
                    key={checkIn.id}
                    className="bg-[#F7F8FA] border border-[#DADDE1] rounded-lg overflow-hidden"
                  >
                    {/* Session header */}
                    <div className="flex justify-between items-center px-4 py-2 bg-[#F0F2F5] border-b border-[#DADDE1]">
                      <span className="text-xs font-semibold text-[#65676B] uppercase tracking-wide">
                        Session #{participant.checkIns.length - index}
                      </span>
                      <div className="flex items-center gap-2">
                        {duration !== null && (
                          <span className="text-xs text-[#65676B] font-medium">
                            Duration: {formatDuration(duration)}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            checkIn.checkOutTime
                              ? 'bg-[#E4E6EB] text-[#65676B]'
                              : 'bg-[#EFFFF6] text-[#31A24C] border border-[#31A24C]/20'
                          }`}
                        >
                          {checkIn.checkOutTime ? 'Completed' : 'Active'}
                        </span>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="p-4">
                      <div className="relative">
                        {/* Timeline line */}
                        <div
                          className={`absolute left-[7px] top-3 bottom-3 w-0.5 ${
                            checkIn.checkOutTime ? 'bg-[#DADDE1]' : 'bg-[#31A24C]'
                          }`}
                        ></div>

                        {/* Check-in event */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="relative z-10 w-4 h-4 rounded-full bg-[#1877F2] border-2 border-white shadow-sm flex-shrink-0 mt-0.5"></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1877F2] text-sm">Check In</span>
                              <svg
                                className="w-4 h-4 text-[#1877F2]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 16l-4-4m0 0l4-4m-4 4h14"
                                />
                              </svg>
                            </div>
                            <div className="text-sm text-[#050505] font-medium">
                              {formatDate(checkIn.checkInTime)}
                            </div>
                          </div>
                        </div>

                        {/* Check-out event */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`relative z-10 w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0 mt-0.5 ${
                              checkIn.checkOutTime ? 'bg-[#FA383E]' : 'bg-[#DADDE1]'
                            }`}
                          ></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold text-sm ${
                                  checkIn.checkOutTime ? 'text-[#FA383E]' : 'text-[#65676B]'
                                }`}
                              >
                                Check Out
                              </span>
                              {checkIn.checkOutTime && (
                                <svg
                                  className="w-4 h-4 text-[#FA383E]"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="text-sm text-[#050505] font-medium">
                              {checkIn.checkOutTime ? (
                                formatDate(checkIn.checkOutTime)
                              ) : (
                                <span className="text-[#31A24C] italic">Currently checked in</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-[#F7F8FA] border border-[#DADDE1] rounded-lg p-6 text-center">
              <svg
                className="w-12 h-12 text-[#DADDE1] mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-[#65676B] font-medium">No check-in history yet</p>
              <p className="text-[#65676B] text-sm mt-1">
                Check-in and check-out events will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Status Confirmation Dialog */}
      {showPaymentConfirm && participant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    participant.isPaid ? 'bg-[#FFEBEE]' : 'bg-[#EFFFF6]'
                  }`}
                >
                  {participant.isPaid ? (
                    <svg
                      className="w-6 h-6 text-[#FA383E]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-[#31A24C]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#050505]">Change Payment Status</h3>
                  <p className="text-sm text-[#65676B]">{participant.name}</p>
                </div>
              </div>

              <div className="bg-[#F7F8FA] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#65676B] uppercase tracking-wide font-semibold mb-1">
                      Current Status
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${
                        participant.isPaid
                          ? 'bg-[#EFFFF6] text-[#31A24C]'
                          : 'bg-[#FFEBEE] text-[#FA383E]'
                      }`}
                    >
                      {participant.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <svg
                    className="w-6 h-6 text-[#65676B]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                  <div>
                    <div className="text-xs text-[#65676B] uppercase tracking-wide font-semibold mb-1">
                      New Status
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${
                        !participant.isPaid
                          ? 'bg-[#EFFFF6] text-[#31A24C]'
                          : 'bg-[#FFEBEE] text-[#FA383E]'
                      }`}
                    >
                      {!participant.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-[#65676B] mb-6">
                Are you sure you want to change the payment status from{' '}
                <strong>{participant.isPaid ? 'Paid' : 'Unpaid'}</strong> to{' '}
                <strong>{!participant.isPaid ? 'Paid' : 'Unpaid'}</strong>?
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowPaymentConfirm(false)}
                  disabled={isUpdatingPayment}
                  className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-lg font-semibold hover:bg-[#F0F2F5] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTogglePayment}
                  disabled={isUpdatingPayment}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 ${
                    participant.isPaid
                      ? 'bg-[#FA383E] text-white hover:bg-[#D32F2F]'
                      : 'bg-[#31A24C] text-white hover:bg-[#2B8A3E]'
                  }`}
                >
                  {isUpdatingPayment && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {isUpdatingPayment
                    ? 'Updating...'
                    : `Mark as ${!participant.isPaid ? 'Paid' : 'Unpaid'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ParticipantDetailPage
