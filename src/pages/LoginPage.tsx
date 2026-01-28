import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchTeachers } from '../services/notion';

export default function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, teachers, setTeachers } = useReportStore();

  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 이미 로그인되어 있으면 이동
    if (currentUser) {
      if (currentUser.teacher.isAdmin) {
        navigate('/admin');
      } else {
        navigate('/teacher');
      }
      return;
    }

    // 선생님 목록 로드
    const loadTeachers = async () => {
      const data = await fetchTeachers();
      setTeachers(data);
      setLoading(false);
    };
    loadTeachers();
  }, [currentUser, navigate, setTeachers]);

  const handleLogin = () => {
    setError('');

    const teacher = teachers.find((t) => t.id === selectedTeacher);
    if (!teacher) {
      setError('선생님을 선택해주세요.');
      return;
    }

    if (teacher.pin !== pin) {
      setError('PIN이 올바르지 않습니다.');
      return;
    }

    setCurrentUser({
      teacher,
      loginAt: new Date().toISOString(),
    });

    if (teacher.isAdmin) {
      navigate('/admin');
    } else {
      navigate('/teacher');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            월말평가 리포트
          </h1>
          <p style={{ color: '#6b7280' }}>선생님 로그인</p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
            선생님 선택
          </label>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '16px',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="">선택하세요</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.subject}) {teacher.isAdmin && '- 관리자'}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
            PIN 번호
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4자리 숫자"
            maxLength={4}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '24px',
              textAlign: 'center',
              letterSpacing: '8px',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '16px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          로그인
        </button>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>
          목업 PIN: 관리자(1234), 영어(2345), 국어(3456), 과학(4567)
        </p>
      </div>
    </div>
  );
}
