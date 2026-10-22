import { INITIAL_DEMO_MEMBERS } from './data.js';

export const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzPkatrWEiR6Igz9RY2RyncUNbndhnY9Y6IW5wUk_69iWqfo3eUhW51gvYyqqGv5yh4hA/exec';

const STORAGE_KEY = 'sanatan_all_members_v2';

/** Completely clear all local data */
export function clearAllLocalData() {
  try {
    localStorage.removeItem('sanatan_all_members_v1');
    localStorage.removeItem('sanatan_all_members_v2');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    sessionStorage.removeItem('sanatan_current_member');
  } catch (e) {
    console.error('Error clearing data:', e);
  }
}

/** Deduplicate members by idNumber or (mobile + organization) */
export function deduplicateMembers(list) {
  if (!Array.isArray(list)) return [];
  const clean = [];

  list.forEach(m => {
    if (!m) return;
    const isSant = (m.organization || '').includes('સંત');
    const existing = clean.find(c => {
      if (c.idNumber && m.idNumber && c.idNumber === m.idNumber) return true;
      if (c.mobile && m.mobile && String(c.mobile).trim() === String(m.mobile).trim() && (c.organization || '').includes('સંત') === isSant) return true;
      return false;
    });

    if (existing) {
      // Merge best fields into existing member
      if (!existing.photoUrl && m.photoUrl) existing.photoUrl = formatDriveImageUrl(m.photoUrl);
      if (!existing.photoBase64 && m.photoBase64) existing.photoBase64 = m.photoBase64;
      if (m.fullName && (!existing.fullName || existing.fullName.length < m.fullName.length)) existing.fullName = m.fullName;
      if (m.address && !existing.address) existing.address = m.address;
      if (m.village && !existing.village) existing.village = m.village;
      if (m.district && !existing.district) existing.district = m.district;
      if (m.designation && !existing.designation) existing.designation = m.designation;
    } else {
      if (m.photoUrl) {
        m.photoUrl = formatDriveImageUrl(m.photoUrl);
      }
      clean.push({ ...m });
    }
  });

  return clean;
}

/** Get all registered members from local store (auto-deduplicating) */
export function getLocalMembers() {
  try {
    // Clear legacy v1 key if present to guarantee clean fresh slate
    if (localStorage.getItem('sanatan_all_members_v1')) {
      localStorage.removeItem('sanatan_all_members_v1');
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_MEMBERS));
      } catch (e) {}
      return [...INITIAL_DEMO_MEMBERS];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    const deduplicated = deduplicateMembers(parsed);
    if (deduplicated.length !== parsed.length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduplicated));
      } catch (e) {}
    }
    return deduplicated;
  } catch (e) {
    console.warn('getLocalMembers fallback:', e);
    return [];
  }
}

/**
 * Convert Google Drive sharing/view link to high-speed, direct public CDN image URL
 * Uses lh3.googleusercontent.com which bypasses 403, CORB, and cookie restrictions
 */
export function formatDriveImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    return url;
  }
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

/** Save member locally (Strictly duplicate-proof, preserves photos) */
export function saveLocalMember(member) {
  try {
    const list = getLocalMembers();
    if (member.photoUrl) {
      member.photoUrl = formatDriveImageUrl(member.photoUrl);
    }

    const isSant = (member.organization || '').includes('સંત');
    const idx = list.findIndex(m => {
      if (m.idNumber && member.idNumber && m.idNumber === member.idNumber) return true;
      if (m.mobile && member.mobile && String(m.mobile).trim() === String(member.mobile).trim() && (m.organization || '').includes('સંત') === isSant) return true;
      return false;
    });

    if (idx >= 0) {
      // Update existing record, preserve photos
      if (!member.photoBase64 && list[idx].photoBase64) {
        member.photoBase64 = list[idx].photoBase64;
      }
      if (!member.photoUrl && list[idx].photoUrl) {
        member.photoUrl = list[idx].photoUrl;
      }
      list[idx] = { ...list[idx], ...member };
    } else {
      list.unshift(member);
    }

    const cleanList = deduplicateMembers(list);

    // Try saving all members with photos intact
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList));
    } catch (quotaErr) {
      console.warn('LocalStorage quota limit reached, trimming oldest photos:', quotaErr);
      const trimmedList = cleanList.map((m, index) => {
        if (index < 6) return m;
        return { ...m, photoBase64: '' };
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedList));
      } catch (err2) {
        const textOnly = cleanList.map(m => ({ ...m, photoBase64: '' }));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(textOnly));
        } catch (e3) {
          console.error('Critical localStorage write failed:', e3);
        }
      }
    }
    return cleanList;
  } catch (err) {
    console.error('Error in saveLocalMember:', err);
    return [];
  }
}

