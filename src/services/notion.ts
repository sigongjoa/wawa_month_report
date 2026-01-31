import type { Teacher, Student, MonthlyReport, SubjectScore, Exam, DifficultyGrade, AppSettings } from '../types';

// localStorage에서 앱 설정 가져오기
const getAppSettings = (): Partial<AppSettings> => {
  try {
    const stored = localStorage.getItem('wawa-report-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.appSettings || {};
    }
  } catch (e) {
    console.warn('Failed to parse app settings:', e);
  }
  return {};
};

// API Key 가져오기 (앱 설정 우선, 환경변수 폴백)
const getApiKey = (): string => {
  const settings = getAppSettings();
  return settings.notionApiKey || import.meta.env.VITE_NOTION_API_KEY || '';
};

// Notion DB IDs (앱 설정 우선, 환경변수 폴백)
const getDbIds = () => {
  const settings = getAppSettings();
  return {
    teachers: settings.notionTeachersDb || import.meta.env.VITE_NOTION_TEACHERS_DB || '',
    students: settings.notionStudentsDb || import.meta.env.VITE_NOTION_STUDENTS_DB || '',
    scores: settings.notionScoresDb || import.meta.env.VITE_NOTION_SCORES_DB || '',
    exams: settings.notionExamsDb || import.meta.env.VITE_NOTION_EXAMS_DB || '',
  };
};

// Notion API 호출 헬퍼
const notionFetch = async (endpoint: string, options: RequestInit = {}, apiKey?: string) => {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('Notion API Key가 설정되지 않았습니다.');
  }

  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Notion API error:', error);
    throw new Error(error.message || 'Notion API error');
  }

  return response.json();
};

// ============ 연결 테스트 ============

interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    teachers?: boolean;
    students?: boolean;
    scores?: boolean;
    exams?: boolean;
  };
}

export const testNotionConnection = async (
  apiKey: string,
  dbIds: { teachers?: string; students?: string; scores?: string; exams?: string }
): Promise<ConnectionTestResult> => {
  const details: ConnectionTestResult['details'] = {};
  const errors: string[] = [];

  // API Key 테스트 (users/me 호출)
  try {
    await notionFetch('/users/me', { method: 'GET' }, apiKey);
  } catch {
    return {
      success: false,
      message: 'API Key가 유효하지 않습니다. Integration을 확인해주세요.',
    };
  }

  // 각 DB 연결 테스트
  const testDb = async (name: string, dbId?: string): Promise<boolean> => {
    if (!dbId) return false;
    try {
      await notionFetch(`/databases/${dbId}`, { method: 'GET' }, apiKey);
      return true;
    } catch {
      errors.push(`${name} DB`);
      return false;
    }
  };

  details.teachers = await testDb('선생님', dbIds.teachers);
  details.students = await testDb('학생', dbIds.students);
  details.scores = await testDb('점수', dbIds.scores);
  details.exams = await testDb('시험지', dbIds.exams);

  const connectedCount = Object.values(details).filter(Boolean).length;

  if (errors.length > 0) {
    return {
      success: connectedCount > 0,
      message: connectedCount > 0
        ? `일부 연결 성공 (${connectedCount}/4). 실패: ${errors.join(', ')} - DB를 Integration에 연결했는지 확인하세요.`
        : `연결 실패: ${errors.join(', ')} - DB를 Integration에 연결했는지 확인하세요.`,
      details,
    };
  }

  return {
    success: true,
    message: `모든 데이터베이스 연결 성공! (${connectedCount}개)`,
    details,
  };
};

// ============ 선생님 ============

