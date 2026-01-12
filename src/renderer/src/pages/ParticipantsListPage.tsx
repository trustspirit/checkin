import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { moveParticipantsToRoom, moveParticipantsToGroup } from '../services/firebase'
import {
  participantsAtom,
  groupsAtom,
  roomsAtom,
  isLoadingAtom,
  syncAtom
} from '../stores/dataStore'
import type { Participant, Group, Room } from '../types'

type CheckInFilter = 'all' | 'checked-in' | 'not-checked-in'

function ParticipantsListPage(): React.ReactElement {
  const participants = useAtomValue(participantsAtom)
  const groups = useAtomValue(groupsAtom)
  const rooms = useAtomValue(roomsAtom)
  const isLoading = useAtomValue(isLoadingAtom)
  const sync = useSetAtom(syncAtom)
  const [filter, setFilter] = useState('')
  const [checkInFilter, setCheckInFilter] = useState<CheckInFilter>('all')
  const [activeTab, setActiveTab] = useState<'participants' | 'groups' | 'rooms'>('participants')
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)

  const [selectedRoomMembers, setSelectedRoomMembers] = useState<Set<string>>(new Set())
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set())
  const [showMoveToRoomModal, setShowMoveToRoomModal] = useState(false)
  const [showMoveToGroupModal, setShowMoveToGroupModal] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const navigate = useNavigate()

  const getCheckInStatus = (participant: Participant) => {
    const activeCheckIn = participant.checkIns.find((ci) => !ci.checkOutTime)
    return activeCheckIn ? 'checked-in' : 'not-checked-in'
  }

  const checkedInCount = participants.filter((p) => getCheckInStatus(p) === 'checked-in').length
  const notCheckedInCount = participants.length - checkedInCount

  const filteredParticipants = participants.filter((p) => {
    const searchTerm = filter.toLowerCase()
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm) ||
      p.email.toLowerCase().includes(searchTerm) ||
      p.phoneNumber?.toLowerCase().includes(searchTerm) ||
      p.ward?.toLowerCase().includes(searchTerm) ||
      p.stake?.toLowerCase().includes(searchTerm)

    if (!matchesSearch) return false

    if (checkInFilter === 'all') return true
    return getCheckInStatus(p) === checkInFilter
  })

  const getGroupMembers = (groupId: string) => {
    return participants.filter((p) => p.groupId === groupId)
  }

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId)
    setSelectedGroupMembers(new Set())
  }

  const getRoomMembers = (roomId: string) => {
    return participants.filter((p) => p.roomId === roomId)
  }

  const toggleRoomExpand = (roomId: string) => {
    setExpandedRoomId(expandedRoomId === roomId ? null : roomId)
    setSelectedRoomMembers(new Set())
  }

  const toggleRoomMemberSelection = (memberId: string) => {
    setSelectedRoomMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(memberId)) {
        newSet.delete(memberId)
      } else {
        newSet.add(memberId)
      }
      return newSet
    })
  }

  const toggleGroupMemberSelection = (memberId: string) => {
    setSelectedGroupMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(memberId)) {
        newSet.delete(memberId)
      } else {
        newSet.add(memberId)
      }
      return newSet
    })
  }

  const handleMoveToRoom = async (targetRoom: Room) => {
    setIsMoving(true)
    setMoveError(null)
    try {
      await moveParticipantsToRoom(
        Array.from(selectedRoomMembers),
        targetRoom.id,
        targetRoom.roomNumber
      )
      await sync()
      setSelectedRoomMembers(new Set())
      setShowMoveToRoomModal(false)
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : 'Failed to move participants')
    } finally {
      setIsMoving(false)
    }
  }

  const handleMoveToGroup = async (targetGroup: Group) => {
    setIsMoving(true)
    setMoveError(null)
    try {
      await moveParticipantsToGroup(
        Array.from(selectedGroupMembers),
        targetGroup.id,
        targetGroup.name
      )
      await sync()
      setSelectedGroupMembers(new Set())
      setShowMoveToGroupModal(false)
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : 'Failed to move participants')
    } finally {
      setIsMoving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-3 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#050505] mb-1">All Data</h1>
        <p className="text-[#65676B]">View all participants, groups, and rooms</p>
      </div>

      <div className="flex border-b border-[#DADDE1] mb-6">
        <button
          onClick={() => setActiveTab('participants')}
          className={`relative px-4 py-3 font-medium text-[15px] transition-colors ${
            activeTab === 'participants'
              ? 'text-[#1877F2] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-[#1877F2] after:rounded-t-sm'
              : 'text-[#65676B] hover:bg-[#F2F2F2] rounded-t-lg'
          }`}
        >
          Participants ({participants.length})
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`relative px-4 py-3 font-medium text-[15px] transition-colors ${
            activeTab === 'groups'
              ? 'text-[#1877F2] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-[#1877F2] after:rounded-t-sm'
              : 'text-[#65676B] hover:bg-[#F2F2F2] rounded-t-lg'
          }`}
        >
          Groups ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`relative px-4 py-3 font-medium text-[15px] transition-colors ${
            activeTab === 'rooms'
              ? 'text-[#1877F2] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-[#1877F2] after:rounded-t-sm'
              : 'text-[#65676B] hover:bg-[#F2F2F2] rounded-t-lg'
          }`}
        >
          Rooms ({rooms.length})
        </button>
      </div>

      {activeTab === 'participants' && (
        <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm">
          <div className="p-4 border-b border-[#DADDE1]">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter participants..."
                className="flex-1 md:max-w-80 px-4 py-2 bg-[#F0F2F5] border-none rounded-full outline-none focus:ring-2 focus:ring-[#1877F2] placeholder-[#65676B]"
              />
              <div className="flex items-center gap-2">
                <div className="flex bg-[#F0F2F5] rounded-lg p-1">
                  <button
                    onClick={() => setCheckInFilter('all')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      checkInFilter === 'all'
                        ? 'bg-white text-[#050505] shadow-sm'
                        : 'text-[#65676B] hover:text-[#050505]'
                    }`}
                  >
                    All ({participants.length})
                  </button>
                  <button
                    onClick={() => setCheckInFilter('checked-in')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      checkInFilter === 'checked-in'
                        ? 'bg-white text-[#31A24C] shadow-sm'
                        : 'text-[#65676B] hover:text-[#050505]'
                    }`}
                  >
                    Checked In ({checkedInCount})
                  </button>
                  <button
                    onClick={() => setCheckInFilter('not-checked-in')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      checkInFilter === 'not-checked-in'
                        ? 'bg-white text-[#FA383E] shadow-sm'
                        : 'text-[#65676B] hover:text-[#050505]'
                    }`}
                  >
                    Not Checked In ({notCheckedInCount})
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F0F2F5] border-b border-[#DADDE1]">
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Ward
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Group
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Room
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr
                    key={participant.id}
                    onClick={() => navigate(`/participant/${participant.id}`)}
                    className="border-b border-[#DADDE1] last:border-0 hover:bg-[#F0F2F5] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-[#050505]">{participant.name}</td>
                    <td className="px-4 py-3 text-[#65676B]">{participant.email}</td>
                    <td className="px-4 py-3 text-[#65676B]">{participant.phoneNumber || '-'}</td>
                    <td className="px-4 py-3 text-[#65676B]">{participant.ward || '-'}</td>
                    <td className="px-4 py-3">
                      {participant.groupName ? (
                        <span className="px-2 py-1 bg-[#E7F3FF] text-[#1877F2] rounded-md text-sm font-semibold">
                          {participant.groupName}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {participant.roomNumber ? (
                        <span className="px-2 py-1 bg-[#F0F2F5] text-[#65676B] rounded-md text-sm font-semibold">
                          {participant.roomNumber}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getCheckInStatus(participant) === 'checked-in' ? (
                        <span className="px-2 py-1 bg-[#EFFFF6] text-[#31A24C] rounded-md text-xs font-semibold">
                          Checked In
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-[#F0F2F5] text-[#65676B] rounded-md text-xs font-semibold">
                          Not Checked In
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredParticipants.length === 0 && (
              <div className="text-center py-8 text-[#65676B]">No participants found</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F0F2F5] border-b border-[#DADDE1]">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#65676B] w-8"></th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Group Name
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Members
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const isExpanded = expandedGroupId === group.id
                  const members = getGroupMembers(group.id)
                  return (
                    <React.Fragment key={group.id}>
                      <tr
                        onClick={() => toggleGroupExpand(group.id)}
                        className="border-b border-[#DADDE1] last:border-0 hover:bg-[#F0F2F5] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-[#65676B]">
                          <span
                            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#050505]">{group.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 bg-[#E7F3FF] text-[#1877F2] rounded-full text-sm font-medium">
                            {group.participantCount} members
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#65676B]">
                          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                            group.createdAt
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={4}
                            className="bg-[#F0F2F5] px-4 py-2 border-b border-[#DADDE1]"
                          >
                            {members.length > 0 ? (
                              <div className="ml-6 border-l-2 border-[#1877F2]/30 pl-4">
                                {selectedGroupMembers.size > 0 && (
                                  <div className="mb-3 flex items-center gap-3">
                                    <span className="text-sm text-[#65676B]">
                                      {selectedGroupMembers.size} selected
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMoveError(null)
                                        setShowMoveToGroupModal(true)
                                      }}
                                      className="px-3 py-1 bg-[#1877F2] text-white text-sm rounded-md hover:bg-[#166FE5] font-semibold shadow-sm"
                                    >
                                      Move to Another Group
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedGroupMembers(new Set())
                                      }}
                                      className="px-3 py-1 bg-[#E4E6EB] text-[#050505] text-sm rounded-md hover:bg-[#D8DADF] font-semibold"
                                    >
                                      Clear Selection
                                    </button>
                                  </div>
                                )}
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-xs text-[#65676B]">
                                      <th className="py-2 text-left font-medium w-8">
                                        <input
                                          type="checkbox"
                                          checked={
                                            members.length > 0 &&
                                            members.every((m) => selectedGroupMembers.has(m.id))
                                          }
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            if (
                                              members.every((m) => selectedGroupMembers.has(m.id))
                                            ) {
                                              setSelectedGroupMembers(new Set())
                                            } else {
                                              setSelectedGroupMembers(
                                                new Set(members.map((m) => m.id))
                                              )
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-4 h-4 rounded border-[#DADDE1] text-[#1877F2] focus:ring-[#1877F2]"
                                        />
                                      </th>
                                      <th className="py-2 text-left font-medium">Name</th>
                                      <th className="py-2 text-left font-medium">Email</th>
                                      <th className="py-2 text-left font-medium">Phone</th>
                                      <th className="py-2 text-left font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {members.map((member) => (
                                      <tr
                                        key={member.id}
                                        className={`hover:bg-[#E7F3FF]/50 cursor-pointer ${
                                          selectedGroupMembers.has(member.id)
                                            ? 'bg-[#E7F3FF]/50'
                                            : ''
                                        }`}
                                      >
                                        <td className="py-2">
                                          <input
                                            type="checkbox"
                                            checked={selectedGroupMembers.has(member.id)}
                                            onChange={() => toggleGroupMemberSelection(member.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-4 h-4 rounded border-[#DADDE1] text-[#1877F2] focus:ring-[#1877F2]"
                                          />
                                        </td>
                                        <td
                                          className="py-2 text-sm font-semibold text-[#050505]"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/participant/${member.id}`)
                                          }}
                                        >
                                          {member.name}
                                        </td>
                                        <td className="py-2 text-sm text-[#65676B]">
                                          {member.email}
                                        </td>
                                        <td className="py-2 text-sm text-[#65676B]">
                                          {member.phoneNumber || '-'}
                                        </td>
                                        <td className="py-2">
                                          {getCheckInStatus(member) === 'checked-in' ? (
                                            <span className="px-2 py-1 bg-[#EFFFF6] text-[#31A24C] rounded-md text-xs font-semibold">
                                              Checked In
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 bg-[#F0F2F5] text-[#65676B] rounded-md text-xs font-semibold">
                                              Not Checked In
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="ml-6 py-2 text-sm text-[#65676B]">
                                No members in this group
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {groups.length === 0 && (
              <div className="text-center py-8 text-[#65676B]">No groups created yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F0F2F5] border-b border-[#DADDE1]">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#65676B] w-8"></th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Room Number
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Occupancy
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const isFull = room.currentOccupancy >= room.maxCapacity
                  const occupancyPercent = (room.currentOccupancy / room.maxCapacity) * 100
                  const isExpanded = expandedRoomId === room.id
                  const members = getRoomMembers(room.id)
                  return (
                    <React.Fragment key={room.id}>
                      <tr
                        onClick={() => toggleRoomExpand(room.id)}
                        className="border-b border-[#DADDE1] last:border-0 hover:bg-[#F0F2F5] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-[#65676B]">
                          <span
                            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#050505]">
                          Room {room.roomNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isFull
                                    ? 'bg-[#FA383E]'
                                    : occupancyPercent > 75
                                      ? 'bg-yellow-500'
                                      : 'bg-[#31A24C]'
                                }`}
                                style={{ width: `${occupancyPercent}%` }}
                              />
                            </div>
                            <span className="text-sm text-[#65676B]">
                              {room.currentOccupancy} / {room.maxCapacity}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isFull ? (
                            <span className="px-2 py-1 bg-[#FFEBEE] text-[#FA383E] rounded-md text-xs font-semibold">
                              Full
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-[#EFFFF6] text-[#31A24C] rounded-md text-xs font-semibold">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#65676B]">
                          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                            room.createdAt
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={5}
                            className="bg-[#F0F2F5] px-4 py-2 border-b border-[#DADDE1]"
                          >
                            {members.length > 0 ? (
                              <div className="ml-6 border-l-2 border-[#1877F2]/30 pl-4">
                                {selectedRoomMembers.size > 0 && (
                                  <div className="mb-3 flex items-center gap-3">
                                    <span className="text-sm text-[#65676B]">
                                      {selectedRoomMembers.size} selected
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMoveError(null)
                                        setShowMoveToRoomModal(true)
                                      }}
                                      className="px-3 py-1 bg-[#1877F2] text-white text-sm rounded-md hover:bg-[#166FE5] font-semibold shadow-sm"
                                    >
                                      Move to Another Room
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedRoomMembers(new Set())
                                      }}
                                      className="px-3 py-1 bg-[#E4E6EB] text-[#050505] text-sm rounded-md hover:bg-[#D8DADF] font-semibold"
                                    >
                                      Clear Selection
                                    </button>
                                  </div>
                                )}
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-xs text-[#65676B]">
                                      <th className="py-2 text-left font-medium w-8">
                                        <input
                                          type="checkbox"
                                          checked={
                                            members.length > 0 &&
                                            members.every((m) => selectedRoomMembers.has(m.id))
                                          }
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            if (
                                              members.every((m) => selectedRoomMembers.has(m.id))
                                            ) {
                                              setSelectedRoomMembers(new Set())
                                            } else {
                                              setSelectedRoomMembers(
                                                new Set(members.map((m) => m.id))
                                              )
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-4 h-4 rounded border-[#DADDE1] text-[#1877F2] focus:ring-[#1877F2]"
                                        />
                                      </th>
                                      <th className="py-2 text-left font-medium">Name</th>
                                      <th className="py-2 text-left font-medium">Email</th>
                                      <th className="py-2 text-left font-medium">Phone</th>
                                      <th className="py-2 text-left font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {members.map((member) => (
                                      <tr
                                        key={member.id}
                                        className={`hover:bg-[#E7F3FF]/50 cursor-pointer ${
                                          selectedRoomMembers.has(member.id) ? 'bg-[#E7F3FF]' : ''
                                        }`}
                                      >
                                        <td className="py-2">
                                          <input
                                            type="checkbox"
                                            checked={selectedRoomMembers.has(member.id)}
                                            onChange={() => toggleRoomMemberSelection(member.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-4 h-4 rounded border-[#DADDE1] text-[#1877F2] focus:ring-[#1877F2]"
                                          />
                                        </td>
                                        <td
                                          className="py-2 text-sm font-semibold text-[#050505]"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/participant/${member.id}`)
                                          }}
                                        >
                                          {member.name}
                                        </td>
                                        <td className="py-2 text-sm text-[#65676B]">
                                          {member.email}
                                        </td>
                                        <td className="py-2 text-sm text-[#65676B]">
                                          {member.phoneNumber || '-'}
                                        </td>
                                        <td className="py-2">
                                          {getCheckInStatus(member) === 'checked-in' ? (
                                            <span className="px-2 py-1 bg-[#EFFFF6] text-[#31A24C] rounded-md text-xs font-semibold">
                                              Checked In
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 bg-[#F0F2F5] text-[#65676B] rounded-md text-xs font-semibold">
                                              Not Checked In
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="ml-6 py-2 text-sm text-[#65676B]">
                                No one assigned to this room
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {rooms.length === 0 && (
              <div className="text-center py-8 text-[#65676B]">No rooms created yet</div>
            )}
          </div>
        </div>
      )}

      {showMoveToRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 border border-[#DADDE1]">
            <h3 className="text-xl font-bold text-[#050505] mb-4">
              Move {selectedRoomMembers.size} participant(s) to another room
            </h3>

            {moveError && (
              <div className="mb-4 p-3 bg-[#FFEBEE] border border-[#FFCDD2] text-[#FA383E] rounded-md text-sm">
                {moveError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rooms
                .filter((r) => r.id !== expandedRoomId)
                .map((room) => {
                  const available = room.maxCapacity - room.currentOccupancy
                  const canFit = available >= selectedRoomMembers.size
                  return (
                    <button
                      key={room.id}
                      onClick={() => handleMoveToRoom(room)}
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowMoveToRoomModal(false)}
                disabled={isMoving}
                className="px-4 py-2 bg-[#E4E6EB] text-[#050505] rounded-md hover:bg-[#D8DADF] font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveToGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 border border-[#DADDE1]">
            <h3 className="text-xl font-bold text-[#050505] mb-4">
              Move {selectedGroupMembers.size} participant(s) to another group
            </h3>

            {moveError && (
              <div className="mb-4 p-3 bg-[#FFEBEE] border border-[#FFCDD2] text-[#FA383E] rounded-md text-sm">
                {moveError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {groups
                .filter((g) => g.id !== expandedGroupId)
                .map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleMoveToGroup(group)}
                    disabled={isMoving}
                    className="w-full p-3 rounded-lg border border-[#DADDE1] text-left hover:bg-[#F0F2F5] transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#050505]">{group.name}</span>
                      <span className="text-sm text-[#65676B]">
                        {group.participantCount} members
                      </span>
                    </div>
                  </button>
                ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowMoveToGroupModal(false)}
                disabled={isMoving}
                className="px-4 py-2 bg-[#E4E6EB] text-[#050505] rounded-md hover:bg-[#D8DADF] font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ParticipantsListPage
