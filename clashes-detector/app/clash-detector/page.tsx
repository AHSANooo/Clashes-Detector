'use client';

import { useState, useEffect, useMemo } from 'react';
import { Course, TimetableSession, Clash } from '@/lib/types';

export default function ClashDetectorPage() {
  const [courses, setCourses] = useState<Course[]>([]);
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
      if (!response.ok) throw new Error('Failed to fetch courses');
      const data = await response.json();
      setCourses(data.courses);
    } catch (err) {
      setError('Failed to load courses. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter courses based on search
  const filteredCourses = useMemo(() => {
    if (!searchQuery) return courses;
    const query = searchQuery.toLowerCase();
    return courses.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.department.toLowerCase().includes(query) ||
      c.batch.toLowerCase().includes(query) ||
      c.section.toLowerCase().includes(query)
    );
  }, [courses, searchQuery]);

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
      setSessions(data.sessions);
      setClashes(data.clashes);
      setClashMessages(data.clashMessages);
      setShowTimetable(true);
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
          
          {/* Search Input */}
          <div className="relative course-dropdown mb-4">
            <input
              type="text"
              placeholder="Search courses by name, department, batch..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
            />
            
            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="course-dropdown-menu">
                {isLoading ? (
                  <div className="p-4 text-center text-slate-500">
                    <div className="spinner mx-auto mb-2"></div>
                    Loading courses...
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    No courses found
                  </div>
                ) : (
                  filteredCourses.slice(0, 50).map(course => {
                    const isSelected = selectedCourses.some(c => c.id === course.id);
                    return (
                      <div
                        key={course.id}
                        className={`course-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleCourse(course)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-800">{course.name}</div>
                            <div className="text-sm text-slate-500">
                              {course.department} • {course.batch} • Section {course.section}
                            </div>
                          </div>
                          {isSelected && (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
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
          {sessions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                              Section {session.section} • {session.department}
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
