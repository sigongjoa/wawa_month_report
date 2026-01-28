import type { Student, MonthlyReport, Score } from '../types';

const NOTION_API_KEY = import.meta.env.VITE_NOTION_API_KEY;
const DATABASE_ID = import.meta.env.VITE_NOTION_DATABASE_ID;

// Notion API는 CORS 문제로 브라우저에서 직접 호출 불가
// 프록시 서버를 통해 호출하거나, Electron의 main process에서 호출해야 함
// 여기서는 테스트를 위해 간단한 fetch wrapper 사용

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
    throw new Error(error.message || 'Notion API Error');
  }

  return response.json();
};

// 학생 목록 조회
export const fetchStudents = async (): Promise<Student[]> => {
  try {
    const response = await notionFetch(`/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify({
        sorts: [{ property: 'Name', direction: 'ascending' }],
      }),
    });

    return response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || '이름 없음',
        subjects: props.Subjects?.multi_select?.map((s: any) => s.name) || [],
        grade: props.Grade?.select?.name || '',
        status: props.Status?.select?.name || '재원',
        memo: props.Memo?.rich_text?.[0]?.plain_text || '',
      };
    });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    throw error;
  }
};

// 학생의 과거 성적 조회
export const fetchStudentReports = async (studentId: string): Promise<MonthlyReport[]> => {
  try {
    // MonthlyReports DB에서 해당 학생의 기록 조회
    // 실제로는 별도의 Reports DB ID가 필요
    const response = await notionFetch(`/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          property: 'Student',
          relation: {
            contains: studentId,
          },
        },
        sorts: [{ property: 'YearMonth', direction: 'descending' }],
      }),
    });

    return response.results.map((page: any) => {
      const props = page.properties;
      let scores: Score[] = [];
      try {
        const scoresJson = props.Scores?.rich_text?.[0]?.plain_text;
        if (scoresJson) {
          const parsed = JSON.parse(scoresJson);
          scores = Object.entries(parsed).map(([subject, score]) => ({
            subject,
            score: score as number,
          }));
        }
      } catch (e) {
        console.error('Failed to parse scores:', e);
      }

      return {
        id: page.id,
        studentId,
        studentName: '',
        yearMonth: props.YearMonth?.rich_text?.[0]?.plain_text || '',
        scores,
        comment: props.Comment?.rich_text?.[0]?.plain_text || '',
        createdAt: page.created_time,
      };
    });
  } catch (error) {
    console.error('Failed to fetch student reports:', error);
    return [];
  }
};

// 월말평가 저장
export const saveReport = async (report: MonthlyReport): Promise<string> => {
  try {
    const scoresObject = report.scores.reduce((acc, { subject, score }) => {
      acc[subject] = score;
      return acc;
    }, {} as Record<string, number>);

    const response = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties: {
          Name: {
            title: [{ text: { content: `${report.studentName} - ${report.yearMonth}` } }],
          },
          Student: {
            relation: [{ id: report.studentId }],
          },
          YearMonth: {
            rich_text: [{ text: { content: report.yearMonth } }],
          },
          Scores: {
            rich_text: [{ text: { content: JSON.stringify(scoresObject) } }],
          },
          Comment: {
            rich_text: [{ text: { content: report.comment } }],
          },
        },
      }),
    });

    return response.id;
  } catch (error) {
    console.error('Failed to save report:', error);
    throw error;
  }
};

// Notion API 연결 테스트
export const testNotionConnection = async (): Promise<boolean> => {
  try {
    await notionFetch(`/databases/${DATABASE_ID}`);
    return true;
  } catch (error) {
    console.error('Notion connection failed:', error);
    return false;
  }
};
