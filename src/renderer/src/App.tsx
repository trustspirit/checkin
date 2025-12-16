import { Routes, Route, NavLink } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ParticipantDetailPage from './pages/ParticipantDetailPage'
import ParticipantsListPage from './pages/ParticipantsListPage'
import ImportPage from './pages/ImportPage'

function App(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center gap-8 shadow-sm">
        <NavLink to="/" className="text-xl font-bold text-blue-600">
          Check-In
        </NavLink>
        <div className="flex gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-4 py-2 rounded-md font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-600 hover:text-white'
              }`
            }
          >
            Search
          </NavLink>
          <NavLink
            to="/participants"
            className={({ isActive }) =>
              `px-4 py-2 rounded-md font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-600 hover:text-white'
              }`
            }
          >
            All Participants
          </NavLink>
          <NavLink
            to="/import"
            className={({ isActive }) =>
              `px-4 py-2 rounded-md font-medium transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-600 hover:text-white'
              }`
            }
          >
            Import CSV
          </NavLink>
        </div>
      </nav>
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/participant/:id" element={<ParticipantDetailPage />} />
          <Route path="/participants" element={<ParticipantsListPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
