import type { Teacher, Student, Score, MonthlyReport, SubjectScore, Exam, DifficultyGrade, AppSettings } from '../types';

// Electron 환경 감지
const isElectron = (): boolean => {
  return !!(window.electronAPI || window.location.protocol === 'file:');
};

// localStorage에서 앱 설정 가져오기
const getAppSettings = (): Partial<AppSettings> => {
  try {
    const stored = localStorage.getItem('monthly-report-storage');
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

  // Electron 환경: IPC를 통해 main process에서 API 호출
  if (isElectron() && window.electronAPI) {
    const result = await window.electronAPI.notionFetch(endpoint, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
      body: options.body,
    });

    if (result.error) {
      console.error('Notion API error:', result.data || result.message);
      throw new Error(result.data?.message || result.message || 'Notion API error');
    }

    return result.data;
  }

  // 웹 환경: 프록시를 통해 API 호출
  const baseUrl = '/api/notion/v1';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
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
    return [];
  }

  try {
    const data = await notionFetch(`/databases/${dbIds.teachers}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return data.results.map((page: any) => {
      const subjectStr = page.properties['과목']?.rich_text?.[0]?.plain_text || '';
      // 쉼표로 구분된 과목을 배열로 변환
      const subjects = subjectStr.split(',').map((s: string) => s.trim()).filter(Boolean);
      return {
        id: page.id,
        name: page.properties['선생님']?.title?.[0]?.plain_text || '',
        subjects,
        pin: String(page.properties['PIN']?.number || '0000'),
        isAdmin: page.properties['isAdmin']?.select?.name === 'True',
      };
    });
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    return [];
  }
};

// ============ 학생 CRUD ============

export const fetchStudents = async (): Promise<Student[]> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    return [];
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
      grade: page.properties['학년']?.select?.name || page.properties['학년']?.rich_text?.[0]?.plain_text || '',
      subjects: page.properties['수강과목']?.multi_select?.map((s: any) => s.name) || [],
      parentName: page.properties['학부모연락처']?.rich_text?.[0]?.plain_text || page.properties['학부모']?.rich_text?.[0]?.plain_text || '',
      parentPhone: page.properties['전화번호']?.phone_number || page.properties['학부모전화']?.rich_text?.[0]?.plain_text || '',
    }));
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return [];
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

// ============ 성적 (새 구조) ============

// 성적 DB에서 특정 년월의 모든 성적 가져오기
export const fetchScoresByYearMonth = async (yearMonth: string): Promise<Score[]> => {
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
          property: '시험년월',
          rich_text: { equals: yearMonth },
        },
      }),
    });

    return data.results.map((page: any) => ({
      id: page.id,
      studentId: page.properties['학생']?.relation?.[0]?.id || '',
      yearMonth: page.properties['시험년월']?.rich_text?.[0]?.plain_text || '',
      subject: page.properties['과목']?.select?.name || '',
      score: page.properties['점수']?.number || 0,
      teacherId: page.properties['선생님']?.relation?.[0]?.id || '',
      comment: page.properties['코멘트']?.rich_text?.[0]?.plain_text || '',
      difficulty: page.properties['난이도']?.select?.name as DifficultyGrade || undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch scores:', error);
    return [];
  }
};

// 학생별로 그룹화된 월별 리포트 생성
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
          property: '시험년월',
          rich_text: { equals: yearMonth },
        },
      }),
    });

    // 학생별로 그룹화
    const reportMap = new Map<string, MonthlyReport>();

    for (const page of data.results) {
      const studentId = page.properties['학생']?.relation?.[0]?.id || '';

      if (!studentId) continue;

      if (!reportMap.has(studentId)) {
        reportMap.set(studentId, {
          id: `${studentId}-${yearMonth}`,
          studentId,
          studentName: '', // 나중에 학생 정보와 조인
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
        teacherName: '',
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

// 성적 저장/업데이트 (새 구조)
export const saveScore = async (
  studentId: string,
  studentName: string,
  yearMonth: string,
  subject: string,
  score: number,
  teacherId: string,
  comment?: string,
  difficulty?: DifficultyGrade
): Promise<boolean> => {
  const dbIds = getDbIds();
  if (!dbIds.scores) {
    console.warn('Scores DB ID not configured, saving locally only');
    return true;
  }

  try {
    // 기존 성적 찾기 (학생 + 년월 + 과목)
    const existing = await notionFetch(`/databases/${dbIds.scores}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          and: [
            { property: '학생', relation: { contains: studentId } },
            { property: '시험년월', rich_text: { equals: yearMonth } },
            { property: '과목', select: { equals: subject } },
          ],
        },
      }),
    });

    // DB 컬럼 타입에 맞춰서 저장
    const properties: any = {
      '이름': { title: [{ text: { content: `${studentName}_${subject}_${yearMonth}` } }] },
      '시험년월': { rich_text: [{ text: { content: yearMonth } }] },
      '과목': { select: { name: subject } },
      '점수': { number: score },
      '코멘트': { rich_text: [{ text: { content: comment || '' } }] },
    };

    if (difficulty) {
      properties['난이도'] = { select: { name: difficulty } };
    }

    if (existing.results.length > 0) {
      // 업데이트
      await notionFetch(`/pages/${existing.results[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            ...properties,
            '선생님': teacherId ? { relation: [{ id: teacherId }] } : undefined,
          }
        }),
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
            '선생님': teacherId ? { relation: [{ id: teacherId }] } : undefined,
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

// 레거시 호환용 - SubjectScore 기반 저장
export const saveScoreLegacy = async (
  studentId: string,
  studentName: string,
  yearMonth: string,
  score: SubjectScore
): Promise<boolean> => {
  return saveScore(
    studentId,
    studentName,
    yearMonth,
    score.subject,
    score.score,
    score.teacherId,
    score.comment,
    score.difficulty
  );
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
      scores.map(score => saveScore(
        studentId,
        studentName,
        yearMonth,
        score.subject,
        score.score,
        score.teacherId,
        score.comment,
        score.difficulty
      ))
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
    return [];
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
    return [];
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

