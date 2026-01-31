import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { downloadReportAsPdf } from '../services/pdf';
import { useState } from 'react';
import type { DifficultyGrade } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// 난이도별 색상
const DIFFICULTY_COLORS: Record<DifficultyGrade, string> = {
  'A': '#ef4444', // 빨강
  'B': '#f97316', // 주황
  'C': '#eab308', // 노랑
  'D': '#84cc16', // 연두
  'E': '#22c55e', // 초록
  'F': '#3b82f6', // 파랑
};

export default function PreviewPage() {
  const navigate = useNavigate();
  const { currentReport, currentUser, appSettings, exams, currentYearMonth } = useReportStore();
  const [downloading, setDownloading] = useState(false);

  // 현재 월의 시험 난이도 매핑
  const getExamDifficulty = (subject: string): DifficultyGrade | undefined => {
    const exam = exams.find((e) => e.subject === subject && e.yearMonth === currentYearMonth);
    return exam?.difficulty;
  };

  // 난이도 뱃지 스타일
  const getDifficultyBadgeStyle = (difficulty: DifficultyGrade) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: DIFFICULTY_COLORS[difficulty],
  });

  if (!currentReport) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>미리볼 리포트가 없습니다.</p>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const chartData = currentReport.scores.map((s) => ({
    subject: s.subject,
    score: s.score,
    teacher: s.teacherName,
  }));

  const averageScore = currentReport.scores.length > 0
    ? Math.round(currentReport.scores.reduce((sum, s) => sum + s.score, 0) / currentReport.scores.length)
    : 0;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadReportAsPdf('report-content', `${currentReport.studentName}_${currentReport.yearMonth}_리포트`);
    } catch (error) {
      console.error('PDF download error:', error);
      alert('PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const goBack = () => {
    if (currentUser?.teacher.isAdmin) {
      navigate('/admin');
    } else {
      navigate('/teacher');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* 액션 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            onClick={goBack}
            style={{ padding: '10px 20px', backgroundColor: '#ffffff', color: '#374151', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer' }}
          >
            돌아가기
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              padding: '10px 20px',
              backgroundColor: downloading ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              cursor: downloading ? 'not-allowed' : 'pointer',
            }}
          >
            {downloading ? 'PDF 생성 중...' : 'PDF 다운로드'}
          </button>
        </div>

        {/* 리포트 내용 */}
        <div
          id="report-content"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          {/* 헤더 */}
          <div style={{ backgroundColor: '#1e40af', color: '#ffffff', padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              {/* 로고 또는 플레이스홀더 */}
              {appSettings.academyLogo ? (
                <img
                  src={appSettings.academyLogo}
                  alt="학원 로고"
                  style={{ width: '60px', height: '60px', objectFit: 'contain', borderRadius: '8px', backgroundColor: '#ffffff', padding: '4px' }}
                />
              ) : (
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '2px dashed rgba(255,255,255,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    textAlign: 'center',
                    padding: '4px',
                  }}
                >
                  로고
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>
                  {appSettings.academyName || '학원명'}
                </p>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>월말평가 리포트</h1>
                <p style={{ fontSize: '18px', opacity: 0.9 }}>{currentReport.yearMonth}</p>
              </div>
            </div>
          </div>

          {/* 학생 정보 */}
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
              <div>
                <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>{currentReport.studentName}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#6b7280', marginBottom: '4px' }}>평균 점수</p>
                <p style={{ fontSize: '48px', fontWeight: 'bold', color: '#2563eb' }}>{averageScore}</p>
              </div>
            </div>

            {/* 차트 */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>과목별 점수</h3>
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="subject" />
                    <Tooltip
                      formatter={(value) => [`${value}점`]}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 점수 테이블 */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#374151' }}>상세 점수</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>과목</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>난이도</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>점수</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>담당</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e5e7eb' }}>코멘트</th>
                  </tr>
                </thead>
                <tbody>
                  {currentReport.scores.map((score, index) => {
                    const difficulty = score.difficulty || getExamDifficulty(score.subject);
                    return (
                      <tr key={score.subject} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }} />
                            {score.subject}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {difficulty ? (
                            <span style={getDifficultyBadgeStyle(difficulty)}>
                              {difficulty}
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', fontSize: '18px' }}>
                          {score.score}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{score.teacherName}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>{score.comment || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 종합 코멘트 */}
            {currentReport.totalComment && (
              <div style={{ backgroundColor: '#f0f9ff', borderRadius: '8px', padding: '20px', borderLeft: '4px solid #2563eb' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1e40af' }}>종합 코멘트</h3>
                <p style={{ color: '#374151', lineHeight: '1.6' }}>{currentReport.totalComment}</p>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div style={{ backgroundColor: '#f9fafb', padding: '16px 32px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
            생성일: {new Date().toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  );
}
