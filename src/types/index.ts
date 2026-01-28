// 선생님
export interface Teacher {
  id: string;
  name: string;
  subject: string; // 담당 과목
  pin: string; // 4자리 PIN
  isAdmin: boolean;
}

// 학생
export interface Student {
  id: string;
  name: string;
  grade: string; // 학년
  subjects: string[]; // 수강 과목들
  parentName?: string; // 학부모 이름 (카카오톡 전송용)
  parentKakaoId?: string; // 학부모 카카오 UUID (비즈앱 연동 후 사용)
}

// 과목별 점수
export interface SubjectScore {
  subject: string;
  score: number;
  teacherId: string;
  teacherName: string;
  comment?: string;
  updatedAt: string;
}

// 월별 리포트
export interface MonthlyReport {
  id: string;
  studentId: string;
  studentName: string;
  yearMonth: string; // "2026-01"
  scores: SubjectScore[];
  totalComment?: string; // 종합 코멘트
  status: 'draft' | 'complete' | 'sent';
  createdAt: string;
  updatedAt: string;
}

// 전송 이력
export interface SendHistory {
  id?: string;
  studentId: string;
  studentName: string;
  reportId: string;
  recipientName: string;
  recipientType: 'parent' | 'self';
  sentAt: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

// 카카오 친구 (비즈앱용)
export interface KakaoFriend {
  uuid: string;
  profile_nickname: string;
  profile_thumbnail_image?: string;
}

// 앱 설정
export interface AppSettings {
  notionDbId: string;
  notionApiKey: string;
  kakaoJsKey: string;
  academyName: string;
}

// 현재 로그인한 선생님
export interface CurrentUser {
  teacher: Teacher;
  loginAt: string;
}
