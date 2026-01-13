import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { groupsAtom, participantsAtom, syncAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom } from '../stores/userStore'
import { createOrGetGroup, deleteGroup } from '../services/firebase'
import { writeAuditLog } from '../services/auditLog'
import type { Group } from '../types'
import { ViewMode, CapacityStatus } from '../types'
import {
  ViewModeToggle,
  Tooltip,
  StatusDot,
  getCapacityStatus,
  ImportCSVPanel
} from '../components'

function GroupsPage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const groups = useAtomValue(groupsAtom)
  const participants = useAtomValue(participantsAtom)
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const userName = useAtomValue(userNameAtom)
  const [isAdding, setIsAdding] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCapacity, setNewGroupCapacity] = useState('')
  const [newGroupTags, setNewGroupTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [csvInput, setCsvInput] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.List)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)

  const presetTags = ['male', 'female']

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const capacity = newGroupCapacity.trim() ? parseInt(newGroupCapacity.trim(), 10) : undefined
      const group = await createOrGetGroup({
        name: newGroupName.trim(),
        expectedCapacity: capacity,
        tags: newGroupTags.length > 0 ? newGroupTags : undefined
      })
      await writeAuditLog(userName || 'Unknown', 'create', 'group', group.id, group.name)
      addToast({ type: 'success', message: t('group.groupCreated', { name: group.name }) })
      setNewGroupName('')
      setNewGroupCapacity('')
      setNewGroupTags([])
      setCustomTagInput('')
      setIsAdding(false)
      sync()
    } catch {
      addToast({ type: 'error', message: t('toast.createFailed') })
    }
  }

  const togglePresetTag = (tag: string) => {
    setNewGroupTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase()
    if (tag && !newGroupTags.includes(tag)) {
      setNewGroupTags((prev) => [...prev, tag])
      setCustomTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setNewGroupTags((prev) => prev.filter((t) => t !== tag))
  }

  const getTagLabel = (tag: string) => {
    if (tag === 'male') return t('group.tagMale')
    if (tag === 'female') return t('group.tagFemale')
    return tag
  }

  const getTagColor = (tag: string) => {
    if (tag === 'male') return 'bg-blue-100 text-blue-700'
    if (tag === 'female') return 'bg-pink-100 text-pink-700'
    return 'bg-gray-100 text-gray-600'
  }

  const handleDeleteGroup = async (group: Group) => {
    if (!confirm(t('group.confirmDelete', { name: group.name }))) return
    try {
      await deleteGroup(group.id)
      await writeAuditLog(userName || 'Unknown', 'delete', 'group', group.id, group.name)
      addToast({ type: 'success', message: t('group.groupDeleted', { name: group.name }) })
      sync()
    } catch (error) {
      addToast({ type: 'error', message: t('toast.deleteFailed') })
    }
  }

  const parseTagsFromString = (tagString: string): string[] => {
    if (!tagString.trim()) return []
    return tagString
      .split(/[;|]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  }

  const handleImportCSV = async () => {
    if (!csvInput.trim()) return
    const lines = csvInput
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    let created = 0

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim())
      const name = parts[0]
      const tags = parts[1] ? parseTagsFromString(parts[1]) : undefined
      if (!name) continue
      try {
        const group = await createOrGetGroup({
          name,
          tags
        })
        await writeAuditLog(userName || 'Unknown', 'import', 'group', group.id, group.name)
        created++
      } catch {
        console.error(`Failed to create group: ${name}`)
      }
    }

    addToast({ type: 'success', message: t('group.importedCount', { count: created }) })
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
      const parts = line.split(',').map((p) => p.trim())
      const name = parts[0]
      const tags = parts[1] ? parseTagsFromString(parts[1]) : undefined
      if (!name) continue
      try {
        const group = await createOrGetGroup({
          name,
          tags
        })
        await writeAuditLog(userName || 'Unknown', 'import', 'group', group.id, group.name)
        created++
      } catch {
        console.error(`Failed to create group: ${name}`)
      }
    }

    addToast({ type: 'success', message: t('group.importedFromCSV', { count: created }) })
    sync()
  }

  const getGroupParticipants = (groupId: string) => {
    return participants.filter((p) => p.groupId === groupId)
  }

  const getStatusLabel = (status: CapacityStatus): string => {
    switch (status) {
      case CapacityStatus.Full:
        return t('room.full')
      case CapacityStatus.AlmostFull:
        return t('room.almostFull')
      case CapacityStatus.Available:
        return t('room.available')
      case CapacityStatus.NoLimit:
        return t('common.noLimit')
      default:
        return t('participant.unknown')
    }
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
          <h1 className="text-2xl font-bold text-[#050505]">{t('group.title')}</h1>
          <p className="text-[#65676B] mt-1">{t('group.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <button
            onClick={() => setIsImporting(!isImporting)}
            className="px-4 py-2 border border-[#DADDE1] text-[#65676B] rounded-lg text-sm font-semibold hover:bg-[#F0F2F5] transition-colors"
          >
            {t('nav.importCSV')}
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors"
          >
            {t('group.addGroup')}
          </button>
        </div>
      </div>

      {isImporting && (
        <ImportCSVPanel
          title={t('group.importGroups')}
          placeholder={t('group.importPlaceholder')}
          helpText={t('group.importHelpText')}
          csvInput={csvInput}
          onCsvInputChange={setCsvInput}
          onFileSelect={handleFileImport}
          onImport={handleImportCSV}
          onCancel={() => {
            setIsImporting(false)
            setCsvInput('')
          }}
        />
      )}

      {isAdding && (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-6">
          <h3 className="font-semibold text-[#050505] mb-3">{t('group.addNewGroup')}</h3>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('group.groupNamePlaceholder')}
                autoFocus
                className="flex-1 min-w-[150px] px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              />
              <input
                type="number"
                value={newGroupCapacity}
                onChange={(e) => setNewGroupCapacity(e.target.value)}
                placeholder={t('group.expectedOptional')}
                min={1}
                className="w-36 px-3 py-2 border border-[#DADDE1] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              />
            </div>

            {/* Tags Section */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#65676B] font-medium">{t('group.tags')}:</span>
              {presetTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => togglePresetTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    newGroupTags.includes(tag)
                      ? getTagColor(tag)
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {getTagLabel(tag)}
                </button>
              ))}
              <span className="text-[#DADDE1]">|</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  placeholder={t('group.addCustomTag')}
                  className="w-32 px-2 py-1 border border-[#DADDE1] rounded text-xs outline-none focus:ring-1 focus:ring-[#1877F2] focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomTag()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  disabled={!customTagInput.trim()}
                  className="px-2 py-1 bg-[#E7F3FF] text-[#1877F2] rounded text-xs font-semibold hover:bg-[#D4E8FF] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Selected Tags */}
            {newGroupTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {newGroupTags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getTagColor(tag)}`}
                  >
                    {getTagLabel(tag)}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:opacity-70"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewGroupName('')
                  setNewGroupCapacity('')
                  setNewGroupTags([])
                  setCustomTagInput('')
                }}
                className="px-4 py-2 text-[#65676B] text-sm font-semibold hover:bg-[#F0F2F5] rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddGroup}
                disabled={!newGroupName.trim()}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-12 text-center">
          <div className="text-[#65676B] text-lg">{t('group.noGroups')}</div>
          <p className="text-[#65676B] mt-2 text-sm">{t('group.noGroupsDesc')}</p>
        </div>
      ) : viewMode === ViewMode.List ? (
        <div className="bg-white rounded-lg border border-[#DADDE1] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F0F2F5] border-b border-[#DADDE1] rounded-t-lg">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold rounded-tl-lg">
                  {t('common.name')}
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  {t('group.tags')}
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  {t('common.members')}
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  {t('common.status')}
                </th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold rounded-tr-lg">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupParticipants = getGroupParticipants(group.id)
                const status = getCapacityStatus(group.participantCount, group.expectedCapacity)
                return (
                  <tr
                    key={group.id}
                    className="border-b border-[#DADDE1] last:border-b-0 hover:bg-[#F7F8FA] cursor-pointer relative"
                    onClick={() => navigate(`/groups/${group.id}`)}
                    onMouseEnter={() => setHoveredGroupId(group.id)}
                    onMouseLeave={() => setHoveredGroupId(null)}
                  >
                    <td className="px-4 py-3 font-medium text-[#050505] relative">
                      {group.name}
                      {hoveredGroupId === group.id && groupParticipants.length > 0 && (
                        <Tooltip
                          title={t('common.membersTitle')}
                          items={groupParticipants.map((p) => ({ id: p.id, name: p.name }))}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {group.tags?.map((tag) => (
                          <span
                            key={tag}
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTagColor(tag)}`}
                          >
                            {getTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#65676B]">
                      {formatCapacity(group.participantCount, group.expectedCapacity)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot status={status} />
                        <span className="text-sm text-[#65676B]">{getStatusLabel(status)}</span>
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
                        {t('common.delete')}
                      </button>
                    </td>
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
            const status = getCapacityStatus(group.participantCount, group.expectedCapacity)
            return (
              <div
                key={group.id}
                className="relative bg-white rounded-lg border border-[#DADDE1] p-4 hover:shadow-md hover:border-[#1877F2] transition-all cursor-pointer"
                onClick={() => navigate(`/groups/${group.id}`)}
                onMouseEnter={() => setHoveredGroupId(group.id)}
                onMouseLeave={() => setHoveredGroupId(null)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-[#050505] text-lg">{group.name}</h3>
                    <p className="text-sm text-[#65676B]">
                      {formatCapacity(group.participantCount, group.expectedCapacity)}{' '}
                      {t('common.members')}
                    </p>
                  </div>
                  <StatusDot status={status} size="md" />
                </div>

                {/* Tags */}
                {group.tags && group.tags.length > 0 && (
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {group.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}
                      >
                        {getTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-[#F0F2F5] text-[#65676B]">
                    {group.expectedCapacity
                      ? `${group.participantCount} / ${group.expectedCapacity}`
                      : `${group.participantCount} ${t('common.members')}`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group)
                    }}
                    className="text-[#FA383E] hover:underline text-xs font-semibold"
                  >
                    {t('common.delete')}
                  </button>
                </div>

                {hoveredGroupId === group.id && groupParticipants.length > 0 && (
                  <Tooltip
                    title={t('common.membersTitle')}
                    items={groupParticipants.map((p) => ({ id: p.id, name: p.name }))}
                    position="top"
                  />
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
