'use client';

import { useState, useEffect, useMemo } from 'react';
import { Course, TimetableSession, Clash } from '@/lib/types';

interface OptimalResult {
  success: boolean;
  schedule: TimetableSession[];
  assignments: { [courseName: string]: string };
  clashes: Clash[];
  clashMessages: string[];
  availableSections: { [courseName: string]: string[] };
  message: string;
}

export default function OptimalSchedulePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedCourseNames, setSelectedCourseNames] = useState<string[]>([]);
  const [excludedAssignments, setExcludedAssignments] = useState<{ [courseName: string]: string[] }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [result, setResult] = useState<OptimalResult | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Monday');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Fetch courses on mount
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/courses');
      if (!response.ok) throw new Error('Failed to fetch courses');
      const data = await response.json();
      setCourses(data.courses);
      setBatches(data.batches);
    } catch (err) {
      setError('Failed to load courses. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique course names for selected batch
  const availableCourseNames = useMemo(() => {
    if (!selectedBatch) return [];
    const batchCourses = courses.filter(c => c.batch === selectedBatch);
    const names = Array.from(new Set(batchCourses.map(c => c.name)));
    return names.filter(n => !n.toLowerCase().includes('cancelled')).sort();
  }, [courses, selectedBatch]);

  // Filter course names based on search
  const filteredCourseNames = useMemo(() => {
    if (!searchQuery) return availableCourseNames;
    const query = searchQuery.toLowerCase();
    return availableCourseNames.filter(name => name.toLowerCase().includes(query));
  }, [availableCourseNames, searchQuery]);

  // Toggle course selection
  const toggleCourseName = (name: string) => {
    const isSelected = selectedCourseNames.includes(name);
    if (isSelected) {
      setSelectedCourseNames(prev => prev.filter(n => n !== name));
      // Remove exclusions for this course
      const newExcluded = { ...excludedAssignments };
      delete newExcluded[name];
      setExcludedAssignments(newExcluded);
    } else {
      setSelectedCourseNames(prev => [...prev, name]);
    }
    setShowSchedule(false);
  };

  // Remove selected course
  const removeCourseName = (name: string) => {
    setSelectedCourseNames(prev => prev.filter(n => n !== name));
    const newExcluded = { ...excludedAssignments };
    delete newExcluded[name];
    setExcludedAssignments(newExcluded);
    setShowSchedule(false);
  };

  // Toggle section exclusion
  const toggleSectionExclusion = (courseName: string, section: string) => {
    const currentExcluded = excludedAssignments[courseName] || [];
    const isExcluded = currentExcluded.includes(section);
    
    if (isExcluded) {
      setExcludedAssignments(prev => ({
        ...prev,
        [courseName]: prev[courseName].filter(s => s !== section),
      }));
    } else {
      setExcludedAssignments(prev => ({
        ...prev,
        [courseName]: [...(prev[courseName] || []), section],
      }));
    }
  };

  // Find optimal schedule
  const findSchedule = async () => {
    if (!selectedBatch) {
      setError('Please select a batch');
      return;
    }
    if (selectedCourseNames.length === 0) {
      setError('Please select at least one course');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch('/api/optimal-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: selectedBatch,
          selectedCourseNames,
          excludedAssignments,
        }),
      });

      if (!response.ok) throw new Error('Failed to find optimal schedule');

      const data = await response.json();
      setResult(data);
      setShowSchedule(true);
    } catch (err) {
      setError('Failed to find optimal schedule. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate with exclusions
  const regenerateSchedule = async () => {
    await findSchedule();
  };

  // Get sessions for selected day
  const sessionsForDay = useMemo(() => {
    if (!result) return [];
    return result.schedule
      .filter(s => s.day === selectedDay)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, [result, selectedDay]);

  // Handle batch change
  const handleBatchChange = (batch: string) => {
    setSelectedBatch(batch);
    setSelectedCourseNames([]);
    setExcludedAssignments({});
    setShowSchedule(false);
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Optimal Schedule Finder</h1>
        <p className="text-slate-600">
          Select your batch and courses, and we'll find the best section combination.
        </p>
      </div>

      {/* Batch & Course Selection */}
      {!showSchedule && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          {/* Batch Selection */}
          <div className="mb-6">
            <label className="block font-semibold text-slate-800 mb-2">
              Select Your Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
              disabled={isLoading}
            >
              <option value="">
                {isLoading ? 'Loading batches...' : 'Select a batch'}
              </option>
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>

          {/* Course Selection (only show after batch is selected) */}
          {selectedBatch && (
            <>
              <h2 className="font-semibold text-slate-800 mb-4">Select Courses</h2>
              
              {/* Search Input */}
              <div className="relative course-dropdown mb-4">
                <input
                  type="text"
                  placeholder="Search courses..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                />

                {/* Dropdown - Only course names, no batch/department */}
                {isDropdownOpen && (
                  <div className="course-dropdown-menu">
                    {filteredCourseNames.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        No courses found
                      </div>
                    ) : (
                      filteredCourseNames.map(name => {
                        const isSelected = selectedCourseNames.includes(name);
                        return (
                          <div
                            key={name}
                            className={`course-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleCourseName(name)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-800">{name}</span>
                              {isSelected && (
                                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Click outside to close dropdown */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDropdownOpen(false)}
                ></div>
              )}

              {/* Selected Courses */}
              {selectedCourseNames.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-slate-600 mb-2">
                    Selected: {selectedCourseNames.length} course(s)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCourseNames.map(name => (
                      <div
                        key={name}
                        className="chip bg-purple-100 text-purple-800 cursor-pointer hover:bg-purple-200"
                        onClick={() => removeCourseName(name)}
                      >
                        {name}
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 clash-alert">
              {error}
            </div>
          )}

          {/* Find Optimal Schedule Button */}
          <button
            onClick={findSchedule}
            disabled={!selectedBatch || selectedCourseNames.length === 0 || isGenerating}
            className="mt-6 w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="spinner border-white border-t-transparent"></div>
                Finding Optimal Schedule...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Find Optimal Schedule
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {showSchedule && result && (
        <div>
          {/* Back Button */}
          <button
            onClick={() => setShowSchedule(false)}
            className="mb-4 text-slate-600 hover:text-slate-800 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Selection
          </button>

          {/* Result Message */}
          {result.success ? (
            <div className="success-alert mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-800">{result.message}</h3>
                </div>
              </div>
            </div>
          ) : (
            <div className="clash-alert mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-800 mb-2">{result.message}</h3>
                  {result.clashMessages.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {result.clashMessages.map((msg, idx) => (
                        <li key={idx}>• {msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section Assignments */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="font-semibold text-slate-800 mb-4">Section Assignments</h3>
            <div className="space-y-4">
              {Object.entries(result.assignments).map(([courseName, section]) => (
                <div key={courseName} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-800 mb-2 sm:mb-0">{courseName}</div>
                  <div className="flex flex-wrap gap-2">
                    {result.availableSections[courseName]?.map(sec => {
                      const isAssigned = sec === section;
                      const isExcluded = excludedAssignments[courseName]?.includes(sec);
                      
                      return (
                        <button
                          key={sec}
                          onClick={() => toggleSectionExclusion(courseName, sec)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            isExcluded
                              ? 'bg-red-100 text-red-600 line-through hover:bg-red-200'
                              : isAssigned
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title={isExcluded ? 'Click to include this section' : 'Click to exclude this section'}
                        >
                          Section {sec}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Regenerate Button */}
            <button
              onClick={regenerateSchedule}
              disabled={isGenerating}
              className="mt-4 w-full bg-slate-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="spinner border-white border-t-transparent"></div>
                  Regenerating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate with Exclusions
                </>
              )}
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Click on sections to exclude them, then regenerate to find a new schedule.
            </p>
          </div>

          {/* Timetable */}
          {result.schedule.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <h3 className="font-semibold text-slate-800 p-4 border-b border-slate-200">
                Your Timetable
              </h3>
              
              {/* Day Tabs */}
              <div className="flex overflow-x-auto border-b border-slate-200">
                {days.map(day => (
                  <button
                    key={day}
                    className={`day-tab ${selectedDay === day ? 'active' : ''}`}
                    onClick={() => setSelectedDay(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Sessions for Day */}
              <div className="p-4">
                {sessionsForDay.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    No classes on {selectedDay}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessionsForDay.map(session => (
                      <div
                        key={session.id}
                        className={`timetable-card ${session.sessionType.toLowerCase()}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-slate-800">{session.courseName}</h3>
                            <p className="text-sm text-slate-600">
                              Section {session.section}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            session.sessionType === 'Lab'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {session.sessionType}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {session.timeSlot}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {session.room}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
