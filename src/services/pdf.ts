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
    backgroundColor: '#F8F9FA',
    logging: false,
  });

  return canvas.toDataURL('image/png');
};

// HTML 요소를 PDF로 변환 (여러 페이지 지원)
export const elementToPdf = async (
  elementId: string,
  _fileName: string = 'report.pdf'
): Promise<Blob> => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#F8F9FA',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');

  // 모바일 스타일 리포트는 세로가 길 수 있으므로 적절한 크기로 맞춤
  // A4: 210mm x 297mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 5; // 여백

  const imgWidth = pageWidth - (margin * 2);
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // 한 페이지에 맞는 경우
  if (imgHeight <= pageHeight - (margin * 2)) {
    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
  } else {
    // 여러 페이지가 필요한 경우
    let position = 0;
    const contentHeight = pageHeight - (margin * 2);
    const totalPages = Math.ceil(imgHeight / contentHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      // 이미지를 페이지에 맞게 잘라서 추가
      const sourceY = (position / imgHeight) * canvas.height;
      const sourceHeight = Math.min(
        (contentHeight / imgHeight) * canvas.height,
        canvas.height - sourceY
      );

      // 현재 페이지에 표시할 이미지 높이
      const destHeight = Math.min(contentHeight, imgHeight - position);

      // 캔버스에서 해당 부분만 추출
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(
          canvas,
          0, sourceY,
          canvas.width, sourceHeight,
          0, 0,
          canvas.width, sourceHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, destHeight);
      }

      position += contentHeight;
    }
  }

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
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
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
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
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

// Alias for backward compatibility
export const downloadReportAsPdf = downloadPdf;
