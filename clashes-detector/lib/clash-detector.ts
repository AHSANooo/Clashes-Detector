import { TimetableSession, Clash, OptimalScheduleResult } from './types';
import { doTimeSlotsOverlap } from './time-parser';

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

  // Try all combinations to find clash-free schedule
  const bestResult = findBestCombination(courseOptions, courseSessionsMap, 0, {}, []);

  if (bestResult.clashCount === 0) {
    return {
      success: true,
      schedule: bestResult.schedule,
      assignments: bestResult.assignments,
      clashes: [],
      message: 'Found a clash-free schedule!',
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
}

/**
 * Recursive function to try all section combinations
 */
function findBestCombination(
  courseOptions: { courseName: string; sections: string[] }[],
  courseSessionsMap: { [courseName: string]: { [section: string]: TimetableSession[] } },
  index: number,
  currentAssignments: { [courseName: string]: string },
  currentSchedule: TimetableSession[]
): CombinationResult {
  // Base case: all courses assigned
  if (index === courseOptions.length) {
    const clashes = detectClashes(currentSchedule);
    return {
      assignments: { ...currentAssignments },
      schedule: [...currentSchedule],
      clashCount: clashes.length,
    };
  }

  const { courseName, sections } = courseOptions[index];
  let bestResult: CombinationResult = {
    assignments: {},
    schedule: [],
    clashCount: Infinity,
  };

  // Try each section for this course
  for (const section of sections) {
    const sectionSessions = courseSessionsMap[courseName]?.[section] || [];
    
    const newAssignments = { ...currentAssignments, [courseName]: section };
    const newSchedule = [...currentSchedule, ...sectionSessions];

    const result = findBestCombination(
      courseOptions,
      courseSessionsMap,
      index + 1,
      newAssignments,
      newSchedule
    );

    if (result.clashCount < bestResult.clashCount) {
      bestResult = result;
    }

    // Early exit if we found a clash-free solution
    if (bestResult.clashCount === 0) {
      break;
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
