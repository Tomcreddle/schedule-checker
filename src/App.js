import { useState } from 'react';
import './App.css';
import Dashboard from './pages/dashboard';
import ScheduleChecker from './pages/ScheduleChecker';

export default function App() {
  const [page, setPage] = useState('dashboard');

  // Pass navigation props into each page
  if (page === 'schedule-checker') {
    return <ScheduleChecker onBack={() => setPage('dashboard')} />;
  }

  return <Dashboard onNavigate={setPage} />;
}