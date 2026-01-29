import { NextRequest, NextResponse } from 'next/server';
import { getAllSessionsForBatch } from '@/lib/timetable-extractor';
import { findOptimalSchedule, formatClash } from '@/lib/clash-detector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batch, selectedCourseNames, excludedAssignments } = body as {
      batch: string;
      selectedCourseNames: string[];
      excludedAssignments?: { [courseName: string]: string[] };
    };

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch is required' },
        { status: 400 }
      );
    }

    if (!selectedCourseNames || selectedCourseNames.length === 0) {
      return NextResponse.json(
        { error: 'No courses selected' },
        { status: 400 }
      );
    }

    // Get all sessions for the batch
    const allSessions = await getAllSessionsForBatch(batch);

    if (allSessions.length === 0) {
      return NextResponse.json(
        { error: `No sessions found for batch: ${batch}` },
        { status: 404 }
      );
    }

    // Find optimal schedule
    const result = findOptimalSchedule(
      allSessions,
      selectedCourseNames,
      excludedAssignments || {}
    );

    // Format clash messages
    const clashMessages = result.clashes.map(formatClash);

    // Get available sections for each course (for UI to show options)
    const availableSections: { [courseName: string]: string[] } = {};
    selectedCourseNames.forEach(courseName => {
      const sections = Array.from(new Set(
        allSessions
          .filter(s => s.courseName === courseName)
          .map(s => s.section)
      )).sort();
      availableSections[courseName] = sections;
    });

    return NextResponse.json({
      ...result,
      clashMessages,
      availableSections,
    });
  } catch (error) {
    console.error('Error finding optimal schedule:', error);
    return NextResponse.json(
      { error: 'Failed to find optimal schedule' },
      { status: 500 }
    );
  }
}
