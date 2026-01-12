export interface Participant {
  id: string
  name: string
  gender: 'male' | 'female' | 'other' | string
  age: number
  stake: string
  ward: string
  phoneNumber: string
  email: string
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

export interface Group {
  id: string
  name: string
  participantCount: number
  expectedCapacity?: number
  createdAt: Date
  updatedAt: Date
}

export interface Room {
  id: string
  roomNumber: string
  maxCapacity: number
  currentOccupancy: number
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
