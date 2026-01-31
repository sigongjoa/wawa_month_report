import { contextBridge, ipcRenderer } from 'electron';

// Renderer에서 사용할 API를 안전하게 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 프린터 목록 조회
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // PDF 프린트
  printPDF: (pdfUrl, printerName) => ipcRenderer.invoke('print-pdf', pdfUrl, printerName),

  // 기본 프린터 조회
  getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
});
