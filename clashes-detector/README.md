# Clashes Detector

A web application for FAST-NUCES students to detect timetable clashes and find optimal class schedules.

## Features

### 1. Clash Detector
- Search and select courses from any batch/department
- Instantly check for schedule conflicts
- View detailed clash information
- See your complete timetable

### 2. Optimal Schedule Finder
- Select your batch (e.g., BS-CS-2023)
- Choose the courses you want to take
- Get automatic section assignments with no clashes
- Exclude specific sections and regenerate

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Data Source**: Google Sheets API
- **Deployment**: Vercel

## Setup

### 1. Install Dependencies

```bash
cd clashes-detector
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file based on `.env.local.example`:

```env
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_PROJECT_ID=your_project_id
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_CLIENT_ID=your_client_id
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variables in Vercel dashboard or via CLI:
```bash
vercel env add GOOGLE_SPREADSHEET_ID
vercel env add GOOGLE_PROJECT_ID
vercel env add GOOGLE_PRIVATE_KEY_ID
vercel env add GOOGLE_PRIVATE_KEY
vercel env add GOOGLE_CLIENT_EMAIL
vercel env add GOOGLE_CLIENT_ID
```

### Option 2: Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables in project settings
5. Deploy!

## Project Structure

```
clashes-detector/
├── app/
│   ├── api/
│   │   ├── courses/route.ts      # Fetch all courses
│   │   ├── timetable/route.ts    # Generate timetable & detect clashes
│   │   └── optimal-schedule/route.ts  # Find optimal section assignments
│   ├── clash-detector/page.tsx   # Feature 1: Clash Detection
│   ├── optimal-schedule/page.tsx # Feature 2: Optimal Schedule
│   ├── layout.tsx
│   ├── page.tsx                  # Home page
│   └── globals.css
├── lib/
│   ├── types.ts                  # TypeScript interfaces
│   ├── google-sheets.ts          # Google Sheets API client
│   ├── time-parser.ts            # Time parsing utilities
│   ├── course-extractor.ts       # Course extraction logic
│   ├── timetable-extractor.ts    # Timetable extraction logic
│   └── clash-detector.ts         # Clash detection algorithm
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## API Endpoints

### GET /api/courses
Returns all available courses, batches, and departments.

### POST /api/timetable
Generate timetable for selected courses and detect clashes.

**Request Body:**
```json
{
  "selectedCourses": [
    { "id": "...", "name": "...", "section": "...", ... }
  ]
}
```

### POST /api/optimal-schedule
Find optimal section assignments for a batch.

**Request Body:**
```json
{
  "batch": "BS-CS (2023)",
  "selectedCourseNames": ["Data Structures", "OOP"],
  "excludedAssignments": {
    "Data Structures": ["A"]  // Exclude section A
  }
}
```

## How It Works

1. **Data Fetching**: The app fetches timetable data from Google Sheets using a service account
2. **Course Extraction**: Courses are identified by cell background colors (each batch has a unique color)
3. **Clash Detection**: Two sessions clash if they're on the same day with overlapping time slots
4. **Optimal Schedule**: Uses backtracking to try all section combinations and find one with minimum/zero clashes

## Caching

- Spreadsheet data is cached for 30 minutes on the server
- Course data is cached for 10 minutes per API request
- This reduces Google Sheets API calls and improves response time

## Contributing

Feel free to open issues or submit pull requests!

## License

MIT
