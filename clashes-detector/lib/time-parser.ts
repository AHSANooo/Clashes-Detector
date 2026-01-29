// Time parsing utilities - ported from FASTable

/**
 * Parse time slot and return minutes from midnight for sorting/comparison
 */
export function parseTimeSlot(timeSlot: string): { start: number; end: number } {
  if (!timeSlot || timeSlot === 'Unknown') {
    return { start: 9999, end: 9999 };
  }

  // Extract time tokens (HH:MM)
  const timeRegex = /(\d{1,2}):(\d{2})/g;
  const matches = Array.from(timeSlot.matchAll(timeRegex));
  
  if (matches.length === 0) {
    return { start: 9999, end: 9999 };
  }

  const parseTime = (match: RegExpMatchArray, timeSlot: string, matchIndex: number): number => {
    const hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    
    // Check for AM/PM
    const ampmRegex = /\b(am|pm|AM|PM)\b/gi;
    const ampmMatches = Array.from(timeSlot.matchAll(ampmRegex));
    
    let hour24 = hour;
    
    if (ampmMatches.length > 0) {
      // Use corresponding AM/PM if available
      const ampm = ampmMatches[Math.min(matchIndex, ampmMatches.length - 1)]?.[0]?.toUpperCase() || '';
      if (ampm === 'PM' && hour !== 12) {
        hour24 = hour + 12;
      } else if (ampm === 'AM' && hour === 12) {
        hour24 = 0;
      }
    } else {
      // University schedule: 8-11 are AM, 12 is noon, 1-7 are PM
      if (hour >= 8 && hour <= 11) {
        hour24 = hour;
      } else if (hour === 12) {
        hour24 = 12;
      } else if (hour >= 1 && hour <= 7) {
        hour24 = hour + 12;
      }
    }
    
    return hour24 * 60 + minute;
  };

  const startMinutes = parseTime(matches[0], timeSlot, 0);
  const endMinutes = matches.length > 1 
    ? parseTime(matches[1], timeSlot, 1) 
    : startMinutes + 50; // Default 50 min class

  return { start: startMinutes, end: endMinutes };
}

/**
 * Parse embedded time from course entries like "Func Eng (SE) 09:00-10:45"
 */
export function parseEmbeddedTime(courseEntry: string): { 
  cleanedName: string; 
  timeSlot: string; 
  hasEmbeddedTime: boolean 
} {
  if (!courseEntry) {
    return { cleanedName: courseEntry, timeSlot: 'Unknown', hasEmbeddedTime: false };
  }

  const timePattern = /\b(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?)\b/;
  const timeMatch = courseEntry.match(timePattern);

  if (timeMatch) {
    const timeSlot = timeMatch[1];
    let cleanedEntry = courseEntry.replace(timePattern, '').trim();
    cleanedEntry = cleanedEntry.replace(/\s+/g, ' ').trim();
    if (cleanedEntry.endsWith('-')) {
      cleanedEntry = cleanedEntry.slice(0, -1).trim();
    }
    return { cleanedName: cleanedEntry, timeSlot, hasEmbeddedTime: true };
  }

  return { cleanedName: courseEntry, timeSlot: 'Unknown', hasEmbeddedTime: false };
}

/**
 * Extract department from batch string (e.g., "BS-CS-1" -> "CS")
 */
export function extractDepartmentFromBatch(batch: string): string {
  if (!batch) return '';

  // Handle dash-separated format
  if (batch.includes('-')) {
    const parts = batch.split('-');
    if (parts.length >= 2) return parts[1];
  }

  // Handle space-separated format like "BS CS (2023)"
  const tokens = batch.match(/\b[A-Z]{2,4}\b/g) || [];
  return tokens.find(t => t !== 'BS') || '';
}

/**
 * Extract year from batch string
 */
export function extractYearFromBatch(batch: string): string {
  const yearMatch = batch.match(/(20\d{2})/);
  return yearMatch?.[1] || batch;
}

/**
 * Clean room data
 */
export function cleanRoomData(room: string): string {
  if (!room) return 'Unknown';

  let cleaned = room.trim();

  // Remove common prefixes
  const prefixes = ['room', 'room no', 'room number', 'location', 'venue'];
  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).trim();
    }
  }

  // Handle "No." prefix
  if (cleaned.toLowerCase().startsWith('no.')) {
    cleaned = cleaned.substring(3).trim();
  } else if (cleaned.toLowerCase().startsWith('no ')) {
    cleaned = cleaned.substring(3).trim();
  }

  // Remove extra punctuation
  cleaned = cleaned.replace(/^[.,;:\s]+|[.,;:\s]+$/g, '');

  return cleaned || 'Unknown';
}

/**
 * Check if two time slots overlap
 */
export function doTimeSlotsOverlap(slot1: string, slot2: string): boolean {
  const time1 = parseTimeSlot(slot1);
  const time2 = parseTimeSlot(slot2);
  
  // If either is unknown, can't determine overlap
  if (time1.start === 9999 || time2.start === 9999) {
    return false;
  }
  
  // Check for overlap: NOT (end1 <= start2 OR end2 <= start1)
  return !(time1.end <= time2.start || time2.end <= time1.start);
}

/**
 * Format minutes to time string
 */
export function formatMinutesToTime(minutes: number): string {
  if (minutes === 9999) return 'Unknown';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${period}`;
}
