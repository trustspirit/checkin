import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { groupsAtom, participantsAtom, syncAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { createOrGetGroup, deleteGroup } from '../services/firebase'
import { writeAuditLog } from '../services/auditLog'
import type { Group } from '../types'

function GroupsPage(): React.ReactElement {
  const navigate = useNavigate()
  const groups = useAtomValue(groupsAtom)
  const participants = useAtomValue(participantsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)
  const [isAdding, setIsAdding] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCapacity, setNewGroupCapacity] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [csvInput, setCsvInput] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const capacity = newGroupCapacity.trim() ? parseInt(newGroupCapacity.trim(), 10) : undefined
      const group = await createOrGetGroup(newGroupName.trim(), capacity)
      await writeAuditLog(userName || 'Unknown', 'create', 'group', group.id, group.name)
      addToast({ type: 'success', message: `Group "${group.name}" created` })
      setNewGroupName('')
      setNewGroupCapacity('')
      setIsAdding(false)
      sync()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to create group' })
    }
  }

  const handleDeleteGroup = async (group: Group) => {
    if (!confirm(`Delete group "${group.name}"? Participants will be unassigned.`)) return
    try {
      await deleteGroup(group.id)
      await writeAuditLog(userName || 'Unknown', 'delete', 'group', group.id, group.name)
      addToast({ type: 'success', message: `Group "${group.name}" deleted` })
      sync()
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to delete group' })
    }
  }

  const handleImportCSV = async () => {
    if (!csvInput.trim()) return
    const lines = csvInput
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    let created = 0

    for (const name of lines) {
      try {
        const group = await createOrGetGroup(name)
        await writeAuditLog(userName || 'Unknown', 'import', 'group', group.id, group.name)
        created++
      } catch {
        console.error(`Failed to create group: ${name}`)
      }
    }

    addToast({ type: 'success', message: `Imported ${created} groups` })
    setCsvInput('')
    setIsImporting(false)
    sync()
  }

  const handleFileImport = async () => {
    const content = await window.electronAPI.openFileDialog()
    if (!content) return

    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const hasHeader =
      lines[0]?.toLowerCase().includes('name') || lines[0]?.toLowerCase().includes('group')
    const dataLines = hasHeader ? lines.slice(1) : lines
    let created = 0

    for (const line of dataLines) {
      const name = line.split(',')[0]?.trim()
      if (!name) continue
      try {
        const group = await createOrGetGroup(name)
        await writeAuditLog(userName || 'Unknown', 'import', 'group', group.id, group.name)
        created++
      } catch {
        console.error(`Failed to create group: ${name}`)
      }
    }

    addToast({ type: 'success', message: `Imported ${created} groups from CSV` })
    sync()
  }

  const getGroupParticipants = (groupId: string) => {
    return participants.filter((p) => p.groupId === groupId)
  }

  const getCapacityStatusColor = (count: number, expectedCapacity?: number) => {
    if (!expectedCapacity) return 'bg-[#DADDE1]'
    const ratio = count / expectedCapacity
    if (ratio >= 1) return 'bg-[#FA383E]'
    if (ratio >= 0.75) return 'bg-[#F57C00]'
    return 'bg-[#31A24C]'
  }

  const formatCapacity = (count: number, expectedCapacity?: number) => {
    if (expectedCapacity) {
      return `${count} / ${expectedCapacity}`
    }
    return `${count}`
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#050505]">Groups</h1>
          <p className="text-[#65676B] mt-1">Manage participant groups</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-[#F0F2F5] rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-[#050505] shadow-sm'
                  : 'text-[#65676B] hover:text-[#050505]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-[#050505] shadow-sm'
                  : 'text-[#65676B] hover:text-[#050505]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setIsImporting(!isImporting)}
            className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-lg text-sm font-semibold hover:bg-[#F0F2F5] transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors"
          >
            Add Group
          </button>
        </div>
      </div>

      {isImporting && (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-6">
          <h3 className="font-semibold text-[#050505] mb-3">Import Groups</h3>
          <div className="flex gap-4 mb-3">
            <button
              onClick={handleFileImport}
              className="px-4 py-2 border border-[#1877F2] text-[#1877F2] rounded-lg text-sm font-semibold hover:bg-[#E7F3FF] transition-colors"
            >
              Choose CSV File
            </button>
            <span className="text-[#65676B] text-sm self-center">
              or paste names below (one per line)
            </span>
          </div>
          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="Group A&#10;Group B&#10;Group C"
            className="w-full px-3 py-2 border border-[#DADDE1] rounded-lg text-sm h-32 resize-none outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setIsImporting(false)
                setCsvInput('')
              }}
              className="px-4 py-2 text-[#65676B] text-sm font-semibold hover:bg-[#F0F2F5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImportCSV}
              disabled={!csvInput.trim()}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-6">
          <h3 className="font-semibold text-[#050505] mb-3">Add New Group</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              autoFocus
              className="flex-1 px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
            />
            <input
              type="number"
              value={newGroupCapacity}
              onChange={(e) => setNewGroupCapacity(e.target.value)}
              placeholder="Expected (optional)"
              min={1}
              className="w-36 px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
            />
            <button
              onClick={() => {
                setIsAdding(false)
                setNewGroupName('')
                setNewGroupCapacity('')
              }}
              className="px-4 py-2 text-[#65676B] text-sm font-semibold hover:bg-[#F0F2F5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddGroup}
              disabled={!newGroupName.trim()}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-12 text-center">
          <div className="text-[#65676B] text-lg">No groups yet</div>
          <p className="text-[#65676B] mt-2 text-sm">Add groups to organize participants</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-lg border border-[#DADDE1]">
          <table className="w-full">
            <thead className="bg-[#F0F2F5] border-b border-[#DADDE1] rounded-t-lg">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold rounded-tl-lg">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Members
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold rounded-tr-lg">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupParticipants = getGroupParticipants(group.id)
                return (
                  <tr
                    key={group.id}
                    className="border-b border-[#DADDE1] last:border-b-0 hover:bg-[#F7F8FA] cursor-pointer relative"
                    onClick={() => navigate(`/groups/${group.id}`)}
                    onMouseEnter={() => setHoveredGroupId(group.id)}
                    onMouseLeave={() => setHoveredGroupId(null)}
                  >
                    <td className="px-4 py-3 font-medium text-[#050505]">{group.name}</td>
                    <td className="px-4 py-3 text-[#65676B]">
                      {formatCapacity(group.participantCount, group.expectedCapacity)}
                      {group.expectedCapacity && ' expected'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${getCapacityStatusColor(group.participantCount, group.expectedCapacity)}`}
                        />
                        <span className="text-sm text-[#65676B]">
                          {!group.expectedCapacity
                            ? 'No limit'
                            : group.participantCount >= group.expectedCapacity
                              ? 'Full'
                              : group.participantCount >= group.expectedCapacity * 0.75
                                ? 'Almost full'
                                : 'Available'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGroup(group)
                        }}
                        className="text-[#FA383E] hover:underline text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </td>
                    {hoveredGroupId === group.id && groupParticipants.length > 0 && (
                      <td className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-[#050505] text-white text-xs rounded-lg py-2 px-3 z-10 min-w-[160px] max-w-[240px] shadow-lg pointer-events-none">
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-[#050505]" />
                        <div className="font-semibold mb-1">Members:</div>
                        {groupParticipants.slice(0, 5).map((p) => (
                          <div key={p.id} className="truncate">
                            {p.name}
                          </div>
                        ))}
                        {groupParticipants.length > 5 && (
                          <div className="text-gray-400 mt-1">
                            +{groupParticipants.length - 5} more
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groups.map((group) => {
            const groupParticipants = getGroupParticipants(group.id)
            return (
              <div
                key={group.id}
                className="relative bg-white rounded-lg border border-[#DADDE1] p-4 hover:shadow-md hover:border-[#1877F2] transition-all cursor-pointer"
                onClick={() => navigate(`/groups/${group.id}`)}
                onMouseEnter={() => setHoveredGroupId(group.id)}
                onMouseLeave={() => setHoveredGroupId(null)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-[#050505] text-lg">{group.name}</h3>
                    <p className="text-sm text-[#65676B]">
                      {formatCapacity(group.participantCount, group.expectedCapacity)}
                      {group.expectedCapacity ? ' members' : ' members'}
                    </p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${getCapacityStatusColor(group.participantCount, group.expectedCapacity)}`}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-[#F0F2F5] text-[#65676B]">
                    {group.expectedCapacity
                      ? `${group.participantCount} / ${group.expectedCapacity}`
                      : `${group.participantCount} members`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group)
                    }}
                    className="text-[#FA383E] hover:underline text-xs font-semibold"
                  >
                    Delete
                  </button>
                </div>

                {hoveredGroupId === group.id && groupParticipants.length > 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-[#050505] text-white text-xs rounded-lg py-2 px-3 z-10 min-w-[160px] max-w-[240px] shadow-lg">
                    <div className="font-semibold mb-1">Members:</div>
                    {groupParticipants.slice(0, 5).map((p) => (
                      <div key={p.id} className="truncate">
                        {p.name}
                      </div>
                    ))}
                    {groupParticipants.length > 5 && (
                      <div className="text-gray-400 mt-1">+{groupParticipants.length - 5} more</div>
                    )}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#050505]" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default GroupsPage