export const fetchTeachers = async (): Promise<Teacher[]> => {
  const dbIds = getDbIds();
  if (!dbIds.teachers) {
    console.warn('Teachers DB ID not configured');
    return getMockTeachers();
  }

  try {
    const data = await notionFetch(`/databases/${dbIds.teachers}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return data.results.map((page: any) => ({
      id: page.id,
      name: page.properties['이름']?.title?.[0]?.plain_text || '',
      subject: page.properties['과목']?.select?.name || '',
      pin: page.properties['PIN']?.rich_text?.[0]?.plain_text || '0000',
      isAdmin: page.properties['관리자']?.checkbox || false,
    }));
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    return getMockTeachers();
  }
};

// ============ 학생 CRUD ============

export const fetchStudents = async (): Promise<Student[]> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    return getMockStudents();
  }

  try {
    const data = await notionFetch(`/databases/${dbIds.students}/query`, {
      method: 'POST',
      body: JSON.stringify({
        sorts: [{ property: '이름', direction: 'ascending' }],
      }),
    });

    return data.results.map((page: any) => ({
      id: page.id,
      name: page.properties['이름']?.title?.[0]?.plain_text || '',
      grade: page.properties['학년']?.select?.name || '',
      subjects: page.properties['수강과목']?.multi_select?.map((s: any) => s.name) || [],
      parentName: page.properties['학부모']?.rich_text?.[0]?.plain_text || '',
      examDate: page.properties['시험일']?.date?.start || undefined,
      status: page.properties['상태']?.select?.name === '비활성' ? 'inactive' : 'active',
      absenceReason: page.properties['결시사유']?.rich_text?.[0]?.plain_text || undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return getMockStudents();
  }
};

// 학생 생성
export const createStudent = async (student: Omit<Student, 'id'>): Promise<Student | null> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    // 목업 모드: 임시 ID 생성하여 반환
    return {
      ...student,
      id: `mock-${Date.now()}`,
    };
  }

  try {
    const properties: any = {
      '이름': { title: [{ text: { content: student.name } }] },
      '학년': { select: { name: student.grade } },
      '수강과목': { multi_select: student.subjects.map(s => ({ name: s })) },
    };

    if (student.parentName) {
      properties['학부모'] = { rich_text: [{ text: { content: student.parentName } }] };
    }
    if (student.examDate) {
      properties['시험일'] = { date: { start: student.examDate } };
    }
    if (student.status) {
      properties['상태'] = { select: { name: student.status === 'inactive' ? '비활성' : '활성' } };
    }
    if (student.absenceReason) {
      properties['결시사유'] = { rich_text: [{ text: { content: student.absenceReason } }] };
    }

    const data = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: dbIds.students },
        properties,
      }),
    });

    return {
      id: data.id,
      name: student.name,
      grade: student.grade,
      subjects: student.subjects,
      parentName: student.parentName,
      examDate: student.examDate,
      status: student.status,
      absenceReason: student.absenceReason,
    };
  } catch (error) {
    console.error('Failed to create student:', error);
    return null;
  }
};

// 학생 수정
export const updateStudent = async (studentId: string, updates: Partial<Student>): Promise<boolean> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    return true; // 목업 모드
  }

  try {
    const properties: any = {};

    if (updates.name !== undefined) {
      properties['이름'] = { title: [{ text: { content: updates.name } }] };
    }
    if (updates.grade !== undefined) {
      properties['학년'] = { select: { name: updates.grade } };
    }
    if (updates.subjects !== undefined) {
      properties['수강과목'] = { multi_select: updates.subjects.map(s => ({ name: s })) };
    }
    if (updates.parentName !== undefined) {
      properties['학부모'] = { rich_text: [{ text: { content: updates.parentName } }] };
    }
    if (updates.examDate !== undefined) {
      properties['시험일'] = updates.examDate ? { date: { start: updates.examDate } } : { date: null };
    }
    if (updates.status !== undefined) {
      properties['상태'] = { select: { name: updates.status === 'inactive' ? '비활성' : '활성' } };
    }
    if (updates.absenceReason !== undefined) {
      properties['결시사유'] = { rich_text: [{ text: { content: updates.absenceReason || '' } }] };
    }

    await notionFetch(`/pages/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });

    return true;
  } catch (error) {
    console.error('Failed to update student:', error);
    return false;
  }
};

// 학생 삭제 (아카이브)
export const deleteStudent = async (studentId: string): Promise<boolean> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    return true; // 목업 모드
  }

  try {
    await notionFetch(`/pages/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    });
    return true;
  } catch (error) {
    console.error('Failed to delete student:', error);
    return false;
  }
};

// 학생 시험일 일괄 업데이트
export const updateStudentExamDates = async (
  studentIds: string[],
  examDate: string | null
): Promise<boolean> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    return true;
  }

  try {
    await Promise.all(
      studentIds.map(id =>
        notionFetch(`/pages/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              '시험일': examDate ? { date: { start: examDate } } : { date: null },
            },
          }),
        })
      )
    );
    return true;
  } catch (error) {
    console.error('Failed to update exam dates:', error);
    return false;
  }
};

// ============ 점수 ============

