import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clashes Detector - FAST Timetable Helper',
  description: 'Detect timetable clashes and find optimal schedules for FAST-NUCES students',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <a href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">CD</span>
                </div>
                <span className="font-semibold text-lg text-slate-800">Clashes Detector</span>
              </a>
              <div className="flex items-center gap-4">
                <a 
                  href="/clash-detector" 
                  className="text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
                >
                  Clash Detector
                </a>
                <a 
                  href="/optimal-schedule" 
                  className="text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
                >
                  Optimal Schedule
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
