import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllParticipants,
  getAllGroups,
  getAllRooms,
  moveParticipantsToRoom,
  moveParticipantsToGroup
} from '../services/firebase'
import type { Participant, Group, Room } from '../types'

function ParticipantsListPage(): React.ReactElement {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('')
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [participantsData, groupsData, roomsData] = await Promise.all([
        getAllParticipants(),
        getAllGroups(),
        getAllRooms()
      ])
      setParticipants(participantsData)
      setGroups(groupsData)
      setRooms(roomsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredParticipants = participants.filter((p) => {
    const searchTerm = filter.toLowerCase()
    return (
      p.name.toLowerCase().includes(searchTerm) ||
      p.email.toLowerCase().includes(searchTerm) ||
      p.phoneNumber?.toLowerCase().includes(searchTerm) ||
      p.ward?.toLowerCase().includes(searchTerm) ||
      p.stake?.toLowerCase().includes(searchTerm)
    )
  })

  const getCheckInStatus = (participant: Participant) => {
    const activeCheckIn = participant.checkIns.find((ci) => !ci.checkOutTime)
    return activeCheckIn ? 'checked-in' : 'not-checked-in'
  }

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
      await loadData()
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
      await loadData()
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
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">All Data</h1>
        <p className="text-slate-500">View all participants, groups, and rooms</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('participants')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'participants'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Participants ({participants.length})
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'groups'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Groups ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'rooms'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Rooms ({rooms.length})
        </button>
      </div>

      {activeTab === 'participants' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter participants..."
              className="w-full md:w-80 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Ward</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Group
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Room</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr
                    key={participant.id}
                    onClick={() => navigate(`/participant/${participant.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{participant.name}</td>
                    <td className="px-4 py-3 text-slate-600">{participant.email}</td>
                    <td className="px-4 py-3 text-slate-600">{participant.phoneNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{participant.ward || '-'}</td>
                    <td className="px-4 py-3">
                      {participant.groupName ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                          {participant.groupName}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {participant.roomNumber ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                          {participant.roomNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getCheckInStatus(participant) === 'checked-in' ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          Checked In
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                          Not Checked In
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredParticipants.length === 0 && (
              <div className="text-center py-8 text-slate-500">No participants found</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-8"></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Group Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Members
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
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
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 text-slate-400">
                          <span
                            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{group.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            {group.participantCount} members
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                            group.createdAt
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="bg-slate-50 px-4 py-2">
                            {members.length > 0 ? (
                              <div className="ml-6 border-l-2 border-blue-200 pl-4">
                                {selectedGroupMembers.size > 0 && (
                                  <div className="mb-3 flex items-center gap-3">
                                    <span className="text-sm text-slate-600">
                                      {selectedGroupMembers.size} selected
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMoveError(null)
                                        setShowMoveToGroupModal(true)
                                      }}
                                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                    >
                                      Move to Another Group
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedGroupMembers(new Set())
                                      }}
                                      className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300"
                                    >
                                      Clear Selection
                                    </button>
                                  </div>
                                )}
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-xs text-slate-500">
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
                                          className="w-4 h-4 rounded border-slate-300"
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
                                        className={`hover:bg-blue-50 cursor-pointer ${
                                          selectedGroupMembers.has(member.id) ? 'bg-blue-50' : ''
                                        }`}
                                      >
                                        <td className="py-2">
                                          <input
                                            type="checkbox"
                                            checked={selectedGroupMembers.has(member.id)}
                                            onChange={() => toggleGroupMemberSelection(member.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-4 h-4 rounded border-slate-300"
                                          />
                                        </td>
                                        <td
                                          className="py-2 text-sm font-medium text-slate-800"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/participant/${member.id}`)
                                          }}
                                        >
                                          {member.name}
                                        </td>
                                        <td className="py-2 text-sm text-slate-600">
                                          {member.email}
                                        </td>
                                        <td className="py-2 text-sm text-slate-600">
                                          {member.phoneNumber || '-'}
                                        </td>
                                        <td className="py-2">
                                          {getCheckInStatus(member) === 'checked-in' ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                              Checked In
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
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
                              <div className="ml-6 py-2 text-sm text-slate-500">
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
              <div className="text-center py-8 text-slate-500">No groups created yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-8"></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Room Number
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Occupancy
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
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
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-4 py-3 text-slate-400">
                          <span
                            className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          Room {room.roomNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isFull
                                    ? 'bg-red-500'
                                    : occupancyPercent > 75
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${occupancyPercent}%` }}
                              />
                            </div>
                            <span className="text-sm text-slate-600">
                              {room.currentOccupancy} / {room.maxCapacity}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isFull ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              Full
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
                            room.createdAt
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50 px-4 py-2">
                            {members.length > 0 ? (
                              <div className="ml-6 border-l-2 border-purple-200 pl-4">
                                {selectedRoomMembers.size > 0 && (
                                  <div className="mb-3 flex items-center gap-3">
                                    <span className="text-sm text-slate-600">
                                      {selectedRoomMembers.size} selected
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setMoveError(null)
                                        setShowMoveToRoomModal(true)
                                      }}
                                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                                    >
                                      Move to Another Room
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedRoomMembers(new Set())
                                      }}
                                      className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300"
                                    >
                                      Clear Selection
                                    </button>
                                  </div>
                                )}
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-xs text-slate-500">
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
                                          className="w-4 h-4 rounded border-slate-300"
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
                                        className={`hover:bg-purple-50 cursor-pointer ${
                                          selectedRoomMembers.has(member.id) ? 'bg-purple-50' : ''
                                        }`}
                                      >
                                        <td className="py-2">
                                          <input
                                            type="checkbox"
                                            checked={selectedRoomMembers.has(member.id)}
                                            onChange={() => toggleRoomMemberSelection(member.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-4 h-4 rounded border-slate-300"
                                          />
                                        </td>
                                        <td
                                          className="py-2 text-sm font-medium text-slate-800"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/participant/${member.id}`)
                                          }}
                                        >
                                          {member.name}
                                        </td>
                                        <td className="py-2 text-sm text-slate-600">
                                          {member.email}
                                        </td>
                                        <td className="py-2 text-sm text-slate-600">
                                          {member.phoneNumber || '-'}
                                        </td>
                                        <td className="py-2">
                                          {getCheckInStatus(member) === 'checked-in' ? (
                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                              Checked In
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
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
                              <div className="ml-6 py-2 text-sm text-slate-500">
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
              <div className="text-center py-8 text-slate-500">No rooms created yet</div>
            )}
          </div>
        </div>
      )}

      {showMoveToRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Move {selectedRoomMembers.size} participant(s) to another room
            </h3>

            {moveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {moveError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
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
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        canFit
                          ? 'border-slate-200 hover:border-purple-500 hover:bg-purple-50'
                          : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-800">Room {room.roomNumber}</span>
                        <span className={`text-sm ${canFit ? 'text-green-600' : 'text-red-600'}`}>
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
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveToGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Move {selectedGroupMembers.size} participant(s) to another group
            </h3>

            {moveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {moveError}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {groups
                .filter((g) => g.id !== expandedGroupId)
                .map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleMoveToGroup(group)}
                    disabled={isMoving}
                    className="w-full p-3 rounded-lg border border-slate-200 text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-800">{group.name}</span>
                      <span className="text-sm text-slate-500">
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
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
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
