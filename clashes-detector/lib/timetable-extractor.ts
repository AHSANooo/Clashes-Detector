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

interface SheetTimeMaps {
  classTimesMap: { [col: number]: string };
  labTimesMap: { [col: number]: string };
  colRank: { [col: number]: number };
  startDataRowIndex: number;
}

/**
 * Analyze header rows to build time slot maps for each column
 */
function analyzeSheetHeaders(gridData: any[]): SheetTimeMaps {
  let classTimeRow: any = null;
  let labTimeRow: any = null;
  let classTimeRowIdx = -1;
  let labTimeRowIdx = -1;

  const headerLimit = Math.min(8, gridData.length);
  for (let i = 0; i < headerLimit; i++) {
    const row = gridData[i];
    const values = row?.values || [];
    const firstCell = (getFormattedValue(values[0]) || '').toLowerCase();

    if (firstCell === 'lab') {
      labTimeRow = row;
      labTimeRowIdx = i;
      continue;
    }

    // Check if row has time patterns like 08:30 or 10:00
    const hasTimes = values.some((cell: any) => {
      const val = getFormattedValue(cell) || '';
      return /\b\d{1,2}:\d{2}\b/.test(val);
    });

    if (hasTimes && !classTimeRow) {
      classTimeRow = row;
      classTimeRowIdx = i;
    }
  }

  const classTimesMap: { [col: number]: string } = {};
  const labTimesMap: { [col: number]: string } = {};
  const colRank: { [col: number]: number } = {};

  if (classTimeRow) {
    let lastTime = 'Unknown';
    let currentRank = 0;
    const values = classTimeRow.values || [];
    for (let c = 1; c < values.length; c++) {
      const val = getFormattedValue(values[c]);
      if (val && /\b\d{1,2}:\d{2}\b/.test(val)) {
        lastTime = val.trim();
        colRank[c] = currentRank++;
      }
      classTimesMap[c] = lastTime;
    }
  }

  if (labTimeRow) {
    let lastTime = 'Unknown';
    const values = labTimeRow.values || [];
    for (let c = 1; c < values.length; c++) {
      const val = getFormattedValue(values[c]);
      if (val && /\b\d{1,2}:\d{2}\b/.test(val)) {
        lastTime = val.trim();
      }
      labTimesMap[c] = lastTime;
    }
  }

  const startDataRowIndex = Math.max(classTimeRowIdx, labTimeRowIdx, 0) + 1;

  return { classTimesMap, labTimesMap, colRank, startDataRowIndex };
}

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
    if (!gridData || gridData.length < 4) return;

    const { classTimesMap, labTimesMap, colRank, startDataRowIndex } = analyzeSheetHeaders(gridData);

    // Process data rows (classrooms and labs)
    gridData.slice(startDataRowIndex).forEach((row: any, relIdx: number) => {
      const rowIdx = relIdx + startDataRowIndex;
      const rowValues = row?.values || [];
      const roomCellValue = getFormattedValue(rowValues[0]);
      const room = cleanRoomData(roomCellValue || '');
      if (!room || room === 'Unknown') return;

      const isLabRoom = room.toLowerCase().includes('lab');

      rowValues.slice(1).forEach((cell: any, relColIdx: number) => {
        const colIdx = relColIdx + 1;
        const classEntry = getFormattedValue(cell) || '';
        if (!classEntry) return;

        const cellColor = getBackgroundColor(cell);

        selectedCourses.forEach(selectedCourse => {
          if (matchesSelectedCourse(classEntry, selectedCourse, cellColor, batchColors)) {
            const { cleanedName, timeSlot: embeddedTime, hasEmbeddedTime } = parseEmbeddedTime(classEntry);
            const courseName = hasEmbeddedTime ? cleanedName : selectedCourse.name;
            const isLabCourse = selectedCourse.name.toLowerCase().includes('lab') || 
                                classEntry.toLowerCase().includes('lab') || 
                                isLabRoom;

            // Get time slot
            let timeSlot = 'Unknown';
            if (hasEmbeddedTime) {
              timeSlot = embeddedTime;
            } else if (isLabCourse) {
              timeSlot = labTimesMap[colIdx] || classTimesMap[colIdx] || 'Unknown';
            } else {
              timeSlot = classTimesMap[colIdx] || 'Unknown';
            }

            const rank = colRank[colIdx] ?? 999;
            const sessionType = isLabCourse ? 'Lab' : 'Class';
            const { start, end } = parseTimeSlot(timeSlot);

            const session: TimetableSession = {
              id: `${sheetName}_${colIdx}_${rowIdx}_${selectedCourse.id}`,
              day: sheetName,
              timeSlot,
              room,
              sessionType: sessionType as 'Class' | 'Lab',
              courseName: selectedCourse.name,
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

  // Don't match lab entries for non-lab courses, and vice-versa
  const isSelectedLab = selectedCourse.name.toLowerCase().includes('lab');
  const isEntryLab = entryToMatch.toLowerCase().includes('lab');
  if (!isSelectedLab && isEntryLab) {
    return false;
  }
  if (isSelectedLab && !isEntryLab) {
    return false;
  }

  // Check section match
  const dept = selectedCourse.department;
  const section = selectedCourse.section;

  if (section) {
    const sectionPatterns = [
      new RegExp(`\\(${dept}-${section}[,) ]`),
      new RegExp(`\\(${dept}-${section}\\)`),
      new RegExp(`-${section}[,) ]`),
      new RegExp(`-${section}\\)`),
      new RegExp(`\\(${section}\\)`),
      new RegExp(`\\(${section}[,) ]`),
      new RegExp(` ${section}\\)`),
      new RegExp(` ${section} `)
    ];

    if (!sectionPatterns.some(pattern => pattern.test(classEntry))) {
      return false;
    }
  }

  // Check batch color match
  const expectedColor = Object.entries(batchColors).find(([, batch]) => batch === selectedCourse.batch)?.[0];
  if (expectedColor && cellColor && cellColor !== expectedColor) {
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
    session1.section === session2.section &&
    session1.room === session2.room
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
    if (!gridData || gridData.length < 4) return;

    const { classTimesMap, labTimesMap, colRank, startDataRowIndex } = analyzeSheetHeaders(gridData);

    // Process data rows
    gridData.slice(startDataRowIndex).forEach((row: any, relIdx: number) => {
      const rowIdx = relIdx + startDataRowIndex;
      const rowValues = row?.values || [];
      const roomCellValue = getFormattedValue(rowValues[0]);
      const room = cleanRoomData(roomCellValue || '');
      if (!room || room === 'Unknown') return;

      const isLabRoom = room.toLowerCase().includes('lab');

      rowValues.slice(1).forEach((cell: any, relColIdx: number) => {
        const colIdx = relColIdx + 1;
        const cellColor = getBackgroundColor(cell);
        if (cellColor !== targetColor) return;

        const classEntry = getFormattedValue(cell) || '';
        if (!classEntry) return;

        // Extract section from entry
        const sectionPatterns = [
          new RegExp(`\\(${department}-([A-Z])[,) ]`),
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

        // Clean course name
        let courseName = hasEmbeddedTime ? cleanedName : classEntry;
        sectionPatterns.forEach(pattern => {
          courseName = courseName.replace(pattern, '').trim();
        });
        courseName = courseName.replace(/\(\)/g, '').trim();
        if (courseName.endsWith('-')) {
          courseName = courseName.slice(0, -1).trim();
        }

        const isLabCourse = courseName.toLowerCase().includes('lab') || isLabRoom;

        // Get time slot
        let timeSlot = 'Unknown';
        if (hasEmbeddedTime) {
          timeSlot = embeddedTime;
        } else if (isLabCourse) {
          timeSlot = labTimesMap[colIdx] || classTimesMap[colIdx] || 'Unknown';
        } else {
          timeSlot = classTimesMap[colIdx] || 'Unknown';
        }

        const rank = colRank[colIdx] ?? 999;
        const sessionType = isLabCourse ? 'Lab' : 'Class';
        const { start, end } = parseTimeSlot(timeSlot);

        const session: TimetableSession = {
          id: `${sheetName}_${colIdx}_${rowIdx}_${section}_${courseName}`,
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
