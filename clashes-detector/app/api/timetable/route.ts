import { NextRequest, NextResponse } from 'next/server';
import { getTimetableForCourses } from '@/lib/timetable-extractor';
import { detectClashes, formatClash, filterValidSessions } from '@/lib/clash-detector';
import { Course } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { selectedCourses } = body as { selectedCourses: Course[] };

    if (!selectedCourses || selectedCourses.length === 0) {
      return NextResponse.json(
        { error: 'No courses selected' },
        { status: 400 }
      );
    }

    // Get timetable sessions for selected courses
    const rawSessions = await getTimetableForCourses(selectedCourses);
    
    // Filter to ensure proper session counts (1 lab/week, 2 classes/week)
    const sessions = filterValidSessions(rawSessions);

    // Detect clashes
    const clashes = detectClashes(sessions);

    // Format clash messages
    const clashMessages = clashes.map(formatClash);

    return NextResponse.json({
      sessions,
      clashes,
      clashMessages,
      hasClashes: clashes.length > 0,
    });
  } catch (error) {
    console.error('Error generating timetable:', error);
    return NextResponse.json(
      { error: 'Failed to generate timetable' },
      { status: 500 }
    );
  }
}
