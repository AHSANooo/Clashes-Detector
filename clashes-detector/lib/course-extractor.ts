import { Course, BatchColors } from './types';
import { 
  fetchSpreadsheet, 
  extractBatchColors, 
  getFormattedValue, 
  getBackgroundColor,
  TIMETABLE_SHEETS 
} from './google-sheets';
import { parseEmbeddedTime, extractDepartmentFromBatch } from './time-parser';

/**
 * Extract all courses from spreadsheet
 */
export async function extractAllCourses(): Promise<Course[]> {
  const spreadsheet = await fetchSpreadsheet();
  const courses: Course[] = [];
  const seenKeys = new Set<string>();

  // Extract batch colors first
  const batchColors = extractBatchColors(spreadsheet);
  console.log(`Batch colors extracted: ${Object.keys(batchColors).length} colors found`);

  spreadsheet.sheets?.forEach((sheet: any) => {
    const sheetName = sheet.properties?.title;
    if (!TIMETABLE_SHEETS.includes(sheetName)) return;

    const gridData = sheet.data?.[0]?.rowData;
    if (!gridData) return;

    // Process rows starting from row 5 (index 5)
    gridData.slice(5).forEach((row: any) => {
      const rowValues = row?.values || [];

      rowValues.forEach((cell: any) => {
        const cellColor = getBackgroundColor(cell);

        // Check if this cell has a course (matched by color)
        if (cellColor && batchColors[cellColor]) {
          const courseEntry = getFormattedValue(cell) || '';

          if (courseEntry) {
            const batch = batchColors[cellColor];
            const courseInfo = parseCourseEntry(courseEntry, batch);

            if (courseInfo) {
              const courseKey = `${courseInfo.name}_${courseInfo.department}_${courseInfo.section}_${courseInfo.batch}`;
              
              if (!seenKeys.has(courseKey)) {
                seenKeys.add(courseKey);
                courses.push({
                  ...courseInfo,
                  id: courseKey,
                  colorCode: cellColor,
                  day: sheetName,
                });
              }
            }
          }
        }
      });
    });
  });

  // Filter out cancelled courses and sort
  return courses
    .filter(c => !c.name.toLowerCase().includes('cancelled'))
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      const deptCompare = a.department.localeCompare(b.department);
      if (deptCompare !== 0) return deptCompare;
      return a.section.localeCompare(b.section);
    });
}

/**
 * Parse course entry to extract information
 */
function parseCourseEntry(courseEntry: string, batch: string): Omit<Course, 'id' | 'colorCode' | 'day'> | null {
  if (!courseEntry) return null;

  // Extract department from batch
  const department = extractDepartmentFromBatch(batch);

  // Extract section from course entry
  let section = '';
  let courseName = courseEntry;

  // Handle group patterns like "(CS-A,G-1)"
  const groupWithSectionPattern = new RegExp(`\\(${department}-([A-Z]),\\s*G-\\d+\\)`);
  const groupSectionMatch = courseEntry.match(groupWithSectionPattern);

  if (groupSectionMatch) {
    section = groupSectionMatch[1];
    courseName = courseEntry.replace(new RegExp(`${department}-[A-Z],`), `${department},`);
  } else {
    // Standard section patterns
    const sectionPatterns = [
      new RegExp(`\\(${department}-([A-Z])\\)`),
      /-([A-Z])\b/,
      /\(([A-Z])\)/,
      /\s([A-Z])\s/
    ];

    for (const pattern of sectionPatterns) {
      const match = courseEntry.match(pattern);
      if (match) {
        section = match[1];
        courseName = courseEntry.replace(pattern, '').trim();
        break;
      }
    }
  }

  // Clean up course name
  courseName = courseName.replace(/\(\)/g, '').trim();
  if (courseName.endsWith('-')) {
    courseName = courseName.slice(0, -1).trim();
  }

  // Parse embedded time and remove it from name
  const { cleanedName } = parseEmbeddedTime(courseName);
  courseName = cleanedName;

  return {
    name: courseName,
    department,
    section,
    batch,
    fullEntry: courseEntry,
  };
}

/**
 * Get unique batches from courses
 */
export function getBatches(courses: Course[]): string[] {
  return Array.from(new Set(courses.map(c => c.batch))).sort();
}

/**
 * Get unique departments from courses
 */
export function getDepartments(courses: Course[]): string[] {
  return Array.from(new Set(courses.map(c => c.department))).sort();
}

/**
 * Search courses with filters
 */
export function searchCourses(
  courses: Course[],
  query: string = '',
  department: string = '',
  batch: string = ''
): Course[] {
  let filtered = courses;

  if (department) {
    filtered = filtered.filter(c => c.department === department);
  }

  if (batch) {
    filtered = filtered.filter(c => c.batch === batch);
  }

  if (query) {
    const queryLower = query.toLowerCase();
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(queryLower) ||
      c.department.toLowerCase().includes(queryLower) ||
      c.section.toLowerCase().includes(queryLower)
    );
  }

  return filtered;
}

/**
 * Get courses for a specific batch (for Feature 2)
 */
export function getCoursesForBatch(courses: Course[], batch: string): Course[] {
  return courses.filter(c => c.batch === batch);
}

/**
 * Get unique course names for a batch (for Feature 2 - selecting course names only)
 */
export function getUniqueCourseNamesForBatch(courses: Course[], batch: string): string[] {
  const batchCourses = courses.filter(c => c.batch === batch);
  return Array.from(new Set(batchCourses.map(c => c.name))).sort();
}

/**
 * Get available sections for a course name within a batch
 */
export function getSectionsForCourse(courses: Course[], batch: string, courseName: string): string[] {
  return courses
    .filter(c => c.batch === batch && c.name === courseName)
    .map(c => c.section)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .sort();
}
