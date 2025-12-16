import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchParticipants } from '../services/firebase'
import type { Participant } from '../types'

function HomePage(): React.ReactElement {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<Participant[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showResults, setShowResults] = useState(false)
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const searchResults = await searchParticipants(term)
      setResults(searchResults)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch(searchTerm)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchTerm, performSearch])

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          navigate(`/participant/${results[selectedIndex].id}`)
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleResultClick = (participant: Participant) => {
    navigate(`/participant/${participant.id}`)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setShowResults(true)
  }

  const handleInputFocus = () => {
    if (searchTerm.trim()) {
      setShowResults(true)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="max-w-xl mx-auto pt-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Participant Check-In</h1>
        <p className="text-slate-500">Search by name, email, or phone number</p>
      </div>

      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          className="w-full px-5 py-4 text-lg border-2 border-slate-200 rounded-xl outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          placeholder="Start typing to search..."
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
        />

        {showResults && (searchTerm.trim() || isLoading) && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-2 max-h-96 overflow-y-auto z-50"
          >
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            ) : results.length > 0 ? (
              results.map((participant, index) => (
                <div
                  key={participant.id}
                  className={`px-5 py-4 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${
                    index === selectedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => handleResultClick(participant)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="font-semibold text-slate-800">{participant.name}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {participant.email} {participant.phoneNumber && `| ${participant.phoneNumber}`}
                  </div>
                  <div className="text-sm text-slate-500">
                    {participant.ward && `${participant.ward}`}
                    {participant.stake && `, ${participant.stake}`}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-4">
                <div className="text-slate-500">No participants found</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
