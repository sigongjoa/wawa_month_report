import type { Teacher, Student, MonthlyReport, SubjectScore } from '../types';

const NOTION_API_KEY = import.meta.env.VITE_NOTION_API_KEY;

// Notion DB IDs (환경변수 또는 설정에서 가져옴)
const getDbIds = () => ({
  teachers: import.meta.env.VITE_NOTION_TEACHERS_DB || '',
  students: import.meta.env.VITE_NOTION_STUDENTS_DB || '',
  scores: import.meta.env.VITE_NOTION_SCORES_DB || '',
});

// Notion API 호출 헬퍼
const notionFetch = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
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

// 선생님 목록 조회
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

// 학생 목록 조회
export const fetchStudents = async (): Promise<Student[]> => {
  const dbIds = getDbIds();
  if (!dbIds.students) {
    console.warn('Students DB ID not configured');
    return getMockStudents();
  }

  try {
    const data = await notionFetch(`/databases/${dbIds.students}/query`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    return data.results.map((page: any) => ({
      id: page.id,
      name: page.properties['이름']?.title?.[0]?.plain_text || '',
      grade: page.properties['학년']?.select?.name || '',
      subjects: page.properties['수강과목']?.multi_select?.map((s: any) => s.name) || [],
      parentName: page.properties['학부모']?.rich_text?.[0]?.plain_text || '',
    }));
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return getMockStudents();
  }
};

// 월별 점수 조회
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

    const properties = {
      '학생이름': { rich_text: [{ text: { content: studentName } }] },
      '년월': { rich_text: [{ text: { content: yearMonth } }] },
      '과목': { select: { name: score.subject } },
      '점수': { number: score.score },
      '선생님이름': { rich_text: [{ text: { content: score.teacherName } }] },
      '코멘트': { rich_text: [{ text: { content: score.comment || '' } }] },
    };

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

// ============ 목업 데이터 (Notion 미연결시 사용) ============

const getMockTeachers = (): Teacher[] => [
  { id: 't1', name: '김수학', subject: '수학', pin: '1234', isAdmin: true },
  { id: 't2', name: '이영어', subject: '영어', pin: '2345', isAdmin: false },
  { id: 't3', name: '박국어', subject: '국어', pin: '3456', isAdmin: false },
  { id: 't4', name: '최과학', subject: '과학', pin: '4567', isAdmin: false },
];

const getMockStudents = (): Student[] => [
  { id: 's1', name: '홍길동', grade: '중1', subjects: ['수학', '영어', '국어'], parentName: '홍부모' },
  { id: 's2', name: '김철수', grade: '중2', subjects: ['수학', '영어', '과학'], parentName: '김부모' },
  { id: 's3', name: '이영희', grade: '중1', subjects: ['수학', '국어'], parentName: '이부모' },
  { id: 's4', name: '박민수', grade: '중3', subjects: ['수학', '영어', '국어', '과학'], parentName: '박부모' },
  { id: 's5', name: '정수진', grade: '고1', subjects: ['수학', '영어'], parentName: '정부모' },
];
