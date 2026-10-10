'use client';

import { useState, useEffect, useMemo } from 'react';
import { Course, TimetableSession, Clash } from '@/lib/types';

export default function ClashDetectorPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timetable results
  const [sessions, setSessions] = useState<TimetableSession[]>([]);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [clashMessages, setClashMessages] = useState<string[]>([]);
  const [showTimetable, setShowTimetable] = useState(false);
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.details || errorData?.error || 'Failed to fetch courses');
      }
      const data = await response.json();
      setCourses(data.courses || []);
      setBatches(data.batches || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load courses. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter courses based on batch and search
  const filteredCourses = useMemo(() => {
    let list = courses;
    if (selectedBatch !== 'all') {
      list = list.filter(c => c.batch === selectedBatch);
    }
    if (!searchQuery) return list;
    const query = searchQuery.toLowerCase().trim();
    return list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.department.toLowerCase().includes(query) ||
      c.batch.toLowerCase().includes(query) ||
      c.section.toLowerCase().includes(query)
    );
  }, [courses, selectedBatch, searchQuery]);

  // Toggle course selection
  const toggleCourse = (course: Course) => {
    const isSelected = selectedCourses.some(c => c.id === course.id);
    if (isSelected) {
      setSelectedCourses(prev => prev.filter(c => c.id !== course.id));
    } else {
      setSelectedCourses(prev => [...prev, course]);
    }
    setShowTimetable(false);
  };

  // Remove selected course
  const removeCourse = (courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId));
    setShowTimetable(false);
  };

  // Check for clashes
  const checkClashes = async () => {
    if (selectedCourses.length === 0) {
      setError('Please select at least one course');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      
      const response = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCourses }),
      });

      if (!response.ok) throw new Error('Failed to generate timetable');
      
      const data = await response.json();
      const returnedSessions: TimetableSession[] = data.sessions || [];
      const returnedClashes: Clash[] = data.clashes || [];
      setSessions(returnedSessions);
      setClashes(returnedClashes);
      setClashMessages(data.clashMessages || []);
      setShowTimetable(true);

      // Auto-select first day that has clashes or sessions
      const firstClashDay = returnedClashes[0]?.day;
      if (firstClashDay && days.includes(firstClashDay)) {
        setSelectedDay(firstClashDay);
      } else if (!returnedSessions.some(s => s.day === selectedDay)) {
        const firstDayWithSessions = days.find(d => returnedSessions.some(s => s.day === d));
        if (firstDayWithSessions) {
          setSelectedDay(firstDayWithSessions);
        }
      }
    } catch (err) {
      setError('Failed to check clashes. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get sessions for selected day
  const sessionsForDay = useMemo(() => {
    return sessions
      .filter(s => s.day === selectedDay)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, [sessions, selectedDay]);

  // Format course display for dropdown (with batch/department)
  const formatCourseDisplay = (course: Course) => {
    const year = course.batch.match(/20\d{2}/)?.[0] || course.batch;
    return `${course.name} - ${course.department} (${year}) - Section ${course.section}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Clash Detector</h1>
        <p className="text-slate-600">
          Select courses and check if there are any schedule conflicts.
        </p>
      </div>

      {/* Course Selection */}
      {!showTimetable && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4">Select Courses</h2>
          
          {/* Batch Filter & Search Row */}
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Filter by Batch
              </label>
              <select
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                value={selectedBatch}
                onChange={(e) => {
                  setSelectedBatch(e.target.value);
                  setIsDropdownOpen(true);
                }}
              >
                <option value="all">All Batches</option>
                {batches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Search Courses
              </label>
              <div className="relative course-dropdown">
                <input
                  type="text"
                  placeholder={
                    selectedBatch === 'all'
                      ? "Search by course, section, or batch..."
                      : `Search courses in ${selectedBatch}...`
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                
                {/* Dropdown */}
                {isDropdownOpen && (
                  <div className="course-dropdown-menu max-h-96 shadow-lg">
                    {isLoading ? (
                      <div className="p-4 text-center text-slate-500">
                        <div className="spinner mx-auto mb-2"></div>
                        Loading courses...
                      </div>
                    ) : filteredCourses.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        No courses found {selectedBatch !== 'all' ? `in ${selectedBatch}` : ''}
                      </div>
                    ) : (
                      <>
                        <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex justify-between items-center sticky top-0 z-10">
                          <span>
                            {selectedBatch === 'all'
                              ? `Showing ${Math.min(filteredCourses.length, 150)} of ${filteredCourses.length} courses`
                              : `${filteredCourses.length} courses in ${selectedBatch}`}
                          </span>
                          {selectedBatch === 'all' && (
                            <span className="text-blue-600 font-medium">Select a batch to narrow down</span>
                          )}
                        </div>
                        {filteredCourses.slice(0, 150).map(course => {
                          const isSelected = selectedCourses.some(c => c.id === course.id);
                          return (
                            <div
                              key={course.id}
                              className={`course-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleCourse(course)}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-800 flex items-center gap-2 flex-wrap">
                                    <span>{course.name}</span>
                                    {course.section && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                        Section {course.section}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {course.batch} • {course.department}
                                  </div>
                                </div>
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="text-slate-300 hover:text-blue-600 flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Click outside to close dropdown */}
          {isDropdownOpen && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsDropdownOpen(false)}
            ></div>
          )}

          {/* Selected Courses */}
          {selectedCourses.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-slate-600 mb-2">
                Selected: {selectedCourses.length} course(s)
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCourses.map(course => (
                  <div
                    key={course.id}
                    className="chip chip-selected cursor-pointer"
                    onClick={() => removeCourse(course.id)}
                  >
                    {course.name} ({course.section})
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 clash-alert">
              {error}
            </div>
          )}

          {/* Check Clashes Button */}
          <button
            onClick={checkClashes}
            disabled={selectedCourses.length === 0 || isGenerating}
            className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="spinner border-white border-t-transparent"></div>
                Checking...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Check for Clashes
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {showTimetable && (
        <div>
          {/* Back Button */}
          <button
            onClick={() => setShowTimetable(false)}
            className="mb-4 text-slate-600 hover:text-slate-800 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Selection
          </button>

          {/* Clash Alert or Success */}
          {clashes.length > 0 ? (
            <div className="clash-alert mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-800 mb-2">
                    {clashes.length} Clash{clashes.length > 1 ? 'es' : ''} Detected!
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {clashMessages.map((msg, idx) => (
                      <li key={idx}>• {msg}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="success-alert mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-800">No Clashes Found!</h3>
                  <p className="text-sm text-green-700">Your selected courses have no schedule conflicts.</p>
                </div>
              </div>
            </div>
          )}

          {/* Timetable */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Day Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200">
              {days.map(day => {
                const daySessionsCount = sessions.filter(s => s.day === day).length;
                const dayHasClash = clashes.some(c => c.day === day);
                return (
                  <button
                    key={day}
                    className={`day-tab ${selectedDay === day ? 'active' : ''} flex items-center gap-1.5`}
                    onClick={() => setSelectedDay(day)}
                  >
                    <span>{day}</span>
                    {daySessionsCount > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        dayHasClash
                          ? 'bg-red-100 text-red-700 font-bold'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {daySessionsCount}
                      </span>
                    )}
                    {dayHasClash && (
                      <span className="w-2 h-2 rounded-full bg-red-500" title="Clash on this day"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sessions for Day */}
            <div className="p-4">
              {sessions.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  No scheduled class slots found in the timetable for the selected courses.
                </div>
              ) : sessionsForDay.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  No classes scheduled on {selectedDay}
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionsForDay.map(session => {
                    const sessionClash = clashes.find(c =>
                      c.day === session.day &&
                      (
                        (c.course1 === session.courseName && c.section1 === session.section) ||
                        (c.course2 === session.courseName && c.section2 === session.section)
                      )
                    );

                    return (
                      <div
                        key={session.id}
                        className={`timetable-card ${session.sessionType.toLowerCase()} ${
                          sessionClash ? 'border-2 border-red-500 bg-red-50/20' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-slate-800">{session.courseName}</h3>
                              {sessionClash && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-300">
                                  ⚠️ Clash
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">
                              Section {session.section} • {session.department} • {session.batch}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${
                            session.sessionType === 'Lab' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {session.sessionType}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1 font-medium">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {session.timeSlot}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Room: {session.room}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