/**
 * Clean & Format Sequential ID Number (e.g., SYMG-2026-001, SYSS-2026-001)
 */
export function formatSequentialId(prefix, seqNumber) {
  const currentYear = new Date().getFullYear();
  const formattedSeq = String(seqNumber || 1).padStart(3, '0');
  return `${prefix}-${currentYear}-${formattedSeq}`;
}

/**
 * Generate Next Unique Sequential ID for an Organization
 */
export function generateNextIdNumber(orgName) {
  try {
    const orgStr = (orgName || '').toString();
    const isSant = orgStr.includes('સંત');
    const prefix = isSant ? 'SYSS' : 'SYMG';

    const all = getLocalMembers() || [];
    const orgMembers = all.filter(m => {
      if (!m) return false;
      const mOrg = (m.organization || '').toString();
      return isSant ? mOrg.includes('સંત') : !mOrg.includes('સંત');
    });

    let maxSeq = 0;
    orgMembers.forEach(m => {
      if (m && m.idNumber) {
        const match = String(m.idNumber).match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq && num < 1000) {
            maxSeq = num;
          }
        }
      }
    });

    return formatSequentialId(prefix, maxSeq + 1);
  } catch (err) {
    console.error('Error generating sequential ID:', err);
    const isSant = (orgName || '').includes('સંત');
    const prefix = isSant ? 'SYSS' : 'SYMG';
    return formatSequentialId(prefix, 1);
  }
}

/**
 * Re-assign clean sequential IDs to all existing members
 */
export function reassignSequentialIds() {
  try {
    const all = getLocalMembers() || [];
    let manchCount = 0;
    let santCount = 0;

    // Reverse so oldest registrations get lowest IDs
    const chronological = [...all].reverse();

    const updated = chronological.map(m => {
      const isSant = m && m.organization && m.organization.includes('સંત');
      if (isSant) {
        santCount++;
        return { ...m, idNumber: formatSequentialId('SYSS', santCount) };
      } else {
        manchCount++;
        return { ...m, idNumber: formatSequentialId('SYMG', manchCount) };
      }
    });

    // Re-reverse back to newest first
    const result = updated.reverse();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch (e) {
      console.warn('Quota note on reassign:', e);
    }
    return result;
  } catch (err) {
    console.error('Error in reassignSequentialIds:', err);
    return [];
  }
}

let activeSyncPromise = null;

/**
 * Full Synchronous Two-Way Sync with Google Sheets (Master Cloud Source of Truth)
 * When rows are deleted or added in Google Sheets, local data mirrors it 100%!
 */
