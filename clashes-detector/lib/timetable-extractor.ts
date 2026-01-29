import { Course, TimetableSession, BatchColors } from './types';
import { 
  fetchSpreadsheet, 
  extractBatchColors, 
  getFormattedValue, 
  getBackgroundColor,
  TIMETABLE_SHEETS 
} from './google-sheets';
import { 
  parseEmbeddedTime, 
  extractDepartmentFromBatch, 
  cleanRoomData,
  parseTimeSlot 
} from './time-parser';

/**
 * Get timetable sessions for selected courses
 */
export async function getTimetableForCourses(selectedCourses: Course[]): Promise<TimetableSession[]> {
  if (selectedCourses.length === 0) return [];

  const spreadsheet = await fetchSpreadsheet();
  const sessions: TimetableSession[] = [];
  const batchColors = extractBatchColors(spreadsheet);

  spreadsheet.sheets?.forEach((sheet: any) => {
    const sheetName = sheet.properties?.title;
    if (!TIMETABLE_SHEETS.includes(sheetName)) return;

    const gridData = sheet.data?.[0]?.rowData;
    if (!gridData || gridData.length < 6) return;

    // Build time column map
    const { timeRow, colRank } = buildTimeColRank(gridData);

    // Find lab time row
    let labTimeRow: any = null;
    let labTimeRowIndex: number | null = null;

    gridData.forEach((row: any, idx: number) => {
      const values = row?.values || [];
      const firstCellValue = getFormattedValue(values[0]);
      if (firstCellValue?.toLowerCase() === 'lab') {
        labTimeRow = row;
        labTimeRowIndex = idx;
      }
    });

    // Process data rows (starting from row 5)
    gridData.slice(5).forEach((row: any, relIdx: number) => {
      const rowIdx = relIdx + 5;
      const isLab = labTimeRowIndex !== null && rowIdx >= labTimeRowIndex;

      const rowValues = row?.values || [];
      const roomCellValue = getFormattedValue(rowValues[0]);
      const room = cleanRoomData(roomCellValue || '');

      rowValues.forEach((cell: any, colIdx: number) => {
        const classEntry = getFormattedValue(cell) || '';
        if (!classEntry) return;

        const cellColor = getBackgroundColor(cell);

        selectedCourses.forEach(selectedCourse => {
          if (matchesSelectedCourse(classEntry, selectedCourse, cellColor, batchColors)) {
            const { cleanedName, timeSlot: embeddedTime, hasEmbeddedTime } = parseEmbeddedTime(classEntry);

            // Get time slot
            let timeSlot: string;
            if (hasEmbeddedTime) {
              timeSlot = embeddedTime;
            } else if (isLab && labTimeRow) {
              const labTimeValues = labTimeRow?.values || [];
              timeSlot = getFormattedValue(labTimeValues[colIdx]) || 'Unknown';
            } else {
              const timeValues = timeRow?.values || [];
              timeSlot = getFormattedValue(timeValues[colIdx]) || 'Unknown';
            }

            const courseName = hasEmbeddedTime ? cleanedName : selectedCourse.name;
            const rank = colRank[colIdx] ?? 999;
            const sessionType = (isLab || courseName.toLowerCase().includes('lab')) ? 'Lab' : 'Class';

            const { start, end } = parseTimeSlot(timeSlot);

            const session: TimetableSession = {
              id: `${sheetName}_${colIdx}_${rowIdx}_${selectedCourse.id}`,
              day: sheetName,
              timeSlot,
              room,
              sessionType: sessionType as 'Class' | 'Lab',
              courseName,
              section: selectedCourse.section,
              batch: selectedCourse.batch,
              department: selectedCourse.department,
              rank,
              colorCode: cellColor,
              startMinutes: start,
              endMinutes: end,
            };

            // Avoid duplicates
            if (!sessions.some(s => isSimilarSession(s, session))) {
              sessions.push(session);
            }
          }
        });
      });
    });
  });

  // Sort by day order, then by time
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return sessions.sort((a, b) => {
    const dayCompare = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayCompare !== 0) return dayCompare;
    return a.startMinutes - b.startMinutes;
  });
}

/**
 * Build time column rank map
 */
function buildTimeColRank(gridData: any[]): { timeRow: any; colRank: { [col: number]: number } } {
  let timeRow: any = null;
  let startCol = 0;

  // Find time row (usually has "Room" in first cell)
  for (let i = 0; i < Math.min(10, gridData.length); i++) {
    const rowValues = gridData[i]?.values || [];
    if (rowValues.length > 0) {
      const firstCellValue = getFormattedValue(rowValues[0])?.toLowerCase() || '';
      if (firstCellValue.includes('room')) {
        timeRow = gridData[i];
        startCol = 1;
        break;
      }
    }
  }

  // Fallback to row 4 if not found
  if (!timeRow && gridData.length > 4) {
    timeRow = gridData[4];
    startCol = 0;
  }

  // Build column rank map
  const colRank: { [col: number]: number } = {};
  const timeValues = timeRow?.values || [];
  
  timeValues.forEach((cell: any, colIdx: number) => {
    const formattedVal = getFormattedValue(cell);
    if (colIdx >= startCol && formattedVal) {
      colRank[colIdx] = Object.keys(colRank).length;
    }
  });

  return { timeRow, colRank };
}

/**
 * Check if a cell matches a selected course
 */
