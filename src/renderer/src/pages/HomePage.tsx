import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchParticipants } from '../services/firebase'
import type { Participant } from '../types'
import { SearchResultsSkeleton } from '../components'

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
        <h1 className="text-3xl font-bold text-[#050505] mb-2 tracking-tight">
          Participant Check-In
        </h1>
        <p className="text-[#65676B]">Search by name, email, or phone number</p>
      </div>

      <div className="relative">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            className="w-full px-5 py-3 text-lg border-none rounded-full outline-none transition-all shadow-sm bg-white focus:ring-2 focus:ring-[#1877F2]"
            placeholder="Start typing to search..."
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#65676B]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
        </div>

        {showResults && (searchTerm.trim() || isLoading) && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-lg mt-2 max-h-96 overflow-y-auto z-50 border border-[#DADDE1]"
          >
            {isLoading ? (
              <SearchResultsSkeleton count={3} />
            ) : results.length > 0 ? (
              results.map((participant, index) => (
                <div
                  key={participant.id}
                  className={`px-4 py-3 cursor-pointer border-b border-[#F0F2F5] last:border-b-0 transition-colors ${
                    index === selectedIndex ? 'bg-[#F0F2F5]' : 'hover:bg-[#F0F2F5]'
                  }`}
                  onClick={() => handleResultClick(participant)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="font-semibold text-[#050505]">{participant.name}</div>
                  <div className="text-sm text-[#65676B] mt-1">
                    {participant.email} {participant.phoneNumber && `| ${participant.phoneNumber}`}
                  </div>
                  <div className="text-sm text-[#65676B]">
                    {participant.ward && `${participant.ward}`}
                    {participant.stake && `, ${participant.stake}`}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-4">
                <div className="text-[#65676B] text-center">No participants found</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
