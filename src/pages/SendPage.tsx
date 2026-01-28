import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import {
  kakaoLogin,
  kakaoLogout,
  checkKakaoLogin,
  sendKakaoMessageToMe,
  restoreAccessToken,
} from '../services/kakao';

export default function SendPage() {
  const navigate = useNavigate();
  const { currentReport, addSendHistory } = useReportStore();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sendFormat, setSendFormat] = useState<'pdf' | 'image'>('image');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 페이지 로드시 로그인 상태 확인 (토큰 자동 갱신)
  useEffect(() => {
    const checkLogin = async () => {
      await restoreAccessToken();
      setIsLoggedIn(checkKakaoLogin());
    };
    checkLogin();
  }, []);

  const handleKakaoLogin = async () => {
    setIsLoggingIn(true);
    try {
      const token = await kakaoLogin();
      if (token) {
        setIsLoggedIn(true);
      } else {
        alert('카카오 로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('카카오 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKakaoLogout = async () => {
    await kakaoLogout();
    setIsLoggedIn(false);
  };

  const handleSendToMe = async () => {
    if (!currentReport) {
      alert('전송할 리포트가 없습니다.');
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const title = `${currentReport.studentName} - ${currentReport.yearMonth} 월말평가`;
      const description = currentReport.scores
        .map((s) => `${s.subject}: ${s.score}점`)
        .join('\n');

      const success = await sendKakaoMessageToMe(title, description);

      if (success) {
        addSendHistory({
          studentId: currentReport.studentId,
          studentName: currentReport.studentName,
          reportId: '',
          recipientName: '나에게 보내기',
          sentAt: new Date().toISOString(),
          status: 'success',
        });
        setSendResult({ success: true, message: '카카오톡으로 전송되었습니다!' });
      } else {
        setSendResult({ success: false, message: '전송에 실패했습니다. 다시 로그인해주세요.' });
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Send error:', error);
      setSendResult({ success: false, message: '전송 중 오류가 발생했습니다.' });
    } finally {
      setSending(false);
    }
  };

  if (!currentReport) {
    return (
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '32px', textAlign: 'center' }}>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>전송할 리포트가 없습니다.</p>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          점수 입력하러 가기
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 왼쪽: 전송 설정 */}
      <div className="space-y-6">
        {/* 리포트 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">전송할 리포트</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="font-medium text-lg">{currentReport.studentName}</p>
                <p className="text-gray-500 text-sm">{currentReport.yearMonth}</p>
              </div>
              <button
                onClick={() => navigate('/preview')}
                style={{ color: '#2563eb', fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                미리보기
              </button>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {currentReport.scores.map((s) => (
                <span
                  key={s.subject}
                  style={{ padding: '4px 12px', backgroundColor: '#ffffff', borderRadius: '9999px', fontSize: '14px', border: '1px solid #e5e7eb' }}
                >
                  {s.subject}: {s.score}점
                </span>
              ))}
            </div>
            {currentReport.comment && (
              <p style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
                "{currentReport.comment}"
              </p>
            )}
          </div>
        </div>

        {/* 전송 형식 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">전송 형식</h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ flex: 1, cursor: 'pointer' }}>
              <input
                type="radio"
                name="format"
                value="image"
                checked={sendFormat === 'image'}
                onChange={() => setSendFormat('image')}
                style={{ display: 'none' }}
              />
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `2px solid ${sendFormat === 'image' ? '#3b82f6' : '#e5e7eb'}`,
                  backgroundColor: sendFormat === 'image' ? '#eff6ff' : '#ffffff',
                }}
              >
                <p className="font-medium">텍스트 메시지</p>
                <p className="text-sm text-gray-500" style={{ marginTop: '4px' }}>
                  점수 요약을 텍스트로 전송
                </p>
              </div>
            </label>
            <label style={{ flex: 1, cursor: 'pointer' }}>
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={sendFormat === 'pdf'}
                onChange={() => setSendFormat('pdf')}
                style={{ display: 'none' }}
              />
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `2px solid ${sendFormat === 'pdf' ? '#3b82f6' : '#e5e7eb'}`,
                  backgroundColor: sendFormat === 'pdf' ? '#eff6ff' : '#ffffff',
                }}
              >
                <p className="font-medium">이미지 (준비중)</p>
                <p className="text-sm text-gray-500" style={{ marginTop: '4px' }}>
                  리포트 이미지 첨부
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 카카오 로그인 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">카카오톡 연동</h2>
          {isLoggedIn ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  <div>
                    <p style={{ fontWeight: '500', color: '#166534' }}>로그인됨</p>
                    <p style={{ fontSize: '14px', color: '#16a34a' }}>
                      카카오톡 전송 가능
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleKakaoLogout}
                  style={{ padding: '6px 12px', fontSize: '14px', color: '#4b5563', cursor: 'pointer', background: 'none', border: 'none' }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleKakaoLogin}
              disabled={isLoggingIn}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isLoggingIn ? '#fde68a' : '#facc15',
                color: '#1f2937',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isLoggingIn ? (
                '로그인 중...'
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 0C4.477 0 0 3.582 0 8c0 2.864 1.9 5.372 4.757 6.778-.21.792-.76 2.87-.87 3.313-.134.534.196.526.41.383.17-.112 2.697-1.826 3.79-2.57.618.094 1.257.143 1.913.143 5.523 0 10-3.582 10-8S15.523 0 10 0z" />
                  </svg>
                  카카오 로그인
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 오른쪽: 전송 버튼 */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">전송하기</h2>

          {sendResult && (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '16px',
                backgroundColor: sendResult.success ? '#f0fdf4' : '#fef2f2',
                color: sendResult.success ? '#166534' : '#991b1b',
              }}
            >
              {sendResult.message}
            </div>
          )}

          <button
            onClick={handleSendToMe}
            disabled={!isLoggedIn || sending}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isLoggedIn && !sending ? '#2563eb' : '#d1d5db',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '500',
              fontSize: '16px',
              cursor: isLoggedIn && !sending ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
          >
            {sending ? '전송 중...' : '📤 나에게 테스트 전송'}
          </button>

          <p className="text-sm text-gray-500" style={{ marginTop: '16px', textAlign: 'center' }}>
            카카오톡 "나와의 채팅"으로 메시지가 전송됩니다.
          </p>
        </div>

        {/* 전송 이력 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">전송 이력</h2>
          <div className="space-y-2">
            {useReportStore.getState().sendHistories.length === 0 ? (
              <p className="text-gray-500 text-center" style={{ padding: '32px 0' }}>
                전송 이력이 없습니다.
              </p>
            ) : (
              useReportStore.getState().sendHistories.map((history, index) => (
                <div
                  key={index}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}
                >
                  <div>
                    <p className="font-medium">{history.studentName}</p>
                    <p className="text-sm text-gray-500">
                      → {history.recipientName}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{ fontSize: '14px', color: history.status === 'success' ? '#16a34a' : '#dc2626' }}
                    >
                      {history.status === 'success' ? '✓ 전송완료' : '✗ 실패'}
                    </span>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {new Date(history.sentAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