export async function syncWithGoogleSheets() {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      const timestamp = Date.now();
      const [resManch, resSant] = await Promise.all([
        fetch(`${GAS_ENDPOINT}?action=getMembers&org=${encodeURIComponent('સનાતન યુવા મંચ')}&_t=${timestamp}`, { cache: 'no-store' })
          .then(r => r.json())
          .catch(err => {
            console.warn('Google Sheet Manch fetch warning:', err);
            return null;
          }),
        fetch(`${GAS_ENDPOINT}?action=getMembers&org=${encodeURIComponent('સનાતન યુવા સંત સંગઠન')}&_t=${timestamp}`, { cache: 'no-store' })
          .then(r => r.json())
          .catch(err => {
            console.warn('Google Sheet Sant fetch warning:', err);
            return null;
          })
      ]);

      const manchValid = resManch && resManch.success && Array.isArray(resManch.data);
      const santValid = resSant && resSant.success && Array.isArray(resSant.data);

      if (!manchValid && !santValid) {
        console.warn('Could not sync with Google Sheets (connection error or invalid response)');
        return getLocalMembers();
      }

      const existingLocal = getLocalMembers();

      const mapRow = (row, orgDefault) => {
        const idNum = row['સભ્ય ID'] || '';
        const mob = String(row['મોબાઇલ નંબર'] || '').trim();
        const org = row['સંગઠન'] || orgDefault;

        const existing = existingLocal.find(l => {
          if (idNum && l.idNumber === idNum) return true;
          if (mob && l.mobile && String(l.mobile).trim() === mob) return true;
          return false;
        });

        return {
          idNumber: idNum,
          organization: org,
          fullName: row['પૂરું નામ'] || '',
          fatherName: row['પિતા/વાલીનું નામ'] || '',
          dob: row['જન્મતારીખ'] ? String(row['જન્મતારીખ']).slice(0, 10) : '',
          age: row['ઉંમર'] ? String(row['ઉંમર']) : '',
          village: row['ગામ/શહેર'] || '',
          taluka: row['તાલુકો'] || '',
          district: row['જિલ્લો'] || '',
          address: row['સંપૂર્ણ સરનામું'] || '',
          mobile: mob,
          whatsapp: String(row['WhatsApp નંબર'] || ''),
          email: row['ઈમેઇલ'] || '',
          memberType: row['સભ્ય પ્રકાર'] || 'સામાન્ય સભ્ય',
          designation: row['પદ/હોદ્દો'] || 'સભ્ય',
          occupation: row['વ્યવસાય/અભ્યાસ'] || '',
          skill: row['સેવા રસ/કુશળતા'] || '',
          prevOrg: row['અગાઉનું સંગઠન'] || '',
          photoUrl: formatDriveImageUrl(row['પ્રોફાઇલ ફોટો લિંક'] || ''),
          photoBase64: existing ? existing.photoBase64 || '' : '',
          status: row['સ્ટેટસ'] || 'મંજૂર',
          createdAt: row['તારીખ-સમય'] || ''
        };
      };

      let newAllMembers = [];

      if (manchValid) {
        newAllMembers.push(...resManch.data.map(r => mapRow(r, 'સનાતન યુવા મંચ')));
      } else {
        newAllMembers.push(...existingLocal.filter(m => !m.organization.includes('સંત')));
      }

      if (santValid) {
        newAllMembers.push(...resSant.data.map(r => mapRow(r, 'સનાતન યુવા સંત સંગઠન')));
      } else {
        newAllMembers.push(...existingLocal.filter(m => m.organization.includes('સંત')));
      }

      const cleanList = deduplicateMembers(newAllMembers);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList));
      } catch (e) {
        console.warn('Sync write note:', e);
      }

      return cleanList;
    } catch (err) {
      console.error('Error in syncWithGoogleSheets:', err);
      return getLocalMembers();
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/** Fetch remote members wrapper */
export async function fetchRemoteMembers(orgName) {
  const synced = await syncWithGoogleSheets();
  const isSant = (orgName || '').includes('સંત');
  return synced.filter(m => (m.organization || '').includes('સંત') === isSant);
}

/**
 * Client-Side Image Compression
 * Resizes photo to max 480x600px and 0.82 JPEG quality (~70-90 KB)
 */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 480;
        const MAX_H = 600;
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > MAX_W) {
            h *= MAX_W / w;
            w = MAX_W;
          }
        } else {
          if (h > MAX_H) {
            w *= MAX_H / h;
            h = MAX_H;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Submit member to Google Apps Script and local store */
export async function submitMemberData(memberData) {
  // 1. Always save locally immediately
  saveLocalMember(memberData);

  // 2. Post to Google Apps Script
  try {
    const payload = {
      action: 'register',
      organization: memberData.organization,
      idNumber: memberData.idNumber,
      fullName: memberData.fullName,
      fatherName: memberData.fatherName,
      dob: memberData.dob,
      age: memberData.age,
      village: memberData.village,
      taluka: memberData.taluka,
      district: memberData.district,
      address: memberData.address,
      mobile: memberData.mobile,
      whatsapp: memberData.whatsapp,
      email: memberData.email,
      memberType: memberData.memberType,
      designation: memberData.designation,
      occupation: memberData.occupation,
      skill: memberData.skill,
      prevOrg: memberData.prevOrg,
      photoBase64: memberData.photoBase64,
      photoMimeType: 'image/jpeg',
      status: memberData.status || 'મંજૂર'
    };

    const res = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // GAS accepts raw text body without CORS preflight block
      },
      body: JSON.stringify(payload)
    });

    try {
      const json = await res.json();
      if (json && json.photoUrl) {
        memberData.photoUrl = formatDriveImageUrl(json.photoUrl);
        saveLocalMember(memberData);
      }
    } catch (jsonErr) {
      console.warn('GAS response parse note (data was sent):', jsonErr);
    }
    return { success: true, member: memberData };
  } catch (error) {
    console.warn('Google Sheet submission note (saved locally):', error);
    return { success: true, member: memberData, synced: false };
  }
}
