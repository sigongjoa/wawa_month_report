import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import TeacherInputPage from './pages/TeacherInputPage';
import AdminPage from './pages/AdminPage';
import PreviewPage from './pages/PreviewPage';
import SendPage from './pages/SendPage';
import SettingsPage from './pages/SettingsPage';
import ExamManagePage from './pages/ExamManagePage';
import StudentManagePage from './pages/StudentManagePage';
import ExamSchedulePage from './pages/ExamSchedulePage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/teacher" element={<TeacherInputPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/exams" element={<ExamManagePage />} />
        <Route path="/students" element={<StudentManagePage />} />
        <Route path="/schedule" element={<ExamSchedulePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