export const fetchScores = async (yearMonth: string): Promise<MonthlyReport[]> => {
  const dbIds = getDbIds();
  if (!dbIds.scores) {
    console.warn('Scores DB ID not configured');
    return [];
  }

  try {
    const data = await notionFetch(`/databases/${dbIds.scores}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          property: '년월',
          rich_text: { equals: yearMonth },
        },
      }),
    });

    // 학생별로 그룹화
    const reportMap = new Map<string, MonthlyReport>();

    for (const page of data.results) {
      const studentId = page.properties['학생']?.relation?.[0]?.id || '';
      const studentName = page.properties['학생이름']?.rich_text?.[0]?.plain_text || '';

      if (!reportMap.has(studentId)) {
        reportMap.set(studentId, {
          id: `${studentId}-${yearMonth}`,
          studentId,
          studentName,
          yearMonth,
          scores: [],
          status: 'draft',
          createdAt: page.created_time,
          updatedAt: page.last_edited_time,
        });
      }

      const report = reportMap.get(studentId)!;
      report.scores.push({
        subject: page.properties['과목']?.select?.name || '',
        score: page.properties['점수']?.number || 0,
        teacherId: page.properties['선생님']?.relation?.[0]?.id || '',
        teacherName: page.properties['선생님이름']?.rich_text?.[0]?.plain_text || '',
        comment: page.properties['코멘트']?.rich_text?.[0]?.plain_text || '',
        difficulty: page.properties['난이도']?.select?.name as DifficultyGrade || undefined,
        updatedAt: page.last_edited_time,
      });
    }

    return Array.from(reportMap.values());
  } catch (error) {
    console.error('Failed to fetch scores:', error);
    return [];
  }
};

// 점수 저장/업데이트
export const saveScore = async (
  studentId: string,
  studentName: string,
  yearMonth: string,
  score: SubjectScore
): Promise<boolean> => {
  const dbIds = getDbIds();
  if (!dbIds.scores) {
    console.warn('Scores DB ID not configured, saving locally only');
    return true;
  }

  try {
    // 기존 점수 찾기
    const existing = await notionFetch(`/databases/${dbIds.scores}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          and: [
            { property: '학생', relation: { contains: studentId } },
            { property: '년월', rich_text: { equals: yearMonth } },
            { property: '과목', select: { equals: score.subject } },
          ],
        },
      }),
    });

    const properties: any = {
      '학생이름': { rich_text: [{ text: { content: studentName } }] },
      '년월': { rich_text: [{ text: { content: yearMonth } }] },
      '과목': { select: { name: score.subject } },
      '점수': { number: score.score },
      '선생님이름': { rich_text: [{ text: { content: score.teacherName } }] },
      '코멘트': { rich_text: [{ text: { content: score.comment || '' } }] },
    };

    if (score.difficulty) {
      properties['난이도'] = { select: { name: score.difficulty } };
    }

    if (existing.results.length > 0) {
      // 업데이트
      await notionFetch(`/pages/${existing.results[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
    } else {
      // 새로 생성
      await notionFetch('/pages', {
        method: 'POST',
        body: JSON.stringify({
          parent: { database_id: dbIds.scores },
          properties: {
            ...properties,
            '학생': { relation: [{ id: studentId }] },
            '선생님': score.teacherId ? { relation: [{ id: score.teacherId }] } : undefined,
          },
        }),
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to save score:', error);
    return false;
  }
};

// 점수 일괄 수정 (관리자용)
export const updateScores = async (
  studentId: string,
  studentName: string,
  yearMonth: string,
  scores: SubjectScore[]
): Promise<boolean> => {
  try {
    await Promise.all(
      scores.map(score => saveScore(studentId, studentName, yearMonth, score))
    );
    return true;
  } catch (error) {
    console.error('Failed to update scores:', error);
    return false;
  }
};

// ============ 시험지 ============

export const fetchExams = async (yearMonth?: string): Promise<Exam[]> => {
  const dbIds = getDbIds();
  if (!dbIds.exams) {
    console.warn('Exams DB ID not configured');
    return getMockExams();
  }

  try {
    const filter = yearMonth
      ? { property: '년월', rich_text: { equals: yearMonth } }
      : undefined;

    const data = await notionFetch(`/databases/${dbIds.exams}/query`, {
      method: 'POST',
      body: JSON.stringify(filter ? { filter } : {}),
    });

    return data.results.map((page: any) => ({
      id: page.id,
      subject: page.properties['과목']?.select?.name || '',
      yearMonth: page.properties['년월']?.rich_text?.[0]?.plain_text || '',
      difficulty: (page.properties['난이도']?.select?.name as DifficultyGrade) || 'C',
      examFileUrl: page.properties['시험지']?.files?.[0]?.external?.url || page.properties['시험지']?.files?.[0]?.file?.url || '',
      scope: page.properties['범위']?.rich_text?.[0]?.plain_text || '',
      uploadedBy: page.properties['등록자']?.rich_text?.[0]?.plain_text || '',
      uploadedAt: page.created_time,
    }));
  } catch (error) {
    console.error('Failed to fetch exams:', error);
    return getMockExams();
  }
};

export const createExamEntry = async (exam: Omit<Exam, 'id' | 'uploadedAt'>): Promise<Exam | null> => {
  const dbIds = getDbIds();
  if (!dbIds.exams) {
    console.warn('Exams DB ID not configured');
    return null;
  }

  try {
    const data = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: dbIds.exams },
        properties: {
          '과목': { select: { name: exam.subject } },
          '년월': { rich_text: [{ text: { content: exam.yearMonth } }] },
          '난이도': { select: { name: exam.difficulty } },
          '범위': { rich_text: [{ text: { content: exam.scope || '' } }] },
          '등록자': { rich_text: [{ text: { content: exam.uploadedBy } }] },
        },
      }),
    });

    return {
      id: data.id,
      subject: exam.subject,
      yearMonth: exam.yearMonth,
      difficulty: exam.difficulty,
      examFileUrl: exam.examFileUrl,
      scope: exam.scope,
      uploadedBy: exam.uploadedBy,
      uploadedAt: data.created_time,
    };
  } catch (error) {
    console.error('Failed to create exam entry:', error);
    return null;
  }
};

export const updateExamDifficulty = async (examId: string, difficulty: DifficultyGrade): Promise<boolean> => {
  try {
    await notionFetch(`/pages/${examId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          '난이도': { select: { name: difficulty } },
        },
      }),
    });
    return true;
  } catch (error) {
    console.error('Failed to update exam difficulty:', error);
    return false;
  }
};

