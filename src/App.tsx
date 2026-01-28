import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import TeacherInputPage from './pages/TeacherInputPage';
import AdminPage from './pages/AdminPage';
import PreviewPage from './pages/PreviewPage';
import SendPage from './pages/SendPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/teacher" element={<TeacherInputPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
