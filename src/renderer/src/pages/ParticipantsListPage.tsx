import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  moveParticipantsToRoom,
  moveParticipantsToGroup,
  searchParticipantsPaginated
} from '../services/firebase'
import {
  participantsAtom,
  groupsAtom,
  roomsAtom,
  isLoadingAtom,
  syncAtom
} from '../stores/dataStore'
import type {
  Participant,
  Group,
  Room,
  CheckInFilter,
  TabType,
  SortField,
  SortDirection
} from '../types'
import { CheckInStatus } from '../types'
import {
  TabBar,
  Tooltip,
  CheckInFilterButtons,
  CheckInStatusBadge,
  getCheckInStatusFromParticipant,
  OccupancyBar,
  MoveToModal,
  ExpandArrow,
  MemberSelectionTable,
  ParticipantsListSkeleton
} from '../components'

function ParticipantsListPage(): React.ReactElement {
  const allParticipants = useAtomValue(participantsAtom)
  const groups = useAtomValue(groupsAtom)
  const rooms = useAtomValue(roomsAtom)
  const isLoading = useAtomValue(isLoadingAtom)
  const sync = useSetAtom(syncAtom)
  const [filter, setFilter] = useState('')
  const [checkInFilter, setCheckInFilter] = useState<CheckInFilter>('all')
  const [activeTab, setActiveTab] = useState<TabType>('participants')
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)

  const [selectedRoomMembers, setSelectedRoomMembers] = useState<Set<string>>(new Set())
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<Set<string>>(new Set())
  const [showMoveToRoomModal, setShowMoveToRoomModal] = useState(false)
  const [showMoveToGroupModal, setShowMoveToGroupModal] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const [displayedParticipants, setDisplayedParticipants] = useState<Participant[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const pageSize = 100

  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const navigate = useNavigate()

  const checkedInCount = allParticipants.filter(
    (p) => getCheckInStatusFromParticipant(p.checkIns) === CheckInStatus.CheckedIn
  ).length
  const notCheckedInCount = allParticipants.length - checkedInCount

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleResetSort = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSortField(null)
    setSortDirection('asc')
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide cursor-pointer hover:bg-[#E4E6EB] transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <>
            <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
            <button
              onClick={handleResetSort}
              className="ml-1 text-[#65676B] hover:text-[#050505] text-xs font-bold"
              title="Clear sort"
            >
              ×
            </button>
          </>
        )}
      </div>
    </th>
  )

  const loadParticipants = useCallback(
    async (reset: boolean = false) => {
      setIsSearching(true)
      try {
        const loadedIds = reset
          ? new Set<string>()
          : new Set(displayedParticipants.map((p) => p.id))
        const result = await searchParticipantsPaginated(
          filter,
          checkInFilter,
          pageSize,
          loadedIds,
          sortField,
          sortDirection
        )

        if (reset) {
          setDisplayedParticipants(result.data)
        } else {
          setDisplayedParticipants((prev) => [...prev, ...result.data])
        }
        setHasMore(result.hasMore)
        setHasInitiallyLoaded(true)
      } catch (error) {
        console.error('Failed to load participants:', error)
      } finally {
        setIsSearching(false)
      }
    },
    [filter, checkInFilter, displayedParticipants, sortField, sortDirection]
  )

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadParticipants(true)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [filter, checkInFilter, sortField, sortDirection])

  useEffect(() => {
    if (hasInitiallyLoaded) {
      loadParticipants(true)
    }
  }, [allParticipants])

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isSearching) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isSearching) {
          loadParticipants(false)
        }
      },
      { threshold: 0.1 }
    )

    observerRef.current.observe(loadMoreRef.current)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, isSearching, loadParticipants])

  const getGroupMembers = (groupId: string) => {
    return allParticipants.filter((p) => p.groupId === groupId)
  }

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId)
    setSelectedGroupMembers(new Set())
  }

  const getRoomMembers = (roomId: string) => {
    return allParticipants.filter((p) => p.roomId === roomId)
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

  const tabs = [
    { id: 'participants' as TabType, label: 'Participants', count: allParticipants.length },
    { id: 'groups' as TabType, label: 'Groups', count: groups.length },
    { id: 'rooms' as TabType, label: 'Rooms', count: rooms.length }
  ]

  if (isLoading) {
    return <ParticipantsListSkeleton />
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#050505] mb-1">All Data</h1>
        <p className="text-[#65676B]">View all participants, groups, and rooms</p>
      </div>

      <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

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
                <CheckInFilterButtons
                  filter={checkInFilter}
                  onChange={setCheckInFilter}
                  counts={{
                    all: allParticipants.length,
                    checkedIn: checkedInCount,
                    notCheckedIn: notCheckedInCount
                  }}
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F0F2F5] border-b border-[#DADDE1]">
                  <SortableHeader field="name">Name</SortableHeader>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#65676B] uppercase tracking-wide">
                    Phone
                  </th>
                  <SortableHeader field="ward">Ward</SortableHeader>
                  <SortableHeader field="group">Group</SortableHeader>
                  <SortableHeader field="room">Room</SortableHeader>
                  <SortableHeader field="payment">Payment</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                </tr>
              </thead>
              <tbody>
                {displayedParticipants.map((participant) => (
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
                      {participant.isPaid ? (
                        <span className="px-2 py-1 bg-[#EFFFF6] text-[#31A24C] rounded-md text-sm font-semibold">
                          Paid
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-[#FFEBEE] text-[#FA383E] rounded-md text-sm font-semibold">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CheckInStatusBadge
                        status={getCheckInStatusFromParticipant(participant.checkIns)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayedParticipants.length === 0 && !isSearching && hasInitiallyLoaded && (
              <div className="text-center py-8 text-[#65676B]">No participants found</div>
            )}
            {hasMore && hasInitiallyLoaded && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isSearching ? (
                  <div className="w-6 h-6 border-2 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin" />
                ) : (
                  <span className="text-[#65676B] text-sm">Scroll to load more...</span>
                )}
              </div>
            )}
            {isSearching && displayedParticipants.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm overflow-visible">
          <div className="overflow-visible">
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
                        onMouseEnter={() => setHoveredGroupId(group.id)}
                        onMouseLeave={() => setHoveredGroupId(null)}
                        className="border-b border-[#DADDE1] last:border-0 hover:bg-[#F0F2F5] cursor-pointer transition-colors relative"
                      >
                        <td className="px-4 py-3 text-[#65676B]">
                          <ExpandArrow isExpanded={isExpanded} />
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#050505] relative">
                          {group.name}
                          {hoveredGroupId === group.id && members.length > 0 && !isExpanded && (
                            <Tooltip
                              title="Members"
                              items={members.map((m) => ({ id: m.id, name: m.name }))}
                            />
                          )}
                        </td>
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
                              <MemberSelectionTable
                                members={members}
                                selectedIds={selectedGroupMembers}
                                onToggle={toggleGroupMemberSelection}
                                onToggleAll={() => {
                                  if (members.every((m) => selectedGroupMembers.has(m.id))) {
                                    setSelectedGroupMembers(new Set())
                                  } else {
                                    setSelectedGroupMembers(new Set(members.map((m) => m.id)))
                                  }
                                }}
                                onNavigate={(id) => navigate(`/participant/${id}`)}
                                onClearSelection={() => setSelectedGroupMembers(new Set())}
                                onMoveAction={() => {
                                  setMoveError(null)
                                  setShowMoveToGroupModal(true)
                                }}
                                moveActionLabel="Move to Another Group"
                              />
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
            {groups.length === 0 && !isLoading && (
              <div className="text-center py-8 text-[#65676B]">No groups created yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rooms' && (
        <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm overflow-visible">
          <div className="overflow-visible">
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
                  const isExpanded = expandedRoomId === room.id
                  const members = getRoomMembers(room.id)
                  return (
                    <React.Fragment key={room.id}>
                      <tr
                        onClick={() => toggleRoomExpand(room.id)}
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() => setHoveredRoomId(null)}
                        className="border-b border-[#DADDE1] last:border-0 hover:bg-[#F0F2F5] cursor-pointer transition-colors relative"
                      >
                        <td className="px-4 py-3 text-[#65676B]">
                          <ExpandArrow isExpanded={isExpanded} />
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#050505] relative">
                          Room {room.roomNumber}
                          {hoveredRoomId === room.id && members.length > 0 && !isExpanded && (
                            <Tooltip
                              title="Occupants"
                              items={members.map((m) => ({ id: m.id, name: m.name }))}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <OccupancyBar current={room.currentOccupancy} max={room.maxCapacity} />
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
                              <MemberSelectionTable
                                members={members}
                                selectedIds={selectedRoomMembers}
                                onToggle={toggleRoomMemberSelection}
                                onToggleAll={() => {
                                  if (members.every((m) => selectedRoomMembers.has(m.id))) {
                                    setSelectedRoomMembers(new Set())
                                  } else {
                                    setSelectedRoomMembers(new Set(members.map((m) => m.id)))
                                  }
                                }}
                                onNavigate={(id) => navigate(`/participant/${id}`)}
                                onClearSelection={() => setSelectedRoomMembers(new Set())}
                                onMoveAction={() => {
                                  setMoveError(null)
                                  setShowMoveToRoomModal(true)
                                }}
                                moveActionLabel="Move to Another Room"
                              />
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
            {rooms.length === 0 && !isLoading && (
              <div className="text-center py-8 text-[#65676B]">No rooms created yet</div>
            )}
          </div>
        </div>
      )}

      {showMoveToRoomModal && (
        <MoveToModal
          type="room"
          selectedCount={selectedRoomMembers.size}
          items={rooms}
          currentId={expandedRoomId}
          isMoving={isMoving}
          error={moveError}
          onMove={handleMoveToRoom}
          onClose={() => setShowMoveToRoomModal(false)}
        />
      )}

      {showMoveToGroupModal && (
        <MoveToModal
          type="group"
          selectedCount={selectedGroupMembers.size}
          items={groups}
          currentId={expandedGroupId}
          isMoving={isMoving}
          error={moveError}
          onMove={handleMoveToGroup}
          onClose={() => setShowMoveToGroupModal(false)}
        />
      )}
    </div>
  )
}

export default ParticipantsListPage
