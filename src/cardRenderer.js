import QRCode from 'qrcode';
import { formatDriveImageUrl } from './api.js';

/**
 * High-Resolution Canvas ID Card Generator
 * Renders an exact replica of the Sanatan Yuva Sangathan ID Card
 */

export async function renderIdCard(canvas, data) {
  const ctx = canvas.getContext('2d');
  
  // High-DPI Dimensions (matches standard 1:1.53 ID Card ratio)
  const W = 600;
  const H = 920;
  canvas.width = W;
  canvas.height = H;

  // Clear canvas
  ctx.clearRect(0, 0, W, H);

  // 1. Base Card Shape with Rounded Corners
  ctx.save();
  drawRoundedRect(ctx, 0, 0, W, H, 24);
  ctx.clip(); // Clip everything to the rounded card

  // White Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // 2. Top Orange Header Wave Banner
  drawTopWaves(ctx, W);

  // 3. Lanyard Punch Hole at Top Center
  drawLanyardHole(ctx, W / 2, 22, 90, 20);

  // 4. Subtle Watermark in Background behind photo & details
  drawWatermark(ctx, W / 2, 420);

  // 5. Organization Logo (Top-Left)
  await drawLogo(ctx, 45, 65, 140);

  // 6. Organization Title (Top-Right)
  drawOrgTitle(ctx, data.organization || 'સનાતન યુવા મંચ', 215, 120);

  // 7. Member Photo (Center - Prioritize local base64, then Drive CDN URL)
  await drawMemberPhoto(ctx, data.photoBase64 || formatDriveImageUrl(data.photoUrl), W / 2 - 95, 290, 190, 215);

  // 8. Member Details Section (with underlines)
  drawMemberDetails(ctx, data, 50, 560);

  // 9. Bottom Orange Wave Banner (covers entire bottom left for QR and ID)
  drawBottomWaves(ctx, W, H);

  // 10. QR Code (Bottom-Left)
  await drawQRCode(ctx, data, 42, H - 150, 100);

  // 11. ID Number Box (Inside solid orange wave, 100% white crisp contrast)
  drawIdNumberBox(ctx, data.idNumber || 'SYMG-2024-001', 170, H - 110);

  // 12. Authorized Signature (Bottom-Right on white background)
  drawSignature(ctx, W - 110, H - 65);

  ctx.restore();
}

/**
 * Render ID card on an offscreen canvas and return a PNG Blob
 */
export async function generateIdCardBlob(data) {
  const canvas = document.createElement('canvas');
  await renderIdCard(canvas, data);
  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob), 'image/png', 1.0);
  });
}

/** Helper: Rounded Rectangle Path */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Top Waves Banner */
function drawTopWaves(ctx, W) {
  // Deep Orange curved gradient wave
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, W, 100);
  grad.addColorStop(0, '#FF5722');
  grad.addColorStop(0.5, '#FF7043');
  grad.addColorStop(1, '#FF8A65');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, 75);
  ctx.bezierCurveTo(W * 0.75, 55, W * 0.45, 105, 0, 70);
  ctx.closePath();
  ctx.fill();

  // Secondary Golden-Orange wavy accent
  ctx.fillStyle = '#FFA726';
  ctx.beginPath();
  ctx.moveTo(0, 68);
  ctx.bezierCurveTo(W * 0.35, 100, W * 0.7, 50, W, 70);
  ctx.lineTo(W, 82);
  ctx.bezierCurveTo(W * 0.7, 62, W * 0.35, 110, 0, 78);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Bottom Waves Banner */
function drawBottomWaves(ctx, W, H) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, H - 180, W, H);
  grad.addColorStop(0, '#E65100');
  grad.addColorStop(0.3, '#FF5722');
  grad.addColorStop(0.7, '#FF7043');
  grad.addColorStop(1, '#FF6F00');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 180);
  // Curve gently across the middle: stays high until x = W * 0.65, then swoops down to right corner
  ctx.bezierCurveTo(W * 0.35, H - 175, W * 0.60, H - 165, W * 0.72, H - 90);
  ctx.bezierCurveTo(W * 0.82, H - 45, W * 0.92, H - 35, W, H - 40);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Secondary Golden-Orange wavy accent curve
  ctx.strokeStyle = '#FFA726';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, H - 180);
  ctx.bezierCurveTo(W * 0.35, H - 175, W * 0.60, H - 165, W * 0.72, H - 90);
  ctx.bezierCurveTo(W * 0.82, H - 45, W * 0.92, H - 35, W, H - 40);
  ctx.stroke();

  ctx.restore();
}

/** Lanyard Punch Hole at top */
function drawLanyardHole(ctx, cx, cy, w, h) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1.5;

  const r = h / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Watermark in Background */
function drawWatermark(ctx, cx, cy) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#E65100';
  ctx.font = '900 130px "Noto Sans Gujarati", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ૐ', cx, cy - 30);

  // Subtle sunburst rays
  ctx.strokeStyle = '#FF6F00';
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 70, cy - 30 + Math.sin(angle) * 70);
    ctx.lineTo(cx + Math.cos(angle) * 160, cy - 30 + Math.sin(angle) * 160);
    ctx.stroke();
  }
  ctx.restore();
}

/** Organization Logo */
async function drawLogo(ctx, x, y, size) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      // Outer Golden Ring
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFA000';
      ctx.fill();

      // Clip circular logo
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
      resolve();
    };
    img.onerror = () => {
      // Fallback circular badge
      ctx.save();
      ctx.fillStyle = '#FF6F00';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px "Noto Sans Gujarati"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ૐ', x + size / 2, y + size / 2);
      ctx.restore();
      resolve();
    };
    img.src = '/assets/logo.jpg';
  });
}

/** Top Organization Title */
function drawOrgTitle(ctx, orgName, startX, startY) {
  ctx.save();
  const isSant = orgName.includes('સંત');

  // Line 1: સનાતન
  ctx.fillStyle = '#E65100';
  ctx.font = '900 36px "Noto Sans Gujarati", sans-serif';
  ctx.fillText('સનાતન', startX, startY);

  // Line 2: યુવા સંત સંગઠન / યુવા મંચ
  ctx.fillStyle = '#111111';
  if (isSant) {
    ctx.font = '900 29px "Noto Sans Gujarati", sans-serif';
    ctx.fillText('યુવા સંત સંગઠન', startX, startY + 40);
  } else {
    ctx.font = '900 36px "Noto Sans Gujarati", sans-serif';
    ctx.fillText('યુવા મંચ', startX, startY + 42);
  }

  // Line 3: — ગુજરાત —
  ctx.fillStyle = '#111111';
  ctx.font = '800 25px "Noto Sans Gujarati", sans-serif';
  ctx.fillText('— ગુજરાત —', startX + (isSant ? 10 : 8), startY + (isSant ? 75 : 78));

  ctx.restore();
}

/** Member Photo */
async function drawMemberPhoto(ctx, photoSrc, x, y, w, h) {
  return new Promise((resolve) => {
    const renderPlaceholder = () => {
      ctx.save();
      drawRoundedRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = '#FFF3E0';
      ctx.fill();
      ctx.strokeStyle = '#FF6F00';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#FF6F00';
      ctx.font = '60px "Font Awesome 6 Free", FontAwesome';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👤', x + w / 2, y + h / 2);
      ctx.restore();
      resolve();
    };

    if (!photoSrc) {
      renderPlaceholder();
      return;
    }

    const img = new Image();
    if (typeof photoSrc === 'string' && !photoSrc.startsWith('data:') && !photoSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      ctx.save();
      drawRoundedRect(ctx, x, y, w, h, 16);
      ctx.clip();
      
      // Calculate aspect ratio crop
      const imgRatio = img.width / img.height;
      const targetRatio = w / h;
      let sx, sy, sWidth, sHeight;

      if (imgRatio > targetRatio) {
        sHeight = img.height;
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
      ctx.restore();

      // Outer Rounded Border
      ctx.save();
      drawRoundedRect(ctx, x, y, w, h, 16);
      ctx.strokeStyle = '#FF6F00';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      resolve();
    };

    img.onerror = renderPlaceholder;
    img.src = photoSrc;
  });
}

/** Member Details Table with underline lines */
function drawMemberDetails(ctx, data, startX, startY) {
  ctx.save();
  const labelWidth = 110;
  const lineSpacing = 42;
  const W = 600;

  const rows = [
    { label: 'નામ', value: data.fullName || '—' },
    { label: 'પદ', value: data.designation || data.memberType || 'સામાન્ય સભ્ય' },
    { label: 'મોબાઇલ', value: data.mobile || '—' },
    { label: 'સરનામું', value: formatAddress(data) }
  ];

  rows.forEach((row, i) => {
    const currentY = startY + i * lineSpacing;

    // Label
    ctx.fillStyle = '#000000';
    ctx.font = '900 20px "Noto Sans Gujarati", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, startX, currentY);

    // Colon
    ctx.fillText(':', startX + labelWidth - 25, currentY);

    // Value
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '700 18.5px "Noto Sans Gujarati", sans-serif';

    // Ellipsis truncate if address is very long
    let valText = row.value;
    const maxValWidth = W - (startX + labelWidth) - 45;
    if (ctx.measureText(valText).width > maxValWidth) {
      while (ctx.measureText(valText + '...').width > maxValWidth && valText.length > 5) {
        valText = valText.slice(0, -1);
      }
      valText += '...';
    }

    ctx.fillText(valText, startX + labelWidth, currentY);

    // Underline
    ctx.strokeStyle = '#FFCC80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX + labelWidth - 10, currentY + 6);
    ctx.lineTo(W - 45, currentY + 6);
    ctx.stroke();
  });

  ctx.restore();
}

/** Helper: format short address for ID card */
function formatAddress(data) {
  const parts = [];
  if (data.village) parts.push(data.village);
  if (data.taluka && data.taluka !== data.village) parts.push(data.taluka);
  if (data.district) parts.push(`(${data.district})`);
  return parts.join(', ') || data.address || 'ગુજરાત';
}

/** QR Code */
async function drawQRCode(ctx, data, x, y, size) {
  try {
    const qrData = JSON.stringify({
      id: data.idNumber,
      name: data.fullName,
      org: data.organization,
      mobile: data.mobile,
      verified: true
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      margin: 1,
      width: size,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        // QR Container rounded white box
        drawRoundedRect(ctx, x, y, size, size, 10);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.drawImage(img, x + 3, y + 3, size - 6, size - 6);
        ctx.restore();
        resolve();
      };
      img.onerror = resolve;
      img.src = qrDataUrl;
    });
  } catch (err) {
    console.error('QR code error', err);
  }
}

/** ID Number Box (100% white crisp contrast inside solid orange wave) */
function drawIdNumberBox(ctx, idNumber, x, y) {
  ctx.save();
  // White vertical separator bar
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 24);
  ctx.lineTo(x - 18, y + 40);
  ctx.stroke();

  // "ID No. :" Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 20px "Poppins", sans-serif';
  ctx.fillText('ID No. :', x, y);

  // ID Number Value
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px "Poppins", sans-serif';
  ctx.fillText(idNumber, x, y + 28);

  // Underline for ID No.
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y + 36);
  ctx.lineTo(x + 195, y + 36);
  ctx.stroke();

  ctx.restore();
}

/** Authorized Signature text & mark */
function drawSignature(ctx, x, y) {
  ctx.save();
  // Baseline for signature (on white background on bottom right)
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 70, y - 10);
  ctx.lineTo(x + 70, y - 10);
  ctx.stroke();

  // Gujarati Text: અધિકૃત હસ્તાક્ષર
  ctx.fillStyle = '#111111';
  ctx.font = '900 17px "Noto Sans Gujarati", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('અધિકૃત હસ્તાક્ષર', x, y + 14);
  ctx.restore();
}
