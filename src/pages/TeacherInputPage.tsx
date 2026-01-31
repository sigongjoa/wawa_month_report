import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchStudents, fetchExams, saveScore } from '../services/notion';
import type { SubjectScore, DifficultyGrade } from '../types';

// 난이도별 색상
const DIFFICULTY_COLORS: Record<DifficultyGrade, string> = {
  'A': '#ef4444',
  'B': '#f97316',
  'C': '#eab308',
  'D': '#84cc16',
  'E': '#22c55e',
  'F': '#3b82f6',
};

const DIFFICULTY_LABELS: Record<DifficultyGrade, string> = {
  'A': '최상',
  'B': '상',
  'C': '중',
  'D': '중하',
  'E': '하',
  'F': '기초',
};

export default function TeacherInputPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    logout,
    students,
    setStudents,
    reports,
    updateReport,
    addReport,
    currentYearMonth,
    setCurrentYearMonth,
    exams,
    setExams,
  } = useReportStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  // 선생님이 여러 과목을 가르칠 경우 선택된 과목
  const [selectedSubject, setSelectedSubject] = useState('');

  // 현재 선택된 과목을 수강하는 학생들의 점수
  const [studentScores, setStudentScores] = useState<Map<string, { score: number; comment: string }>>(new Map());

  const teacherSubjects = currentUser?.teacher.subjects || [];

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    // 첫 번째 과목을 기본 선택
    if (teacherSubjects.length > 0 && !selectedSubject) {
      setSelectedSubject(teacherSubjects[0]);
    }

    const loadData = async () => {
      const [studentsData, examsData] = await Promise.all([
        fetchStudents(),
        fetchExams(),
      ]);
      setStudents(studentsData);
      setExams(examsData);
      setLoading(false);
    };

    loadData();
  }, [currentUser, navigate, setStudents, setExams, teacherSubjects.length]);

  // 선택된 과목이 바뀌면 점수 데이터 다시 로드
  useEffect(() => {
    if (!selectedSubject || students.length === 0) return;

    const filtered = students.filter((s) => s.subjects.includes(selectedSubject));
    const scoreMap = new Map<string, { score: number; comment: string }>();

    filtered.forEach((student) => {
      const report = reports.find(
        (r) => r.studentId === student.id && r.yearMonth === currentYearMonth
      );
      const existingScore = report?.scores.find((s) => s.subject === selectedSubject);

      scoreMap.set(student.id, {
        score: existingScore?.score ?? 0,
        comment: existingScore?.comment ?? '',
      });
    });

    setStudentScores(scoreMap);
  }, [selectedSubject, students, reports, currentYearMonth]);

  const myStudents = students.filter((s) => s.subjects.includes(selectedSubject));

  // 현재 월의 내 과목 시험 정보
  const currentExam = exams.find(
    (e) => e.subject === selectedSubject && e.yearMonth === currentYearMonth
  );

  const handleScoreChange = (studentId: string, score: number) => {
    setStudentScores((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(studentId) || { score: 0, comment: '' };
      newMap.set(studentId, { ...existing, score: Math.max(0, Math.min(100, score)) });
      return newMap;
    });
  };

  const handleCommentChange = (studentId: string, comment: string) => {
    setStudentScores((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(studentId) || { score: 0, comment: '' };
      newMap.set(studentId, { ...existing, comment });
      return newMap;
    });
  };

  const handleSaveAll = async () => {
    if (!currentUser) return;

    setSaving(true);
    setSavedMessage('');

    try {
      let savedCount = 0;

      for (const student of myStudents) {
        const scoreData = studentScores.get(student.id);
        if (!scoreData || scoreData.score === 0) continue;

        // Notion DB에 저장
        const success = await saveScore(
          student.id,
          student.name,
          currentYearMonth,
          selectedSubject,
          scoreData.score,
          currentUser.teacher.id,
          scoreData.comment
        );

        if (success) {
          savedCount++;

          // 로컬 상태도 업데이트
          const newScore: SubjectScore = {
            subject: selectedSubject,
            score: scoreData.score,
            teacherId: currentUser.teacher.id,
            teacherName: currentUser.teacher.name,
            comment: scoreData.comment,
            updatedAt: new Date().toISOString(),
          };

          let report = reports.find(
            (r) => r.studentId === student.id && r.yearMonth === currentYearMonth
          );

          if (report) {
            const existingScoreIndex = report.scores.findIndex((s) => s.subject === selectedSubject);
            const newScores = [...report.scores];

            if (existingScoreIndex >= 0) {
              newScores[existingScoreIndex] = newScore;
            } else {
              newScores.push(newScore);
            }

            updateReport({
              ...report,
              scores: newScores,
              updatedAt: new Date().toISOString(),
            });
          } else {
            addReport({
              id: `${student.id}-${currentYearMonth}`,
              studentId: student.id,
              studentName: student.name,
              yearMonth: currentYearMonth,
              scores: [newScore],
              status: 'draft',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      setSavedMessage(`${savedCount}명 저장 완료!`);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Save error:', error);
      setSavedMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!currentUser) return null;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
              {currentUser.teacher.name} 선생님
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              담당 과목: {teacherSubjects.join(', ')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* 과목 선택 (여러 과목 담당 시) */}
            {teacherSubjects.length > 1 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontWeight: '500' }}
              >
                {teacherSubjects.map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>
            )}
            <input
              type="month"
              value={currentYearMonth}
              onChange={(e) => setCurrentYearMonth(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
            <button
              onClick={handleLogout}
              style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
                {currentYearMonth} {selectedSubject} 점수 입력
              </h2>
              {currentExam && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#ffffff',
                      backgroundColor: DIFFICULTY_COLORS[currentExam.difficulty],
                    }}
                  >
                    난이도 {currentExam.difficulty}
                  </span>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    ({DIFFICULTY_LABELS[currentExam.difficulty]})
                  </span>
                  {currentExam.scope && (
                    <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                      | 범위: {currentExam.scope}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {savedMessage && (
                <span style={{ color: savedMessage.includes('오류') ? '#dc2626' : '#16a34a', fontSize: '14px' }}>
                  {savedMessage}
                </span>
              )}
              <button
                onClick={handleSaveAll}
                disabled={saving}
                style={{
                  padding: '10px 24px',
                  backgroundColor: saving ? '#93c5fd' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '저장 중...' : '전체 저장'}
              </button>
            </div>
          </div>

          {myStudents.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              {selectedSubject} 과목을 수강하는 학생이 없습니다.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학생</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학년</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: '600', color: '#374151', width: '120px' }}>점수</th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>코멘트</th>
                </tr>
              </thead>
              <tbody>
                {myStudents.map((student) => {
                  const scoreData = studentScores.get(student.id) || { score: 0, comment: '' };
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontWeight: '500' }}>{student.name}</span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#6b7280' }}>{student.grade}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={scoreData.score || ''}
                          onChange={(e) => handleScoreChange(student.id, parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          style={{
                            width: '80px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            textAlign: 'center',
                            fontSize: '16px',
                          }}
                        />
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <input
                          type="text"
                          value={scoreData.comment}
                          onChange={(e) => handleCommentChange(student.id, e.target.value)}
                          placeholder="한줄 코멘트"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
