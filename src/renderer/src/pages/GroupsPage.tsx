import React, { useState, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { groupsAtom, syncAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { createOrGetGroup, deleteGroup } from '../services/firebase'
import { writeAuditLog } from '../services/auditLog'
import type { Group } from '../types'

function GroupsPage(): React.ReactElement {
  const groups = useAtomValue(groupsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)
  const [isAdding, setIsAdding] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [csvInput, setCsvInput] = useState('')

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const group = await createOrGetGroup(newGroupName.trim())
      await writeAuditLog(userName || 'Unknown', 'create', 'group', group.id, group.name)
      addToast({ type: 'success', message: `Group "${group.name}" created` })
      setNewGroupName('')
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#050505]">Groups</h1>
          <p className="text-[#65676B] mt-1">Manage participant groups</p>
        </div>
        <div className="flex gap-2">
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
            <button
              onClick={() => {
                setIsAdding(false)
                setNewGroupName('')
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

      <div className="bg-white rounded-lg border border-[#DADDE1] overflow-hidden">
        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-[#65676B] text-lg">No groups yet</div>
            <p className="text-[#65676B] mt-2 text-sm">Add groups to organize participants</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F0F2F5] border-b border-[#DADDE1]">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Members
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.id}
                  className="border-b border-[#DADDE1] last:border-b-0 hover:bg-[#F7F8FA]"
                >
                  <td className="px-4 py-3 font-medium text-[#050505]">{group.name}</td>
                  <td className="px-4 py-3 text-[#65676B]">
                    {group.participantCount} participants
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteGroup(group)}
                      className="text-[#FA383E] hover:underline text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default GroupsPage
