export * from './enums'

export type Gender = 'male' | 'female' | 'other' | string

export type CheckInFilter = 'all' | 'checked-in' | 'not-checked-in'

export type TabType = 'participants' | 'groups' | 'rooms'

export type SortField = 'name' | 'ward' | 'group' | 'room' | 'status' | 'payment'
export type SortDirection = 'asc' | 'desc'

export interface Participant {
  id: string
  name: string
  gender: Gender
  age: number
  stake: string
  ward: string
  phoneNumber: string
  email: string
  isPaid: boolean
  memo?: string
  metadata?: Record<string, unknown>
  groupId?: string
  groupName?: string
  roomId?: string
  roomNumber?: string
  checkIns: CheckInRecord[]
  createdAt: Date
  updatedAt: Date
}

export interface CheckInRecord {
  id: string
  checkInTime: Date
  checkOutTime?: Date
}

export type GroupTagPreset = 'male' | 'female'

export interface Group {
  id: string
  name: string
  participantCount: number
  expectedCapacity?: number
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

export type RoomGenderType = 'male' | 'female' | 'mixed'
export type RoomType = 'general' | 'guest' | 'leadership'

export interface Room {
  id: string
  roomNumber: string
  maxCapacity: number
  currentOccupancy: number
  genderType?: RoomGenderType
  roomType?: RoomType
  createdAt: Date
  updatedAt: Date
}

export interface CSVParticipantRow {
  name: string
  gender: string
  age: string
  stake: string
  ward: string
  phoneNumber: string
  email: string
  groupName?: string
  roomNumber?: string
  [key: string]: string | undefined
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  userName: string
  action: 'create' | 'update' | 'delete' | 'check_in' | 'check_out' | 'assign' | 'import'
  targetType: 'participant' | 'group' | 'room'
  targetId: string
  targetName: string
  changes?: Record<string, { from: unknown; to: unknown }>
}
