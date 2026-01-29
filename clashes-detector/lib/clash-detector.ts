import { TimetableSession, Clash, OptimalScheduleResult } from './types';
import { doTimeSlotsOverlap } from './time-parser';

// Expected sessions per week
const EXPECTED_LABS_PER_WEEK = 1;
const EXPECTED_CLASSES_PER_WEEK = 2;

/**
 * Detect clashes in a list of timetable sessions
 */
export function detectClashes(sessions: TimetableSession[]): Clash[] {
  const clashes: Clash[] = [];
  const seenClashes = new Set<string>();

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const session1 = sessions[i];
      const session2 = sessions[j];

      // Same course different sections don't count as clash
      if (session1.courseName === session2.courseName) continue;

      // Check if same day and overlapping time
      if (session1.day === session2.day) {
        // Check time overlap
        const overlaps = doSessionsOverlap(session1, session2);

        if (overlaps) {
          // Create unique key to avoid duplicate clash reports
          const clashKey = [
            session1.courseName,
            session2.courseName,
            session1.day,
          ].sort().join('_');

          if (!seenClashes.has(clashKey)) {
            seenClashes.add(clashKey);
            clashes.push({
              course1: session1.courseName,
              course2: session2.courseName,
              day: session1.day,
              timeSlot1: session1.timeSlot,
              timeSlot2: session2.timeSlot,
              section1: session1.section,
              section2: session2.section,
            });
          }
        }
      }
    }
  }

  return clashes;
}

/**
 * Check if two sessions overlap in time
 */
function doSessionsOverlap(session1: TimetableSession, session2: TimetableSession): boolean {
  // Use pre-calculated minutes if available
  if (session1.startMinutes !== 9999 && session2.startMinutes !== 9999) {
    return !(session1.endMinutes <= session2.startMinutes || session2.endMinutes <= session1.startMinutes);
  }

  // Fallback to string-based comparison
  return doTimeSlotsOverlap(session1.timeSlot, session2.timeSlot);
}

/**
 * Calculate total gap score for a schedule
 * Gap = time between end of one class and start of next class on same day
 * Lower score = more compact schedule
 */
function calculateTotalGapScore(sessions: TimetableSession[]): number {
  // Group sessions by day
  const daySessionsMap: { [day: string]: TimetableSession[] } = {};
  
  sessions.forEach(session => {
    if (!daySessionsMap[session.day]) {
      daySessionsMap[session.day] = [];
    }
    daySessionsMap[session.day].push(session);
  });

  let totalGap = 0;

  // For each day, sort sessions by start time and calculate gaps
  Object.values(daySessionsMap).forEach(daySessions => {
    // Sort by start time
    const sorted = daySessions
      .filter(s => s.startMinutes !== 9999) // Only include sessions with valid times
      .sort((a, b) => a.startMinutes - b.startMinutes);

    // Calculate gaps between consecutive classes
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = sorted[i].endMinutes;
      const nextStart = sorted[i + 1].startMinutes;
      
      if (nextStart > currentEnd) {
        // There's a gap
        totalGap += (nextStart - currentEnd);
      }
    }
  });

  return totalGap;
}

/**
 * Compare two schedule results - prioritize fewer clashes, then fewer gaps
 */
function isBetterSchedule(candidate: CombinationResult, current: CombinationResult): boolean {
  // First priority: fewer clashes
  if (candidate.clashCount < current.clashCount) {
    return true;
  }
  if (candidate.clashCount > current.clashCount) {
    return false;
  }
  // Same clash count: prefer fewer gaps
  return candidate.gapScore < current.gapScore;
}

/**
 * Find optimal schedule for given courses within a batch
 * Returns assignments of course -> section that minimizes/eliminates clashes
 */
export function findOptimalSchedule(
  allSessions: TimetableSession[],
  selectedCourseNames: string[],
  excludedAssignments: { [courseName: string]: string[] } = {} // courses with excluded sections
): OptimalScheduleResult {
  // Group sessions by course name
  const courseSessionsMap: { [courseName: string]: { [section: string]: TimetableSession[] } } = {};

  allSessions.forEach(session => {
    if (!selectedCourseNames.includes(session.courseName)) return;
    
    if (!courseSessionsMap[session.courseName]) {
      courseSessionsMap[session.courseName] = {};
    }
    if (!courseSessionsMap[session.courseName][session.section]) {
      courseSessionsMap[session.courseName][session.section] = [];
    }
    courseSessionsMap[session.courseName][session.section].push(session);
  });

  // Get available sections for each course (excluding user-excluded ones)
  const courseOptions: { courseName: string; sections: string[] }[] = [];
  
  for (const courseName of selectedCourseNames) {
    const courseSections = courseSessionsMap[courseName] || {};
    const allSections = Object.keys(courseSections);
    const excludedSections = excludedAssignments[courseName] || [];
    const availableSections = allSections.filter(s => !excludedSections.includes(s));
    
    if (availableSections.length === 0) {
      return {
        success: false,
        schedule: [],
        assignments: {},
        clashes: [],
        message: `No available sections for "${courseName}" after exclusions. Please remove some exclusions.`,
      };
    }
    
    courseOptions.push({ courseName, sections: availableSections });
  }

  // Try all combinations to find clash-free schedule with minimal gaps
  const bestResult = findBestCombination(courseOptions, courseSessionsMap, 0, {}, []);

  // Format gap time for display
  const gapHours = Math.floor(bestResult.gapScore / 60);
  const gapMins = bestResult.gapScore % 60;
  const gapDisplay = gapHours > 0 
    ? `${gapHours}h ${gapMins}m` 
    : `${gapMins}m`;

  if (bestResult.clashCount === 0) {
    const gapMessage = bestResult.gapScore > 0 
      ? ` Total gaps between classes: ${gapDisplay}.`
      : ' No gaps between classes!';
    return {
      success: true,
      schedule: bestResult.schedule,
      assignments: bestResult.assignments,
      clashes: [],
      message: `Found a clash-free schedule!${gapMessage}`,
    };
  } else {
    return {
      success: false,
      schedule: bestResult.schedule,
      assignments: bestResult.assignments,
      clashes: detectClashes(bestResult.schedule),
      message: `Could not find a clash-free schedule. Minimum clashes: ${bestResult.clashCount}. You may need to drop some courses or accept the clashes.`,
    };
  }
}

