import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import InputPage from './pages/InputPage';
import PreviewPage from './pages/PreviewPage';
import SendPage from './pages/SendPage';
import { initKakao } from './services/kakao';

function App() {
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    // 카카오 SDK 로드
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.6.0/kakao.min.js';
    script.async = true;
    script.onload = () => {
      const initialized = initKakao();
      setKakaoReady(initialized);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-800">
              월말평가 리포트 시스템
            </h1>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex space-x-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`
                }
              >
                1. 점수 입력
              </NavLink>
              <NavLink
                to="/preview"
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`
                }
              >
                2. 미리보기 / 수정
              </NavLink>
              <NavLink
                to="/send"
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`
                }
              >
                3. 전송
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 py-6">
          {!kakaoReady && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              카카오 SDK 로딩 중...
            </div>
          )}
          <Routes>
            <Route path="/" element={<InputPage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/send" element={<SendPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
