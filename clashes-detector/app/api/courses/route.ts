import { NextResponse } from 'next/server';
import { extractAllCourses, getBatches, getDepartments } from '@/lib/course-extractor';

// Cache for courses data
let cachedCourses: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  try {
    const now = Date.now();
    
    // Return cached if still valid
    if (cachedCourses && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json(cachedCourses);
    }

    const courses = await extractAllCourses();
    const batches = getBatches(courses);
    const departments = getDepartments(courses);

    const response = {
      courses,
      batches,
      departments,
      timestamp: now,
    };

    cachedCourses = response;
    cacheTimestamp = now;

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