interface CombinationResult {
  assignments: { [courseName: string]: string };
  schedule: TimetableSession[];
  clashCount: number;
  gapScore: number; // Total gap minutes between classes (lower is better)
}

/**
 * Recursive function to try all section combinations with pruning
 * Uses a two-phase approach:
 * 1. First find all clash-free schedules
 * 2. Among clash-free ones, pick the one with minimum gaps
 */
function findBestCombination(
  courseOptions: { courseName: string; sections: string[] }[],
  courseSessionsMap: { [courseName: string]: { [section: string]: TimetableSession[] } },
  index: number,
  currentAssignments: { [courseName: string]: string },
  currentSchedule: TimetableSession[],
  bestSoFar: CombinationResult | null = null
): CombinationResult {
  // Base case: all courses assigned
  if (index === courseOptions.length) {
    // Filter sessions to proper counts before checking clashes
    const validSchedule = filterValidSessions(currentSchedule);
    const clashes = detectClashes(validSchedule);
    const gapScore = calculateTotalGapScore(validSchedule);
    return {
      assignments: { ...currentAssignments },
      schedule: validSchedule,
      clashCount: clashes.length,
      gapScore,
    };
  }

  const { courseName, sections } = courseOptions[index];
  let bestResult: CombinationResult = bestSoFar || {
    assignments: {},
    schedule: [],
    clashCount: Infinity,
    gapScore: Infinity,
  };

  // Try each section for this course
  for (const section of sections) {
    const sectionSessions = courseSessionsMap[courseName]?.[section] || [];
    
    const newAssignments = { ...currentAssignments, [courseName]: section };
    const newSchedule = [...currentSchedule, ...sectionSessions];

    // Early pruning: if current partial schedule already has more clashes than best, skip
    // Only check if we have at least 2 courses to compare
    if (bestResult.clashCount === 0 && index >= 1) {
      const partialClashes = detectClashes(filterValidSessions(newSchedule));
      if (partialClashes.length > 0) {
        // This branch will have clashes, but we already have a clash-free solution
        // Skip this branch entirely
        continue;
      }
    }

    const result = findBestCombination(
      courseOptions,
      courseSessionsMap,
      index + 1,
      newAssignments,
      newSchedule,
      bestResult
    );

    // Compare: prioritize fewer clashes, then fewer gaps
    if (isBetterSchedule(result, bestResult)) {
      bestResult = result;
    }
  }

  return bestResult;
}

/**
 * Format clash for display
 */
export function formatClash(clash: Clash): string {
  return `"${clash.course1}" (Section ${clash.section1}) clashes with "${clash.course2}" (Section ${clash.section2}) on ${clash.day} at ${clash.timeSlot1} / ${clash.timeSlot2}`;
}

/**
 * Get simple clash message
 */
export function getClashMessage(clash: Clash): string {
  return `${clash.course1} clashes with ${clash.course2} on ${clash.day} ${clash.timeSlot1}`;
}

/**
 * Filter sessions to ensure proper session counts per course:
 * - Lab subjects: 1 lab per week
 * - Non-lab subjects: 2 classes per week
 * 
 * If there are duplicates (same course, same day, same type), keep only one.
 * Then limit to expected counts.
 */
export function filterValidSessions(sessions: TimetableSession[]): TimetableSession[] {
  // Group sessions by course name
  const courseSessionsMap: { [courseName: string]: TimetableSession[] } = {};
  
  sessions.forEach(session => {
    if (!courseSessionsMap[session.courseName]) {
      courseSessionsMap[session.courseName] = [];
    }
    courseSessionsMap[session.courseName].push(session);
  });

  const filteredSessions: TimetableSession[] = [];

  Object.entries(courseSessionsMap).forEach(([courseName, courseSessions]) => {
    const isLabCourse = courseName.toLowerCase().includes('lab');
    
    // Separate lab and class sessions
    const labSessions = courseSessions.filter(s => s.sessionType === 'Lab');
    const classSessions = courseSessions.filter(s => s.sessionType === 'Class');

    // Remove duplicates (same day sessions - keep first only)
    const uniqueLabSessions = removeDuplicateDays(labSessions);
    const uniqueClassSessions = removeDuplicateDays(classSessions);

    if (isLabCourse) {
      // Lab course: take only 1 lab session
      filteredSessions.push(...uniqueLabSessions.slice(0, EXPECTED_LABS_PER_WEEK));
    } else {
      // Regular course: take 2 class sessions
      filteredSessions.push(...uniqueClassSessions.slice(0, EXPECTED_CLASSES_PER_WEEK));
      // Also include any lab component (some courses have both)
      filteredSessions.push(...uniqueLabSessions.slice(0, EXPECTED_LABS_PER_WEEK));
    }
  });

  return filteredSessions;
}

/**
 * Remove duplicate sessions on the same day (keep the first one)
 */
function removeDuplicateDays(sessions: TimetableSession[]): TimetableSession[] {
  const seenDays = new Set<string>();
  return sessions.filter(session => {
    const key = `${session.day}_${session.sessionType}`;
    if (seenDays.has(key)) {
      return false;
    }
    seenDays.add(key);
    return true;
  });
}
