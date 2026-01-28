import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// HTML 요소를 이미지로 변환
export const elementToImage = async (elementId: string): Promise<string> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  return canvas.toDataURL('image/png');
};

// HTML 요소를 PDF로 변환
export const elementToPdf = async (
  elementId: string,
  fileName: string = 'report.pdf'
): Promise<Blob> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 210; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

  return pdf.output('blob');
};

// PDF 다운로드
export const downloadPdf = async (
  elementId: string,
  fileName: string = 'report.pdf'
): Promise<void> => {
  const blob = await elementToPdf(elementId, fileName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 이미지 다운로드
export const downloadImage = async (
  elementId: string,
  fileName: string = 'report.png'
): Promise<void> => {
  const imageData = await elementToImage(elementId);
  const link = document.createElement('a');
  link.href = imageData;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// PDF를 Base64로 변환 (전송용)
export const pdfToBase64 = async (elementId: string): Promise<string> => {
  const blob = await elementToPdf(elementId);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
