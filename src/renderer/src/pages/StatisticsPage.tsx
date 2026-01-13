import React, { useMemo, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { participantsAtom, groupsAtom, roomsAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
)

function StatisticsPage(): React.ReactElement {
  const participants = useAtomValue(participantsAtom)
  const groups = useAtomValue(groupsAtom)
  const rooms = useAtomValue(roomsAtom)
  const addToast = useSetAtom(addToastAtom)
  const reportRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Calculate statistics
  const stats = useMemo(() => {
    const total = participants.length
    const checkedIn = participants.filter((p) => p.checkIns.some((ci) => !ci.checkOutTime)).length
    const notCheckedIn = total - checkedIn

    // Gender breakdown
    const male = participants.filter((p) => p.gender?.toLowerCase() === 'male')
    const female = participants.filter((p) => p.gender?.toLowerCase() === 'female')
    const otherGender = participants.filter(
      (p) => p.gender && !['male', 'female'].includes(p.gender.toLowerCase())
    )
    const unknownGender = participants.filter((p) => !p.gender)

    const maleCheckedIn = male.filter((p) => p.checkIns.some((ci) => !ci.checkOutTime)).length
    const femaleCheckedIn = female.filter((p) => p.checkIns.some((ci) => !ci.checkOutTime)).length

    // Payment status
    const paid = participants.filter((p) => p.isPaid).length
    const unpaid = total - paid

    // Room occupancy
    const totalRoomCapacity = rooms.reduce((sum, r) => sum + r.maxCapacity, 0)
    const currentOccupancy = rooms.reduce((sum, r) => sum + r.currentOccupancy, 0)

    // Daily check-in stats (last 7 days)
    const dailyStats: { date: string; checkIns: number; checkOuts: number }[] = []
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      let checkIns = 0
      let checkOuts = 0

      participants.forEach((p) => {
        p.checkIns.forEach((ci) => {
          const checkInTime = new Date(ci.checkInTime)
          if (checkInTime >= startOfDay && checkInTime <= endOfDay) {
            checkIns++
          }
          if (ci.checkOutTime) {
            const checkOutTime = new Date(ci.checkOutTime)
            if (checkOutTime >= startOfDay && checkOutTime <= endOfDay) {
              checkOuts++
            }
          }
        })
      })

      dailyStats.push({
        date: new Intl.DateTimeFormat('ko-KR', {
          month: 'short',
          day: 'numeric'
        }).format(date),
        checkIns,
        checkOuts
      })
    }

    // Group stats - top 5 by participant count
    const topGroups = [...groups]
      .sort((a, b) => b.participantCount - a.participantCount)
      .slice(0, 5)

    return {
      total,
      checkedIn,
      notCheckedIn,
      checkInRate: total > 0 ? ((checkedIn / total) * 100).toFixed(1) : '0',
      male: male.length,
      female: female.length,
      otherGender: otherGender.length,
      unknownGender: unknownGender.length,
      maleCheckedIn,
      femaleCheckedIn,
      paid,
      unpaid,
      totalRoomCapacity,
      currentOccupancy,
      roomOccupancyRate:
        totalRoomCapacity > 0 ? ((currentOccupancy / totalRoomCapacity) * 100).toFixed(1) : '0',
      dailyStats,
      topGroups,
      totalGroups: groups.length,
      totalRooms: rooms.length
    }
  }, [participants, groups, rooms])

  // Chart configurations
  const checkInStatusData = {
    labels: ['Checked In', 'Not Checked In'],
    datasets: [
      {
        data: [stats.checkedIn, stats.notCheckedIn],
        backgroundColor: ['#31A24C', '#E4E6EB'],
        borderColor: ['#31A24C', '#DADDE1'],
        borderWidth: 1
      }
    ]
  }

  const genderDistributionData = {
    labels: ['Male', 'Female', 'Other', 'Unknown'],
    datasets: [
      {
        label: 'Registered',
        data: [stats.male, stats.female, stats.otherGender, stats.unknownGender],
        backgroundColor: ['#1877F2', '#F0284A', '#FFA500', '#DADDE1']
      }
    ]
  }

  const genderCheckInData = {
    labels: ['Male', 'Female'],
    datasets: [
      {
        label: 'Registered',
        data: [stats.male, stats.female],
        backgroundColor: 'rgba(24, 119, 242, 0.5)',
        borderColor: '#1877F2',
        borderWidth: 1
      },
      {
        label: 'Checked In',
        data: [stats.maleCheckedIn, stats.femaleCheckedIn],
        backgroundColor: 'rgba(49, 162, 76, 0.7)',
        borderColor: '#31A24C',
        borderWidth: 1
      }
    ]
  }

  const dailyCheckInData = {
    labels: stats.dailyStats.map((d) => d.date),
    datasets: [
      {
        label: 'Check-ins',
        data: stats.dailyStats.map((d) => d.checkIns),
        borderColor: '#1877F2',
        backgroundColor: 'rgba(24, 119, 242, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Check-outs',
        data: stats.dailyStats.map((d) => d.checkOuts),
        borderColor: '#FA383E',
        backgroundColor: 'rgba(250, 56, 62, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  }

  const paymentStatusData = {
    labels: ['Paid', 'Unpaid'],
    datasets: [
      {
        data: [stats.paid, stats.unpaid],
        backgroundColor: ['#31A24C', '#FA383E'],
        borderColor: ['#2B8A3E', '#D32F2F'],
        borderWidth: 1
      }
    ]
  }

  const topGroupsData = {
    labels: stats.topGroups.map((g) => g.name),
    datasets: [
      {
        label: 'Participants',
        data: stats.topGroups.map((g) => g.participantCount),
        backgroundColor: 'rgba(24, 119, 242, 0.7)',
        borderColor: '#1877F2',
        borderWidth: 1
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const
      }
    }
  }

  const barOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  }

  const handleExportPDF = async (): Promise<void> => {
    if (!reportRef.current || isExporting) return

    setIsExporting(true)
    try {
      const element = reportRef.current

      // Use html2canvas to capture the element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F0F2F5',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      })

      const imgData = canvas.toDataURL('image/png')

      // A4 dimensions in mm
      const pdfWidth = 210
      const pdfHeight = 297
      const margin = 10

      // Calculate dimensions to fit width
      const contentWidth = pdfWidth - margin * 2
      const imgAspectRatio = canvas.height / canvas.width
      const contentHeight = contentWidth * imgAspectRatio

      // Determine if we need multiple pages
      const maxHeightPerPage = pdfHeight - margin * 2
      const totalPages = Math.ceil(contentHeight / maxHeightPerPage)

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      if (totalPages === 1) {
        // Single page - image fits on one page
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight)
      } else {
        // Multi-page - split the image across pages
        const pageCanvas = document.createElement('canvas')
        const pageCtx = pageCanvas.getContext('2d')
        if (!pageCtx) throw new Error('Could not get canvas context')

        // Height of source image per PDF page
        const sourceHeightPerPage = canvas.height / totalPages

        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage()

          // Create a canvas for this page's portion
          pageCanvas.width = canvas.width
          pageCanvas.height = Math.min(sourceHeightPerPage, canvas.height - i * sourceHeightPerPage)

          // Draw the portion of the original canvas
          pageCtx.fillStyle = '#F0F2F5'
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
          pageCtx.drawImage(
            canvas,
            0,
            i * sourceHeightPerPage,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height
          )

          const pageImgData = pageCanvas.toDataURL('image/png')
          const pageContentHeight = (pageCanvas.height / canvas.width) * contentWidth

          pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageContentHeight)
        }
      }

      // Generate filename with date
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const filename = `CheckIn_Statistics_${dateStr}.pdf`

      pdf.save(filename)
      addToast({ type: 'success', message: 'Statistics exported to PDF successfully' })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      addToast({ type: 'error', message: 'Failed to export PDF' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#050505]">Statistics</h1>
          <p className="text-[#65676B] mt-1">Overview of registration and check-in data</p>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isExporting
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export PDF
            </>
          )}
        </button>
      </div>

      <div ref={reportRef}>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <div className="text-sm text-[#65676B] font-medium">Total Registered</div>
            <div className="text-3xl font-bold text-[#050505] mt-1">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <div className="text-sm text-[#65676B] font-medium">Currently Checked In</div>
            <div className="text-3xl font-bold text-[#31A24C] mt-1">{stats.checkedIn}</div>
            <div className="text-xs text-[#65676B] mt-1">{stats.checkInRate}% of total</div>
          </div>
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <div className="text-sm text-[#65676B] font-medium">Room Occupancy</div>
            <div className="text-3xl font-bold text-[#1877F2] mt-1">
              {stats.currentOccupancy}/{stats.totalRoomCapacity}
            </div>
            <div className="text-xs text-[#65676B] mt-1">{stats.roomOccupancyRate}% occupied</div>
          </div>
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <div className="text-sm text-[#65676B] font-medium">Payment Status</div>
            <div className="text-3xl font-bold text-[#050505] mt-1">
              <span className="text-[#31A24C]">{stats.paid}</span>
              <span className="text-[#65676B] text-lg mx-1">/</span>
              <span className="text-[#FA383E]">{stats.unpaid}</span>
            </div>
            <div className="text-xs text-[#65676B] mt-1">Paid / Unpaid</div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Check-in Status */}
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <h3 className="text-sm font-semibold text-[#050505] mb-4">Check-in Status</h3>
            <div className="h-48">
              <Doughnut data={checkInStatusData} options={chartOptions} />
            </div>
          </div>

          {/* Gender Distribution */}
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <h3 className="text-sm font-semibold text-[#050505] mb-4">Gender Distribution</h3>
            <div className="h-48">
              <Doughnut data={genderDistributionData} options={chartOptions} />
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <h3 className="text-sm font-semibold text-[#050505] mb-4">Payment Status</h3>
            <div className="h-48">
              <Doughnut data={paymentStatusData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Gender Check-in Comparison */}
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <h3 className="text-sm font-semibold text-[#050505] mb-4">
              Registration vs Check-in by Gender
            </h3>
            <div className="h-64">
              <Bar data={genderCheckInData} options={barOptions} />
            </div>
          </div>

          {/* Top Groups */}
          <div className="bg-white rounded-lg border border-[#DADDE1] p-4">
            <h3 className="text-sm font-semibold text-[#050505] mb-4">
              Top 5 Groups by Participants
            </h3>
            <div className="h-64">
              {stats.topGroups.length > 0 ? (
                <Bar data={topGroupsData} options={barOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-[#65676B]">
                  No group data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Check-in/Check-out */}
        <div className="bg-white rounded-lg border border-[#DADDE1] p-4 mb-4">
          <h3 className="text-sm font-semibold text-[#050505] mb-4">
            Daily Check-in / Check-out (Last 7 Days)
          </h3>
          <div className="h-72">
            <Line data={dailyCheckInData} options={barOptions} />
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-lg border border-[#DADDE1] overflow-hidden">
          <div className="px-4 py-3 bg-[#F0F2F5] border-b border-[#DADDE1]">
            <h3 className="text-sm font-semibold text-[#050505]">Detailed Statistics</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F7F8FA] border-b border-[#DADDE1]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#65676B] uppercase">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#65676B] uppercase">
                    Registered
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#65676B] uppercase">
                    Checked In
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#65676B] uppercase">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#DADDE1]">
                  <td className="px-4 py-3 font-medium text-[#050505]">Total</td>
                  <td className="px-4 py-3 text-right text-[#050505]">{stats.total}</td>
                  <td className="px-4 py-3 text-right text-[#31A24C] font-semibold">
                    {stats.checkedIn}
                  </td>
                  <td className="px-4 py-3 text-right text-[#65676B]">{stats.checkInRate}%</td>
                </tr>
                <tr className="border-b border-[#DADDE1] bg-[#F7F8FA]">
                  <td className="px-4 py-3 font-medium text-[#050505]">Male</td>
                  <td className="px-4 py-3 text-right text-[#050505]">{stats.male}</td>
                  <td className="px-4 py-3 text-right text-[#31A24C] font-semibold">
                    {stats.maleCheckedIn}
                  </td>
                  <td className="px-4 py-3 text-right text-[#65676B]">
                    {stats.male > 0 ? ((stats.maleCheckedIn / stats.male) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
                <tr className="border-b border-[#DADDE1]">
                  <td className="px-4 py-3 font-medium text-[#050505]">Female</td>
                  <td className="px-4 py-3 text-right text-[#050505]">{stats.female}</td>
                  <td className="px-4 py-3 text-right text-[#31A24C] font-semibold">
                    {stats.femaleCheckedIn}
                  </td>
                  <td className="px-4 py-3 text-right text-[#65676B]">
                    {stats.female > 0
                      ? ((stats.femaleCheckedIn / stats.female) * 100).toFixed(1)
                      : '0'}
                    %
                  </td>
                </tr>
                <tr className="border-b border-[#DADDE1] bg-[#F7F8FA]">
                  <td className="px-4 py-3 font-medium text-[#050505]">Groups</td>
                  <td className="px-4 py-3 text-right text-[#050505]" colSpan={3}>
                    {stats.totalGroups} groups
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-[#050505]">Rooms</td>
                  <td className="px-4 py-3 text-right text-[#050505]" colSpan={3}>
                    {stats.totalRooms} rooms ({stats.currentOccupancy}/{stats.totalRoomCapacity}{' '}
                    occupied)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatisticsPage
