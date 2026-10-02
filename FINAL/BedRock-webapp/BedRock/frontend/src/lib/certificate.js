/**
 * Client-side PDF certificate generator using html2pdf.js.
 * Renders a "Proof-of-Integrity Certificate" and triggers a download.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Bedrock logo SVG path (the 3D cube mark)
const LOGO_PATH = 'M5 20.0587L90.1594 5.11398C106.788 9.49119 119.934 30.0933 133.08 50.6954C146.226 71.2975 159.372 91.8997 176 96.2769M5 20.0587C21.6284 24.4359 34.604 46.9061 47.5797 69.3763C60.5553 91.8466 73.531 114.317 90.1594 118.694M5 20.0587V126.697M176 96.2769L90.1594 118.694M176 96.2769V126.697M176 96.2769C142.477 105.031 123.682 109.94 90.1594 118.694M90.1594 118.694V149.114M90.1594 118.694C90.1594 133.285 90.1594 134.523 90.1594 149.114M90.1594 149.114L5 126.697M90.1594 149.114L176 126.697M90.1594 149.114C56.9026 140.36 5 126.697 5 126.697M90.1594 149.114C123.682 140.36 176 126.697 176 126.697';

// A4 at 96 dpi: 794 × 1123 px
const A4_PX_W = 794;
const A4_PX_H = 1123;

/**
 * Build the HTML template for the certificate.
 */
function buildCertificateHTML({ subcontractAddress, timestamp, duration, finalHash }) {
  const generatedDate = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).toUpperCase();

  return `
<div style="
  font-family: 'Helvetica Neue', Arial, sans-serif;
  width: ${A4_PX_W}px;
  height: ${A4_PX_H}px;
  padding: 0;
  margin: 0;
  color: #e2e0ea;
  background: #0c0a13;
  box-sizing: border-box;
  overflow: hidden;
">
  <!-- Outer flex column fills the full A4 height so the footer is always at the bottom -->
  <div style="
    padding: 64px 60px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  ">

    <!-- Logo + Brand -->
    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 52px; flex-shrink: 0;">
      <svg width="40" height="34" viewBox="0 0 181 154.283" fill="none">
        <path d="${LOGO_PATH}" stroke="#8b5cf6" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <span style="
        font-weight: 900;
        font-size: 28px;
        color: #ffffff;
        letter-spacing: -0.5px;
      ">Bedrock.</span>
    </div>

    <!-- Main content grows to fill available space -->
    <div style="flex: 1; display: flex; flex-direction: column;">

      <!-- Title -->
      <h1 style="
        font-size: 34px;
        font-weight: 700;
        margin: 0 0 10px 0;
        color: #ffffff;
        flex-shrink: 0;
      ">Proof-of-Integrity Certificate</h1>

      <p style="
        font-size: 14px;
        color: #9a94b0;
        line-height: 1.7;
        margin: 0 0 40px 0;
        flex-shrink: 0;
      ">
        This certificate confirms that the video recording below was captured
        with verified liveness and its integrity hash was anchored on the blockchain.
      </p>

      <!-- Divider -->
      <div style="height: 1px; background: #2a2540; margin-bottom: 36px; flex-shrink: 0;"></div>

      <!-- Details -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; flex-shrink: 0;">
        <tr>
          <td style="padding: 16px 0; color: #9a94b0; width: 200px; vertical-align: top; border-bottom: 1px solid #1e1a2e;">Date &amp; Time</td>
          <td style="padding: 16px 0; color: #ffffff; font-weight: 500; border-bottom: 1px solid #1e1a2e;">${timestamp}</td>
        </tr>
        <tr>
          <td style="padding: 16px 0; color: #9a94b0; vertical-align: top; border-bottom: 1px solid #1e1a2e;">Duration</td>
          <td style="padding: 16px 0; color: #ffffff; font-weight: 500; border-bottom: 1px solid #1e1a2e;">${duration} seconds</td>
        </tr>
        <tr>
          <td style="padding: 16px 0; color: #9a94b0; vertical-align: top; border-bottom: 1px solid #1e1a2e;">Subcontract Address</td>
          <td style="padding: 16px 0; color: #c4b5fd; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all; border-bottom: 1px solid #1e1a2e;">${subcontractAddress}</td>
        </tr>
        <tr>
          <td style="padding: 16px 0; color: #9a94b0; vertical-align: top;">Final Rolling Hash</td>
          <td style="padding: 16px 0; color: #c4b5fd; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all;">${finalHash}</td>
        </tr>
      </table>

      <!-- Verification badge -->
      <div style="
        margin-top: 40px;
        padding: 18px 22px;
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 14px;
        flex-shrink: 0;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#8b5cf6" stroke-width="2"/>
          <path d="M8 12l3 3 5-5" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span style="color: #c4b5fd; font-size: 13px; font-weight: 500;">
          Blockchain-verified integrity — tamper-evident record
        </span>
      </div>

    </div><!-- /main content -->

    <!-- Footer pinned to the bottom of the A4 page -->
    <div style="
      padding-top: 20px;
      border-top: 1px solid #2a2540;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    ">
      <span style="font-size: 11px; color: #5a5472;">
        Generated ${generatedDate}
      </span>
      <span style="font-size: 11px; color: #5a5472;">
        bedrock.evidence
      </span>
    </div>

  </div>
</div>`;
}

/**
 * Generate a PDF certificate and return it as a Blob.
 * @param {{ subcontractAddress: string, timestamp: string, duration: number, finalHash: string }} params
 * @returns {Promise<Blob>}
 */
export function generateCertificateBlob({ subcontractAddress, timestamp, duration, finalHash }) {
  const html = buildCertificateHTML({ subcontractAddress, timestamp, duration, finalHash });

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = html;
  document.body.appendChild(container);

  const el = container.firstElementChild;

  // Render at 2× for crisp text; the container is fixed to exact A4 pixel
  // dimensions so there is no leftover whitespace below the content.
  return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#0c0a13' })
    .then(function (canvas) {
      document.body.removeChild(container);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageW = pdf.internal.pageSize.getWidth();   // 210 mm
      const pageH = pdf.internal.pageSize.getHeight();  // 297 mm

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, pageW, pageH);

      return pdf.output('blob');
    })
    .catch(function (err) {
      if (container.parentNode) document.body.removeChild(container);
      throw err;
    });
}

/**
 * Generate and directly download a PDF certificate (legacy convenience wrapper).
 * @param {{ subcontractAddress: string, timestamp: string, duration: number, finalHash: string }} params
 * @returns {Promise<void>}
 */
export async function generateCertificate(params, filename = 'certificate.pdf') {
  const blob = await generateCertificateBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
