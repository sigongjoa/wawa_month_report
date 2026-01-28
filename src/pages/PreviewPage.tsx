import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 테스트용 과거 데이터
const DUMMY_HISTORY = [
  { month: '2025-08', 국어: 72, 영어: 68 },
  { month: '2025-09', 국어: 75, 영어: 72 },
  { month: '2025-10', 국어: 78, 영어: 75 },
  { month: '2025-11', 국어: 80, 영어: 82 },
  { month: '2025-12', 국어: 82, 영어: 85 },
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// oklch 색상을 제거하는 함수
const removeOklchColors = (doc: Document) => {
  // 모든 스타일시트 제거
  const styleSheets = doc.querySelectorAll('style, link[rel="stylesheet"]');
  styleSheets.forEach((el) => el.remove());

  // 모든 요소에 기본 스타일 적용
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const computed = window.getComputedStyle(htmlEl);

    // oklch가 포함된 색상을 기본값으로 대체
    if (computed.color.includes('oklch')) {
      htmlEl.style.color = '#000000';
    }
    if (computed.backgroundColor.includes('oklch')) {
      htmlEl.style.backgroundColor = 'transparent';
    }
    if (computed.borderColor.includes('oklch')) {
      htmlEl.style.borderColor = '#e5e7eb';
    }
  });
};

export default function PreviewPage() {
  const navigate = useNavigate();
  const { currentReport, currentYearMonth } = useReportStore();

  if (!currentReport) {
    return (
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '32px', textAlign: 'center' }}>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>미리볼 리포트가 없습니다.</p>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          점수 입력하러 가기
        </button>
      </div>
    );
  }

  const currentScoreData = currentReport.scores.map((s) => ({
    subject: s.subject,
    score: s.score,
  }));

  const trendData = [
    ...DUMMY_HISTORY.filter((h) =>
      currentReport.scores.some((s) => s.subject in h)
    ),
    {
      month: currentYearMonth,
      ...currentReport.scores.reduce(
        (acc, s) => ({ ...acc, [s.subject]: s.score }),
        {}
      ),
    },
  ];

  const handleDownloadPdf = async () => {
    try {
      const element = document.getElementById('report-preview');
      if (!element) throw new Error('Element not found');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          removeOklchColors(clonedDoc);
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${currentReport.studentName}_${currentYearMonth}_리포트.pdf`);
    } catch (error) {
      console.error('PDF 다운로드 실패:', error);
      alert('PDF 저장에 실패했습니다. 브라우저의 인쇄 기능(Ctrl+P)을 사용해주세요.');
    }
  };

  const handleDownloadImage = async () => {
    try {
      const element = document.getElementById('report-preview');
      if (!element) throw new Error('Element not found');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          removeOklchColors(clonedDoc);
        },
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${currentReport.studentName}_${currentYearMonth}_리포트.png`;
      link.click();
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  const formatMonth = (month: string) => {
    const [, m] = month.split('-');
    return `${parseInt(m)}월`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 컨트롤 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', backgroundColor: '#ffffff', cursor: 'pointer' }}
        >
          ← 수정하기
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleDownloadImage}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', backgroundColor: '#ffffff', cursor: 'pointer' }}
          >
            이미지 저장
          </button>
          <button
            onClick={handleDownloadPdf}
            style={{ padding: '8px 16px', border: '1px solid #3b82f6', borderRadius: '8px', color: '#3b82f6', backgroundColor: '#ffffff', cursor: 'pointer' }}
          >
            PDF 저장
          </button>
          <button
            onClick={() => navigate('/send')}
            style={{ padding: '8px 16px', borderRadius: '8px', color: '#ffffff', backgroundColor: '#2563eb', border: 'none', cursor: 'pointer' }}
          >
            전송하기 →
          </button>
        </div>
      </div>

      {/* 리포트 미리보기 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          id="report-preview"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            padding: '32px',
            width: '100%',
            maxWidth: '672px',
            minHeight: '800px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#000000',
          }}
        >
          {/* 헤더 */}
          <div style={{ textAlign: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '24px', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 8px 0' }}>
              월말 학습 리포트
            </h1>
            <p style={{ color: '#6b7280', margin: 0 }}>
              {currentYearMonth.replace('-', '년 ')}월
            </p>
          </div>

          {/* 학생 정보 */}
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>학생</span>
                <p style={{ fontSize: '20px', fontWeight: '600', margin: '4px 0 0 0', color: '#000000' }}>
                  {currentReport.studentName}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>수강 과목</span>
                <p style={{ fontSize: '14px', margin: '4px 0 0 0', color: '#000000' }}>
                  {currentReport.scores.map((s) => s.subject).join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* 이번 달 성적 */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#000000', margin: '0 0 16px 0' }}>
              <span>📊</span> 이번 달 성적
            </h2>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentScoreData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} stroke="#374151" />
                  <YAxis type="category" dataKey="subject" width={60} stroke="#374151" />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 성적 추이 */}
          {trendData.length > 1 && (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#000000', margin: '0 0 16px 0' }}>
                <span>📈</span> 성적 추이
              </h2>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} stroke="#374151" />
                    <YAxis domain={[0, 100]} stroke="#374151" />
                    <Tooltip labelFormatter={(label) => formatMonth(label as string)} />
                    <Legend />
                    {currentReport.scores.map((s, i) => (
                      <Line
                        key={s.subject}
                        type="monotone"
                        dataKey={s.subject}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 점수 요약 */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#000000', margin: '0 0 16px 0' }}>
              <span>📋</span> 점수 요약
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {currentReport.scores.map((s, i) => (
                <div key={s.subject} style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '500', color: '#000000' }}>{s.subject}</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: COLORS[i % COLORS.length] }}>
                    {s.score}점
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 선생님 코멘트 */}
          {currentReport.comment && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#000000', margin: '0 0 16px 0' }}>
                <span>💬</span> 선생님 코멘트
              </h2>
              <div style={{ backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '16px', borderRadius: '0 8px 8px 0' }}>
                <p style={{ color: '#374151', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {currentReport.comment}
                </p>
              </div>
            </div>
          )}

          {/* 푸터 */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px', marginTop: '32px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' }}>
            발행일: {new Date().toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  );
}