function matchesSelectedCourse(
  classEntry: string,
  selectedCourse: Course,
  cellColor: string,
  batchColors: BatchColors
): boolean {
  const { cleanedName, hasEmbeddedTime } = parseEmbeddedTime(classEntry);
  const entryToMatch = hasEmbeddedTime ? cleanedName : classEntry;

  // Check course name match
  if (!entryToMatch.toLowerCase().includes(selectedCourse.name.toLowerCase())) {
    return false;
  }

  // Don't match lab entries for non-lab courses
  if (!selectedCourse.name.toLowerCase().includes('lab') && entryToMatch.toLowerCase().includes('lab')) {
    return false;
  }

  // Check section match
  const dept = selectedCourse.department;
  const section = selectedCourse.section;
  const sectionPatterns = [
    dept ? `(${dept}-${section})` : null,
    `-${section})`,
    `-${section} `,
    `(${section})`,
    ` ${section})`,
  ].filter(Boolean) as string[];

  if (!sectionPatterns.some(pattern => classEntry.includes(pattern))) {
    return false;
  }

  // Check batch color match
  const expectedColor = Object.entries(batchColors).find(([, batch]) => batch === selectedCourse.batch)?.[0];
  if (expectedColor && cellColor !== expectedColor) {
    return false;
  }

  return true;
}

/**
 * Check if two sessions are similar (for deduplication)
 */
function isSimilarSession(session1: TimetableSession, session2: TimetableSession): boolean {
  return (
    session1.day === session2.day &&
    session1.timeSlot === session2.timeSlot &&
    session1.courseName.toLowerCase() === session2.courseName.toLowerCase() &&
    session1.section === session2.section
  );
}

/**
 * Get all sessions for a batch (all sections)
 */
export async function getAllSessionsForBatch(batch: string): Promise<TimetableSession[]> {
  const spreadsheet = await fetchSpreadsheet();
  const sessions: TimetableSession[] = [];
  const batchColors = extractBatchColors(spreadsheet);

  // Find the color for this batch
  const targetColor = Object.entries(batchColors).find(([, b]) => b === batch)?.[0];
  if (!targetColor) {
    console.error(`No color found for batch: ${batch}`);
    return [];
  }

  const department = extractDepartmentFromBatch(batch);

  spreadsheet.sheets?.forEach((sheet: any) => {
    const sheetName = sheet.properties?.title;
    if (!TIMETABLE_SHEETS.includes(sheetName)) return;

    const gridData = sheet.data?.[0]?.rowData;
    if (!gridData || gridData.length < 6) return;

    const { timeRow, colRank } = buildTimeColRank(gridData);

    // Find lab time row
    let labTimeRow: any = null;
    let labTimeRowIndex: number | null = null;

    gridData.forEach((row: any, idx: number) => {
      const values = row?.values || [];
      const firstCellValue = getFormattedValue(values[0]);
      if (firstCellValue?.toLowerCase() === 'lab') {
        labTimeRow = row;
        labTimeRowIndex = idx;
      }
    });

    // Process data rows
    gridData.slice(5).forEach((row: any, relIdx: number) => {
      const rowIdx = relIdx + 5;
      const isLab = labTimeRowIndex !== null && rowIdx >= labTimeRowIndex;

      const rowValues = row?.values || [];
      const roomCellValue = getFormattedValue(rowValues[0]);
      const room = cleanRoomData(roomCellValue || '');

      rowValues.forEach((cell: any, colIdx: number) => {
        const cellColor = getBackgroundColor(cell);
        if (cellColor !== targetColor) return;

        const classEntry = getFormattedValue(cell) || '';
        if (!classEntry) return;

        // Extract section from entry
        const sectionPatterns = [
          new RegExp(`\\(${department}-([A-Z])\\)`),
          /-([A-Z])\)/,
          /-([A-Z])\s/,
          /-([A-Z]),/,
          /\(([A-Z])\)/,
        ];

        let section = '';
        for (const pattern of sectionPatterns) {
          const match = classEntry.match(pattern);
          if (match) {
            section = match[1];
            break;
          }
        }

        if (!section) return;

        const { cleanedName, timeSlot: embeddedTime, hasEmbeddedTime } = parseEmbeddedTime(classEntry);

        // Get time slot
        let timeSlot: string;
        if (hasEmbeddedTime) {
          timeSlot = embeddedTime;
        } else if (isLab && labTimeRow) {
          const labTimeValues = labTimeRow?.values || [];
          timeSlot = getFormattedValue(labTimeValues[colIdx]) || 'Unknown';
        } else {
          const timeValues = timeRow?.values || [];
          timeSlot = getFormattedValue(timeValues[colIdx]) || 'Unknown';
        }

        // Clean course name
        let courseName = hasEmbeddedTime ? cleanedName : classEntry;
        sectionPatterns.forEach(pattern => {
          courseName = courseName.replace(pattern, '').trim();
        });
        courseName = courseName.replace(/\(\)/g, '').trim();
        if (courseName.endsWith('-')) {
          courseName = courseName.slice(0, -1).trim();
        }

        const rank = colRank[colIdx] ?? 999;
        const sessionType = (isLab || courseName.toLowerCase().includes('lab')) ? 'Lab' : 'Class';
        const { start, end } = parseTimeSlot(timeSlot);

        const session: TimetableSession = {
          id: `${sheetName}_${colIdx}_${rowIdx}_${section}`,
          day: sheetName,
          timeSlot,
          room,
          sessionType: sessionType as 'Class' | 'Lab',
          courseName,
          section,
          batch,
          department,
          rank,
          colorCode: cellColor,
          startMinutes: start,
          endMinutes: end,
        };

        // Avoid duplicates
        if (!sessions.some(s => isSimilarSession(s, session))) {
          sessions.push(session);
        }
      });
    });
  });

  return sessions;
}
