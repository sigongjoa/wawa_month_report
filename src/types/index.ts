export interface Student {
  id: string;
  name: string;
  subjects: string[];
  grade?: string;
  status?: string;
  memo?: string;
}

export interface Score {
  subject: string;
  score: number;
}

export interface MonthlyReport {
  id?: string;
  studentId: string;
  studentName: string;
  yearMonth: string;
  scores: Score[];
  comment: string;
  createdAt?: string;
}

export interface SendHistory {
  id?: string;
  studentId: string;
  studentName: string;
  reportId: string;
  recipientName: string;
  sentAt: string;
  status: 'success' | 'failed';
  filePath?: string;
}

export interface KakaoFriend {
  id: string;
  uuid: string;
  profile_nickname: string;
  profile_thumbnail_image?: string;
}

export interface ChartData {
  month: string;
  [subject: string]: string | number;
}
