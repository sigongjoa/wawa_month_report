import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Student, MonthlyReport, SendHistory, KakaoFriend } from '../types';

interface ReportState {
  // 학생 관련
  students: Student[];
  selectedStudent: Student | null;
  setStudents: (students: Student[]) => void;
  setSelectedStudent: (student: Student | null) => void;

  // 리포트 관련
  currentReport: MonthlyReport | null;
  reports: MonthlyReport[];
  setCurrentReport: (report: MonthlyReport | null) => void;
  setReports: (reports: MonthlyReport[]) => void;
  addReport: (report: MonthlyReport) => void;

  // 전송 관련
  sendHistories: SendHistory[];
  addSendHistory: (history: SendHistory) => void;

  // 카카오 관련
  kakaoFriends: KakaoFriend[];
  setKakaoFriends: (friends: KakaoFriend[]) => void;
  isKakaoLoggedIn: boolean;
  setKakaoLoggedIn: (loggedIn: boolean) => void;
  kakaoAccessToken: string | null;
  setKakaoAccessToken: (token: string | null) => void;

  // 현재 선택된 월
  currentYearMonth: string;
  setCurrentYearMonth: (yearMonth: string) => void;

  // 초기화
  reset: () => void;
}

const getCurrentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      // 학생
      students: [],
      selectedStudent: null,
      setStudents: (students) => set({ students }),
      setSelectedStudent: (student) => set({ selectedStudent: student }),

      // 리포트
      currentReport: null,
      reports: [],
      setCurrentReport: (report) => set({ currentReport: report }),
      setReports: (reports) => set({ reports }),
      addReport: (report) => set((state) => ({ reports: [...state.reports, report] })),

      // 전송
      sendHistories: [],
      addSendHistory: (history) => set((state) => ({ sendHistories: [...state.sendHistories, history] })),

      // 카카오
      kakaoFriends: [],
      setKakaoFriends: (friends) => set({ kakaoFriends: friends }),
      isKakaoLoggedIn: false,
      setKakaoLoggedIn: (loggedIn) => set({ isKakaoLoggedIn: loggedIn }),
      kakaoAccessToken: null,
      setKakaoAccessToken: (token) => set({ kakaoAccessToken: token, isKakaoLoggedIn: !!token }),

      // 현재 월
      currentYearMonth: getCurrentYearMonth(),
      setCurrentYearMonth: (yearMonth) => set({ currentYearMonth: yearMonth }),

      // 초기화
      reset: () => set({
        students: [],
        selectedStudent: null,
        currentReport: null,
        reports: [],
        sendHistories: [],
        kakaoFriends: [],
        isKakaoLoggedIn: false,
        kakaoAccessToken: null,
        currentYearMonth: getCurrentYearMonth(),
      }),
    }),
    {
      name: 'monthly-report-storage', // localStorage 키 이름
      partialize: (state) => ({
        // 저장할 상태만 선택
        currentReport: state.currentReport,
        reports: state.reports,
        sendHistories: state.sendHistories,
        currentYearMonth: state.currentYearMonth,
        selectedStudent: state.selectedStudent,
        kakaoAccessToken: state.kakaoAccessToken,
        isKakaoLoggedIn: state.isKakaoLoggedIn,
      }),
    }
  )
);
