// Types for the Clashes Detector App

export interface Course {
  id: string;
  name: string;
  department: string;
  section: string;
  batch: string;
  colorCode: string;
  fullEntry: string;
  day: string;
}

export interface TimetableSession {
  id: string;
  day: string;
  timeSlot: string;
  room: string;
  sessionType: 'Class' | 'Lab';
  courseName: string;
  section: string;
  batch: string;
  department: string;
  rank: number;
  colorCode: string;
  startMinutes: number;
  endMinutes: number;
}

export interface Clash {
  course1: string;
  course2: string;
  day: string;
  timeSlot1: string;
  timeSlot2: string;
  section1: string;
  section2: string;
}

export interface OptimalScheduleResult {
  success: boolean;
  schedule: TimetableSession[];
  assignments: { [courseName: string]: string }; // courseName -> section
  clashes: Clash[];
  message: string;
}

export interface BatchColors {
  [colorCode: string]: string;
}

export interface CachedData {
  courses: Course[];
  sessions: TimetableSession[];
  batches: string[];
  departments: string[];
  timestamp: number;
}
