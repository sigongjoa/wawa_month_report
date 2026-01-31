import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReportStore } from '../stores/reportStore';
import { fetchStudents, updateStudent, updateStudentExamDates } from '../services/notion';
import type { Student } from '../types';

type TabType = 'today' | 'absent' | 'upcoming';

const ABSENCE_REASONS = ['병결', '개인 사정', '학교 행사', '가족 행사', '기타'];

export default function ExamSchedulePage() {
  const navigate = useNavigate();
  const { currentUser, students, setStudents } = useReportStore();

  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // 결시 처리 모달
  const [absenceModal, setAbsenceModal] = useState<Student | null>(null);
  const [newExamDate, setNewExamDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // 일괄 날짜 지정 모달
  const [bulkDateModal, setBulkDateModal] = useState(false);
  const [bulkDate, setBulkDate] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStudents();
      setStudents(data);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser?.teacher.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>관리자만 접근할 수 있습니다.</p>
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

  // 오늘 시험 학생
  const todayStudents = students.filter(s => s.examDate === today && s.status !== 'inactive');

  // 결시/미지정 학생 (시험일 없거나 지난 날짜)
  const absentStudents = students.filter(s => {
    if (s.status === 'inactive') return false;
    if (!s.examDate) return true;
    return s.examDate < today;
  });

  // 예정 학생 (미래 날짜)
  const upcomingStudents = students.filter(s => {
    if (s.status === 'inactive') return false;
    return s.examDate && s.examDate > today;
  });

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (studentList: Student[]) => {
    const allIds = studentList.map(s => s.id);
    const allSelected = allIds.every(id => selectedStudents.has(id));

    if (allSelected) {
      setSelectedStudents(prev => {
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedStudents(prev => new Set([...prev, ...allIds]));
    }
  };

  const openAbsenceModal = (student: Student) => {
    setAbsenceModal(student);
    setNewExamDate('');
    setAbsenceReason('');
    setCustomReason('');
  };

  const handleSaveAbsence = async () => {
    if (!absenceModal) return;

    setIsLoading(true);
    try {
      const reason = absenceReason === '기타' ? customReason : absenceReason;
      const success = await updateStudent(absenceModal.id, {
        examDate: newExamDate || undefined,
        absenceReason: reason || undefined,
      });

      if (success) {
        setStudents(students.map(s =>
          s.id === absenceModal.id
            ? { ...s, examDate: newExamDate || undefined, absenceReason: reason || undefined }
            : s
        ));
        setAbsenceModal(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDateChange = async () => {
    if (selectedStudents.size === 0 || !bulkDate) {
      alert('학생과 날짜를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const success = await updateStudentExamDates(Array.from(selectedStudents), bulkDate);
      if (success) {
        setStudents(students.map(s =>
          selectedStudents.has(s.id) ? { ...s, examDate: bulkDate } : s
        ));
        setSelectedStudents(new Set());
        setBulkDateModal(false);
        setBulkDate('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDateSet = async (studentId: string, date: string) => {
    setIsLoading(true);
    try {
      const success = await updateStudent(studentId, { examDate: date });
      if (success) {
        setStudents(students.map(s =>
          s.id === studentId ? { ...s, examDate: date } : s
        ));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 24px',
    backgroundColor: isActive ? '#ffffff' : 'transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    border: 'none',
    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const renderStudentList = (studentList: Student[], showAbsence: boolean = false) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <th style={{ padding: '14px 16px', textAlign: 'center', width: '50px' }}>
            <input
              type="checkbox"
              checked={studentList.length > 0 && studentList.every(s => selectedStudents.has(s.id))}
              onChange={() => handleSelectAll(studentList)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>이름</th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>학년</th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>수강과목</th>
          <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>시험일</th>
          {showAbsence && (
            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>결시사유</th>
          )}
          <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>관리</th>
        </tr>
      </thead>
      <tbody>
        {studentList.length === 0 ? (
          <tr>
            <td colSpan={showAbsence ? 7 : 6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              해당하는 학생이 없습니다.
            </td>
          </tr>
        ) : (
          studentList.map((student, idx) => (
            <tr key={student.id} style={{ borderBottom: idx < studentList.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedStudents.has(student.id)}
                  onChange={() => handleSelectStudent(student.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </td>
              <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1f2937' }}>{student.name}</td>
              <td style={{ padding: '14px 16px', color: '#6b7280' }}>{student.grade}</td>
              <td style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {student.subjects.map(sub => (
                    <span
                      key={sub}
                      style={{
                        padding: '2px 8px',
                        backgroundColor: '#e0e7ff',
                        color: '#4338ca',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </td>
              <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                {student.examDate || (
                  <span style={{ color: '#dc2626' }}>미지정</span>
                )}
              </td>
              {showAbsence && (
                <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                  {student.absenceReason || '-'}
                </td>
              )}
              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {activeTab === 'today' ? (
                    <button
                      onClick={() => openAbsenceModal(student)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      결시 처리
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleQuickDateSet(student.id, today)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        오늘로
                      </button>
                      <button
                        onClick={() => openAbsenceModal(student)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        날짜 변경
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* 헤더 */}
      <header style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>시험 일정 관리</h1>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>오늘: {today}</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            돌아가기
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div
            onClick={() => setActiveTab('today')}
            style={{
              backgroundColor: activeTab === 'today' ? '#eff6ff' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'today' ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>오늘 시험</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{todayStudents.length}명</p>
          </div>
          <div
            onClick={() => setActiveTab('absent')}
            style={{
              backgroundColor: activeTab === 'absent' ? '#fef2f2' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'absent' ? '2px solid #dc2626' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>결시/미지정</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{absentStudents.length}명</p>
          </div>
          <div
            onClick={() => setActiveTab('upcoming')}
            style={{
              backgroundColor: activeTab === 'upcoming' ? '#f0fdf4' : '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              border: activeTab === 'upcoming' ? '2px solid #16a34a' : '2px solid transparent',
            }}
          >
            <p style={{ color: '#6b7280', fontSize: '14px' }}>예정 학생</p>
            <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>{upcomingStudents.length}명</p>
          </div>
        </div>

        {/* 일괄 처리 버튼 */}
        {selectedStudents.size > 0 && (
          <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#854d0e', fontWeight: '500' }}>
                {selectedStudents.size}명 선택됨
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setSelectedStudents(new Set())}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  선택 해제
                </button>
                <button
                  onClick={() => setBulkDateModal(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  일괄 날짜 지정
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px 12px 0 0', display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <button style={tabStyle(activeTab === 'today')} onClick={() => setActiveTab('today')}>
            오늘 시험
            <span style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {todayStudents.length}
            </span>
          </button>
          <button style={tabStyle(activeTab === 'absent')} onClick={() => setActiveTab('absent')}>
            결시/미지정
            <span style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {absentStudents.length}
            </span>
          </button>
          <button style={tabStyle(activeTab === 'upcoming')} onClick={() => setActiveTab('upcoming')}>
            예정 학생
            <span style={{
              backgroundColor: '#16a34a',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
            }}>
              {upcomingStudents.length}
            </span>
          </button>
        </div>

        {/* 학생 목록 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {activeTab === 'today' && renderStudentList(todayStudents)}
          {activeTab === 'absent' && renderStudentList(absentStudents, true)}
          {activeTab === 'upcoming' && renderStudentList(upcomingStudents)}
        </div>
      </main>

      {/* 결시/날짜변경 모달 */}
      {absenceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setAbsenceModal(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
              {absenceModal.name} ({absenceModal.grade})
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              {activeTab === 'today' ? '결시 처리' : '시험일 변경'}
            </p>

            {/* 새 시험일 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                새 시험일
              </label>
              <input
                type="date"
                value={newExamDate}
                onChange={(e) => setNewExamDate(e.target.value)}
                min={today}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 결시 사유 */}
            {activeTab === 'today' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                  결시 사유
                </label>
                <select
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    marginBottom: absenceReason === '기타' ? '12px' : 0,
                  }}
                >
                  <option value="">선택하세요</option>
                  {ABSENCE_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                {absenceReason === '기타' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="사유 입력"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            )}

            {/* 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setAbsenceModal(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSaveAbsence}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 날짜 지정 모달 */}
      {bulkDateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setBulkDateModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
              일괄 시험일 지정
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              {selectedStudents.size}명의 학생에게 동일한 시험일을 지정합니다.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                시험일
              </label>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                min={today}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setBulkDateModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleBulkDateChange}
                disabled={isLoading || !bulkDate}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isLoading || !bulkDate ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading || !bulkDate ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {isLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
