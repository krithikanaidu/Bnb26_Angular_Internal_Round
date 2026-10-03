import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Scripts from './pages/Scripts';
import Studio from './pages/Studio';
import Publish from './pages/Publish';
import Insights from './pages/Insights';
import Calendar from './pages/Calendar';
import IdeationPage from './ideation-script-hook/IdeationPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="assets" element={<Assets />} />
          <Route path="scripts" element={<IdeationPage />} />
          <Route path="studio" element={<Studio />} />
          <Route path="publish" element={<Publish />} />
          <Route path="insights" element={<Insights />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="ideation" element={<IdeationPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
