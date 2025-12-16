import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  getParticipantById,
  checkInParticipant,
  checkOutParticipant,
  getAllGroups,
  getAllRooms,
  assignParticipantToGroup,
  assignParticipantToRoom,
  createOrGetGroup,
  createOrGetRoom
} from '../services/firebase'
import type { Participant, Group, Room, CheckInRecord } from '../types'

function ParticipantDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [showGroupSelect, setShowGroupSelect] = useState(false)
  const [showRoomSelect, setShowRoomSelect] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newRoomCapacity, setNewRoomCapacity] = useState(4)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [participantData, groupsData, roomsData] = await Promise.all([
        getParticipantById(id!),
        getAllGroups(),
        getAllRooms()
      ])
      setParticipant(participantData)
      setGroups(groupsData)
      setRooms(roomsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!participant) return
    setIsCheckingIn(true)
    try {
      await checkInParticipant(participant.id)
      await loadData()
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
      await loadData()
    } catch (error) {
      console.error('Check-out error:', error)
    }
  }

  const handleGroupAssign = async (group: Group) => {
    if (!participant) return
    try {
      await assignParticipantToGroup(participant.id, group.id, group.name)
      await loadData()
      setShowGroupSelect(false)
    } catch (error) {
      console.error('Group assignment error:', error)
    }
  }

  const handleNewGroup = async () => {
    if (!newGroupName.trim() || !participant) return
    try {
      const group = await createOrGetGroup(newGroupName.trim())
      await assignParticipantToGroup(participant.id, group.id, group.name)
      await loadData()
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
      await assignParticipantToRoom(participant.id, room.id, room.roomNumber)
      await loadData()
      setShowRoomSelect(false)
    } catch (error) {
      console.error('Room assignment error:', error)
    }
  }

  const handleNewRoom = async () => {
    if (!newRoomNumber.trim() || !participant) return
    try {
      const room = await createOrGetRoom(newRoomNumber.trim(), newRoomCapacity)
      await assignParticipantToRoom(participant.id, room.id, room.roomNumber)
      await loadData()
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!participant) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Participant not found</h2>
        <Link to="/" className="text-blue-600 hover:underline">
          Back to search
        </Link>
      </div>
    )
  }

  const activeCheckIn = getActiveCheckIn()

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-medium">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to search
      </Link>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{participant.name}</h1>
            <p className="text-slate-500 mt-1">
              {participant.ward && participant.ward}
              {participant.stake && `, ${participant.stake}`}
            </p>
          </div>
          <div className="flex gap-3">
            {activeCheckIn ? (
              <button
                onClick={() => handleCheckOut(activeCheckIn.id)}
                className="px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Check Out
              </button>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={isCheckingIn}
                className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {isCheckingIn ? 'Checking in...' : 'Check In'}
              </button>
            )}
          </div>
        </div>

        {activeCheckIn && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Currently Checked In</span>
              <span className="text-green-600">since {formatDate(activeCheckIn.checkInTime)}</span>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200">
            Personal Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Email</div>
              <div className="font-medium text-slate-800">{participant.email}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Phone</div>
              <div className="font-medium text-slate-800">{participant.phoneNumber || '-'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Gender</div>
              <div className="font-medium text-slate-800 capitalize">{participant.gender || '-'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Age</div>
              <div className="font-medium text-slate-800">{participant.age || '-'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Ward</div>
              <div className="font-medium text-slate-800">{participant.ward || '-'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Stake</div>
              <div className="font-medium text-slate-800">{participant.stake || '-'}</div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200">
            Group & Room Assignment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Group Assignment */}
            <div>
              <div className="text-sm font-medium text-slate-600 mb-2">Group</div>
              <div className="flex items-center gap-3">
                {participant.groupName ? (
                  <span className="px-4 py-2 bg-blue-500 text-white rounded-full font-medium">
                    {participant.groupName}
                  </span>
                ) : (
                  <span className="px-4 py-2 bg-slate-200 text-slate-500 rounded-full">Not assigned</span>
                )}
                <button
                  onClick={() => setShowGroupSelect(!showGroupSelect)}
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  {participant.groupName ? 'Change' : 'Assign'}
                </button>
              </div>
              {showGroupSelect && (
                <div className="mt-3 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">Select Group</div>
                  <div className="max-h-48 overflow-y-auto mb-3">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        onClick={() => handleGroupAssign(group)}
                        className="flex justify-between items-center px-3 py-2 hover:bg-slate-50 rounded cursor-pointer"
                      >
                        <span>{group.name}</span>
                        <span className="text-xs bg-slate-200 px-2 py-1 rounded">
                          {group.participantCount} members
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">Or create new group</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group name"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <button
                        onClick={handleNewGroup}
                        disabled={!newGroupName.trim()}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
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
              <div className="text-sm font-medium text-slate-600 mb-2">Room</div>
              <div className="flex items-center gap-3">
                {participant.roomNumber ? (
                  <span className="px-4 py-2 bg-purple-500 text-white rounded-full font-medium">
                    Room {participant.roomNumber}
                  </span>
                ) : (
                  <span className="px-4 py-2 bg-slate-200 text-slate-500 rounded-full">Not assigned</span>
                )}
                <button
                  onClick={() => setShowRoomSelect(!showRoomSelect)}
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  {participant.roomNumber ? 'Change' : 'Assign'}
                </button>
              </div>
              {showRoomSelect && (
                <div className="mt-3 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
                  <div className="text-sm font-medium text-slate-700 mb-2">Select Room</div>
                  <div className="max-h-48 overflow-y-auto mb-3">
                    {rooms.map((room) => {
                      const isFull = room.currentOccupancy >= room.maxCapacity
                      return (
                        <div
                          key={room.id}
                          onClick={() => !isFull && handleRoomAssign(room)}
                          className={`flex justify-between items-center px-3 py-2 rounded ${
                            isFull ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <span>Room {room.roomNumber}</span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                            }`}
                          >
                            {room.currentOccupancy}/{room.maxCapacity}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">Or create new room</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRoomNumber}
                        onChange={(e) => setNewRoomNumber(e.target.value)}
                        placeholder="Room number"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        value={newRoomCapacity}
                        onChange={(e) => setNewRoomCapacity(parseInt(e.target.value) || 4)}
                        placeholder="Max"
                        min={1}
                        className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                      <button
                        onClick={handleNewRoom}
                        disabled={!newRoomNumber.trim()}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
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
          <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-200">
            Check-in History
          </h2>
          {participant.checkIns.length > 0 ? (
            <div className="space-y-2">
              {[...participant.checkIns].reverse().map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-slate-800">In: {formatDate(checkIn.checkInTime)}</span>
                    {checkIn.checkOutTime && (
                      <span className="text-slate-500 ml-4">Out: {formatDate(checkIn.checkOutTime)}</span>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      checkIn.checkOutTime
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {checkIn.checkOutTime ? 'Completed' : 'Active'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No check-in history</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ParticipantDetailPage
