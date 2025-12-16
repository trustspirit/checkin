import React, { useState } from 'react'
import Papa from 'papaparse'
import { importParticipantsFromCSV } from '../services/firebase'
import type { CSVParticipantRow } from '../types'

function ImportPage(): React.ReactElement {
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CSVParticipantRow[]>([])

  const handleFileSelect = async () => {
    try {
      const content = await window.electronAPI.openFileDialog()
      if (!content) return

      setError(null)
      setResult(null)

      Papa.parse<CSVParticipantRow>(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`)
            return
          }

          // Map common column name variations
          const mappedData = results.data.map((row) => {
            const mapped: CSVParticipantRow = {
              name: row.name || row.Name || row.NAME || '',
              gender: row.gender || row.Gender || row.GENDER || '',
              age: row.age || row.Age || row.AGE || '',
              stake: row.stake || row.Stake || row.STAKE || '',
              ward: row.ward || row.Ward || row.WARD || '',
              phoneNumber:
                row.phoneNumber || row.phone_number || row.phone || row.Phone || row.PHONE || '',
              email: row.email || row.Email || row.EMAIL || '',
              groupName:
                row.groupName || row.group_name || row.group || row.Group || row.GROUP || '',
              roomNumber:
                row.roomNumber || row.room_number || row.room || row.Room || row.ROOM || ''
            }

            // Collect any additional metadata
            const knownKeys = [
              'name',
              'Name',
              'NAME',
              'gender',
              'Gender',
              'GENDER',
              'age',
              'Age',
              'AGE',
              'stake',
              'Stake',
              'STAKE',
              'ward',
              'Ward',
              'WARD',
              'phoneNumber',
              'phone_number',
              'phone',
              'Phone',
              'PHONE',
              'email',
              'Email',
              'EMAIL',
              'groupName',
              'group_name',
              'group',
              'Group',
              'GROUP',
              'roomNumber',
              'room_number',
              'room',
              'Room',
              'ROOM'
            ]
            Object.keys(row).forEach((key) => {
              if (!knownKeys.includes(key) && row[key]) {
                mapped[key] = row[key]
              }
            })

            return mapped
          })

          setPreview(mappedData.slice(0, 5))

          // Show preview, don't auto-import
          setPreview(mappedData)
        }
      })
    } catch (err) {
      setError('Failed to read file')
      console.error(err)
    }
  }

  const handleImport = async () => {
    if (preview.length === 0) return

    setIsImporting(true)
    setError(null)

    try {
      const importResult = await importParticipantsFromCSV(preview)
      setResult(importResult)
      setPreview([])
    } catch (err) {
      setError('Import failed. Please check your Firebase configuration.')
      console.error(err)
    } finally {
      setIsImporting(false)
    }
  }

  const handleClearPreview = () => {
    setPreview([])
    setError(null)
    setResult(null)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Import Participants</h1>
        <p className="text-slate-500">Import participants from a CSV file</p>
      </div>

      {/* Import Zone */}
      {preview.length === 0 && (
        <div
          onClick={handleFileSelect}
          className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer transition-all hover:border-blue-500 hover:bg-slate-50"
        >
          <div className="text-5xl mb-4">📄</div>
          <p className="text-lg font-medium text-slate-700 mb-2">Click to select a CSV file</p>
          <p className="text-slate-500 text-sm">
            Required columns: name, email
            <br />
            Optional: gender, age, stake, ward, phoneNumber, groupName, roomNumber
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Success Message */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <p className="font-medium">Import completed successfully!</p>
          <p className="mt-1">
            Created: {result.created} participants | Updated: {result.updated} participants
          </p>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Preview</h2>
              <p className="text-slate-500 text-sm">{preview.length} records ready to import</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClearPreview}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Import All'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                      Ward
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                      Group
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">
                      Room
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-500 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.email}</td>
                      <td className="px-4 py-3 text-slate-600">{row.phoneNumber || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.ward || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.groupName || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.roomNumber || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <div className="px-4 py-3 bg-slate-50 text-sm text-slate-500 text-center">
                  ...and {preview.length - 10} more records
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-slate-50 rounded-lg p-6">
        <h3 className="font-semibold text-slate-800 mb-3">CSV Format Guidelines</h3>
        <div className="text-sm text-slate-600 space-y-2">
          <p>
            <strong>Required columns:</strong> name, email
          </p>
          <p>
            <strong>Optional columns:</strong> gender, age, stake, ward, phoneNumber (or phone),
            groupName (or group), roomNumber (or room)
          </p>
          <p>
            <strong>Metadata:</strong> Any additional columns will be stored as metadata
          </p>
          <p>
            <strong>Updates:</strong> Existing participants (matched by email) will be updated
          </p>
        </div>

        <div className="mt-4">
          <h4 className="font-medium text-slate-800 mb-2">Example CSV:</h4>
          <pre className="bg-white p-3 rounded border border-slate-200 text-xs overflow-x-auto">
            {`name,email,phone,gender,age,ward,stake,group,room
John Doe,john@example.com,555-1234,male,25,Ward 1,Stake A,Group Alpha,101
Jane Smith,jane@example.com,555-5678,female,30,Ward 2,Stake A,Group Beta,102`}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default ImportPage
