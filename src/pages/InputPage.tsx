import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import type { Student, Score } from '../types';

// 테스트용 더미 데이터 (Notion API CORS 문제로 임시 사용)
const DUMMY_STUDENTS: Student[] = [
  { id: '1', name: '김철수', subjects: ['국어', '영어', '수학'], grade: '중1', status: '재원' },
  { id: '2', name: '이영희', subjects: ['국어', '영어'], grade: '중2', status: '재원' },
  { id: '3', name: '박민수', subjects: ['수학', '과학'], grade: '고1', status: '재원' },
  { id: '4', name: '최지원', subjects: ['국어', '영어', '수학', '과학'], grade: '중3', status: '재원' },
  { id: '5', name: '정다은', subjects: ['영어'], grade: '초6', status: '재원' },
];

export default function InputPage() {
  const navigate = useNavigate();
  const {
    students,
    setStudents,
    selectedStudent,
    setSelectedStudent,
    currentYearMonth,
    setCurrentYearMonth,
    setCurrentReport,
  } = useReportStore();

  const [scores, setScores] = useState<Score[]>([]);
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 학생 목록 로드
  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      setError(null);
      try {
        // Notion API는 CORS 문제로 브라우저에서 직접 호출 불가
        // 실제 사용시 프록시 서버나 Electron main process 필요
        // 여기서는 더미 데이터 사용
        setStudents(DUMMY_STUDENTS);
      } catch (err) {
        setError('학생 목록을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (students.length === 0) {
      loadStudents();
    }
  }, [students.length, setStudents]);

  // 학생 선택시 점수 입력 필드 초기화
  useEffect(() => {
    if (selectedStudent) {
      setScores(
        selectedStudent.subjects.map((subject) => ({
          subject,
          score: 0,
        }))
      );
      setComment('');
    }
  }, [selectedStudent]);

  // 검색 필터링
  const filteredStudents = students.filter((student) =>
    student.name.includes(searchTerm) ||
    student.grade?.includes(searchTerm) ||
    student.subjects.some((s) => s.includes(searchTerm))
  );

  // 점수 변경 핸들러
  const handleScoreChange = (subject: string, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    setScores((prev) =>
      prev.map((s) => (s.subject === subject ? { ...s, score: numValue } : s))
    );
  };

  // 미리보기로 이동
  const handlePreview = () => {
    if (!selectedStudent) {
      alert('학생을 선택해주세요.');
      return;
    }

    if (scores.every((s) => s.score === 0)) {
      alert('점수를 입력해주세요.');
      return;
    }

    setCurrentReport({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      yearMonth: currentYearMonth,
      scores,
      comment,
    });

    navigate('/preview');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 왼쪽: 학생 목록 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">학생 선택</h2>
          <input
            type="month"
            value={currentYearMonth}
            onChange={(e) => setCurrentYearMonth(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          />
        </div>

        {/* 검색 */}
        <input
          type="text"
          placeholder="학생 이름, 학년, 과목 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && (
          <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 학생 리스트 */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              학생이 없습니다.
            </div>
          ) : (
            filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedStudent?.id === student.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{student.name}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      {student.grade}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      student.status === '재원'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {student.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {student.subjects.map((subject) => (
                    <span
                      key={subject}
                      className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 오른쪽: 점수 입력 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">
          점수 입력
          {selectedStudent && (
            <span className="ml-2 text-blue-600">({selectedStudent.name})</span>
          )}
        </h2>

        {!selectedStudent ? (
          <div className="text-center py-16 text-gray-500">
            왼쪽에서 학생을 선택해주세요.
          </div>
        ) : (
          <div className="space-y-6">
            {/* 과목별 점수 입력 */}
            <div className="space-y-4">
              {scores.map(({ subject, score }) => (
                <div key={subject} className="flex items-center gap-4">
                  <label className="w-16 text-sm font-medium text-gray-700">
                    {subject}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={score || ''}
                    onChange={(e) => handleScoreChange(subject, e.target.value)}
                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <span className="text-gray-500">/ 100</span>
                </div>
              ))}
            </div>

            {/* 코멘트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                선생님 코멘트
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="학생에 대한 한줄 코멘트를 입력하세요..."
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setScores([]);
                  setComment('');
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                초기화
              </button>
              <button
                onClick={handlePreview}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                미리보기 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