// ============ 목업 데이터 (Notion 미연결시 사용) ============

const getMockTeachers = (): Teacher[] => [
  { id: 't1', name: '김수학', subject: '수학', pin: '1234', isAdmin: true },
  { id: 't2', name: '이영어', subject: '영어', pin: '2345', isAdmin: false },
  { id: 't3', name: '박국어', subject: '국어', pin: '3456', isAdmin: false },
  { id: 't4', name: '최과학', subject: '과학', pin: '4567', isAdmin: false },
];

const getMockStudents = (): Student[] => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  return [
    { id: 's1', name: '홍길동', grade: '중1', subjects: ['수학', '영어', '국어'], parentName: '홍부모', examDate: today, status: 'active' },
    { id: 's2', name: '김철수', grade: '중2', subjects: ['수학', '영어', '과학'], parentName: '김부모', examDate: today, status: 'active' },
    { id: 's3', name: '이영희', grade: '중1', subjects: ['수학', '국어'], parentName: '이부모', examDate: tomorrow, status: 'active' },
    { id: 's4', name: '박민수', grade: '중3', subjects: ['수학', '영어', '국어', '과학'], parentName: '박부모', status: 'active' },
    { id: 's5', name: '정수진', grade: '고1', subjects: ['수학', '영어'], parentName: '정부모', examDate: tomorrow, status: 'active' },
  ];
};

const getMockExams = (): Exam[] => {
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return [
    { id: 'e1', subject: '수학', yearMonth: currentYearMonth, difficulty: 'B', uploadedBy: '김수학', uploadedAt: new Date().toISOString(), scope: '이차방정식' },
    { id: 'e2', subject: '영어', yearMonth: currentYearMonth, difficulty: 'C', uploadedBy: '이영어', uploadedAt: new Date().toISOString(), scope: '관계대명사' },
    { id: 'e3', subject: '국어', yearMonth: currentYearMonth, difficulty: 'A', uploadedBy: '박국어', uploadedAt: new Date().toISOString(), scope: '현대시' },
    { id: 'e4', subject: '과학', yearMonth: currentYearMonth, difficulty: 'D', uploadedBy: '최과학', uploadedAt: new Date().toISOString(), scope: '화학반응' },
  ];
};
