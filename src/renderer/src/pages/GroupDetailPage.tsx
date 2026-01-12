import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { participantsAtom, groupsAtom, roomsAtom, syncAtom } from '../stores/dataStore'
import {
  updateGroup,
  removeParticipantFromGroup,
  assignParticipantToGroup
} from '../services/firebase'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { writeAuditLog } from '../services/auditLog'
import type { Group } from '../types'

function GroupDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const groups = useAtomValue(groupsAtom)
  const rooms = useAtomValue(roomsAtom)
  const participants = useAtomValue(participantsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)

  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editGroupName, setEditGroupName] = useState('')
  const [editExpectedCapacity, setEditExpectedCapacity] = useState('')

  const [movingParticipantId, setMovingParticipantId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await sync()
      setIsLoading(false)
    }
    init()
  }, [sync])

  const group = groups.find((g) => g.id === id)
  const groupParticipants = participants.filter((p) => p.groupId === id)

  useEffect(() => {
    if (group) {
      setEditGroupName(group.name)
      setEditExpectedCapacity(group.expectedCapacity?.toString() || '')
    }
  }, [group])

  const handleSaveEdit = async () => {
    if (!group || !id) return
    if (!editGroupName.trim()) {
      addToast({ type: 'error', message: 'Group name is required' })
      return
    }

    setIsSaving(true)
    try {
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      const newCapacity = editExpectedCapacity.trim()
        ? parseInt(editExpectedCapacity.trim(), 10)
        : undefined

      if (editGroupName.trim() !== group.name) {
        changes.name = { from: group.name, to: editGroupName.trim() }
      }
      if (newCapacity !== group.expectedCapacity) {
        changes.expectedCapacity = { from: group.expectedCapacity || null, to: newCapacity || null }
      }

      await updateGroup(id, {
        name: editGroupName.trim(),
        expectedCapacity: newCapacity
      })

      if (Object.keys(changes).length > 0) {
        await writeAuditLog(userName || 'Unknown', 'update', 'group', id, group.name, changes)
      }

      await sync()
      setIsEditing(false)
      addToast({ type: 'success', message: 'Group updated successfully' })
    } catch (error) {
      console.error('Update group error:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update group'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`Are you sure you want to remove ${participantName} from this group?`)) return

    try {
      await removeParticipantFromGroup(participantId)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participantId,
        participantName,
        { group: { from: group?.name, to: null } }
      )
      await sync()
      addToast({ type: 'success', message: 'Participant removed from group' })
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
    targetGroup: Group
  ) => {
    if (!group) return

    try {
      await assignParticipantToGroup(participantId, targetGroup.id, targetGroup.name)
      await writeAuditLog(
        userName || 'Unknown',
        'assign',
        'participant',
        participantId,
        participantName,
        { group: { from: group.name, to: targetGroup.name } }
      )
      await sync()
      setMovingParticipantId(null)
      addToast({ type: 'success', message: `Moved to ${targetGroup.name}` })
    } catch (error) {
      console.error('Move participant error:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to move participant'
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-3 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-[#050505] mb-2">Group not found</h2>
        <Link to="/groups" className="text-[#1877F2] hover:underline font-semibold">
          Back to groups
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/groups"
        className="inline-flex items-center gap-2 text-[#65676B] hover:text-[#1877F2] mb-6 font-semibold transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to groups
      </Link>

      <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm p-6 mb-6">
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-[#DADDE1]">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-end gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    className="px-3 py-2 border border-[#DADDE1] rounded-md text-xl font-bold text-[#050505] w-64 outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-[#65676B] mb-1 font-semibold block">
                    Expected Capacity
                  </label>
                  <input
                    type="number"
                    value={editExpectedCapacity}
                    onChange={(e) => setEditExpectedCapacity(e.target.value)}
                    placeholder="Optional"
                    min={1}
                    className="px-3 py-2 border border-[#DADDE1] rounded-md text-xl font-bold text-[#050505] w-32 outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-bold text-[#050505] mb-2">{group.name}</h1>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-[#F0F2F5] text-[#65676B]">
                    {group.participantCount}
                    {group.expectedCapacity ? ` / ${group.expectedCapacity}` : ''} members
                  </span>
                  {group.expectedCapacity && (
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                        group.participantCount >= group.expectedCapacity
                          ? 'bg-[#FFEBEE] text-[#FA383E]'
                          : group.participantCount >= group.expectedCapacity * 0.75
                            ? 'bg-[#FFF3E0] text-[#F57C00]'
                            : 'bg-[#EFFFF6] text-[#31A24C]'
                      }`}
                    >
                      {group.participantCount >= group.expectedCapacity
                        ? 'Full'
                        : group.participantCount >= group.expectedCapacity * 0.75
                          ? 'Almost Full'
                          : 'Available'}
                    </span>
                  )}
                </div>
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
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-md font-semibold hover:bg-[#F0F2F5] transition-colors"
              >
                Edit Group
              </button>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#050505] mb-4">
            Members ({groupParticipants.length})
          </h2>

          {groupParticipants.length > 0 ? (
            <div className="space-y-3">
              {groupParticipants.map((participant) => (
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
                      {participant.roomId && (
                        <Link
                          to={`/rooms/${participant.roomId}`}
                          className="text-sm text-[#1877F2] hover:underline"
                        >
                          Room{' '}
                          {rooms.find((r) => r.id === participant.roomId)?.roomNumber ||
                            participant.roomNumber}
                        </Link>
                      )}
                      {participant.roomId && (participant.ward || participant.stake) && (
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
                        Move
                      </button>

                      {movingParticipantId === participant.id && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-[#DADDE1] rounded-lg shadow-xl py-2 z-20 max-h-64 overflow-y-auto">
                          <div className="px-3 py-2 border-b border-[#DADDE1] text-xs font-bold text-[#65676B] uppercase tracking-wide sticky top-0 bg-white">
                            Select Group
                          </div>
                          {groups
                            .filter((g) => g.id !== group.id)
                            .map((targetGroup) => (
                              <button
                                key={targetGroup.id}
                                onClick={() =>
                                  handleMoveParticipant(
                                    participant.id,
                                    participant.name,
                                    targetGroup
                                  )
                                }
                                className="w-full text-left px-4 py-2 flex justify-between items-center hover:bg-[#F0F2F5] cursor-pointer"
                              >
                                <span className="font-medium text-[#050505]">
                                  {targetGroup.name}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-[#F0F2F5] text-[#65676B]">
                                  {targetGroup.participantCount} members
                                </span>
                              </button>
                            ))}
                          {groups.length <= 1 && (
                            <div className="px-4 py-3 text-sm text-[#65676B] text-center">
                              No other groups available
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                      className="px-3 py-1.5 bg-white border border-[#DADDE1] text-[#FA383E] text-sm font-semibold rounded hover:bg-[#FFF5F5] transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#F0F2F5] rounded-lg border-2 border-dashed border-[#DADDE1]">
              <p className="text-[#65676B] font-medium">This group has no members</p>
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

export default GroupDetailPage
