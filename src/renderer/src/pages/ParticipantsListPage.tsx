import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllParticipants, getAllGroups, getAllRooms } from '../services/firebase'
import type { Participant, Group, Room } from '../types'

function ParticipantsListPage(): React.ReactElement {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'participants' | 'groups' | 'rooms'>('participants')
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

      {/* Tabs */}
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

      {/* Participants Tab */}
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

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
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
                {groups.map((group) => (
                  <tr key={group.id} className="border-b border-slate-100 hover:bg-slate-50">
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
                ))}
              </tbody>
            </table>
            {groups.length === 0 && (
              <div className="text-center py-8 text-slate-500">No groups created yet</div>
            )}
          </div>
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
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
                  return (
                    <tr key={room.id} className="border-b border-slate-100 hover:bg-slate-50">
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
    </div>
  )
}

export default ParticipantsListPage
