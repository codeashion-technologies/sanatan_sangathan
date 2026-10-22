import './style.css';
import confetti from 'canvas-confetti';
import { GUJARAT_DISTRICTS, DESIGNATIONS } from './data.js';
import { getLocalMembers, saveLocalMember, submitMemberData, compressImage, fetchRemoteMembers, generateNextIdNumber, reassignSequentialIds, formatDriveImageUrl, clearAllLocalData, syncWithGoogleSheets } from './api.js';
import { renderIdCard, generateIdCardBlob } from './cardRenderer.js';

/**
 * Named Routes Definition
 */
export const ROUTES = {
  HOME: '/',
  REGISTER: '/register',
  ID_CARD: '/id-card',
  ADMIN: '/admin'
};

// Application State
const state = {
  currentView: 'splash', // splash, home, form, id_card, admin_login, admin
  selectedOrg: 'સનાતન યુવા મંચ',
  currentMember: null,
  activeAdminTab: 'manch', // manch or sant
  adminSearch: '',
  adminDistrict: '',
  adminType: '',
  isAdminLoggedIn: false,
  isViewingFromAdmin: false,
  hasAutoSyncedAdmin: false,
  photoPreviewBase64: null,
  isSubmitting: false,
  splashShown: false
};

const appEl = document.getElementById('app');

/**
 * Clean Named Route Navigation
 */
export function navigateTo(url, replace = false) {
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
  handleRoute();
}

/**
 * Route Matcher & Dispatcher
 */
function handleRoute() {
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '') || '/';
  const hash = window.location.hash.toLowerCase().replace(/\/$/, '');
  const searchParams = new URLSearchParams(window.location.search);

  // 1. Admin Route: /admin or #admin
  if (path === '/admin' || hash === '#admin' || hash === '#/admin') {
    state.currentView = state.isAdminLoggedIn ? 'admin' : 'admin_login';
    render();
    if (state.isAdminLoggedIn && !state.hasAutoSyncedAdmin) {
      state.hasAutoSyncedAdmin = true;
      syncWithGoogleSheets().then(() => {
        if (state.currentView === 'admin') render();
      }).catch(() => {});
    }
    return;
  }

  // 2. ID Card Route: /id-card or #id-card
  if (path === '/id-card' || hash === '#id-card' || hash === '#/id-card') {
    if (searchParams.get('from') === 'admin') {
      state.isViewingFromAdmin = true;
    }
    if (!state.currentMember) {
      try {
        const sessionM = sessionStorage.getItem('sanatan_current_member');
        if (sessionM) state.currentMember = JSON.parse(sessionM);
      } catch(e) {}
    }
    if (!state.currentMember) {
      const all = getLocalMembers();
      state.currentMember = all.length > 0 ? all[0] : null;
    }
    if (state.currentMember) {
      state.currentView = 'id_card';
    } else {
      navigateTo(ROUTES.HOME, true);
      return;
    }
    render();
    return;
  }

  // 3. Registration Form Route: /register, /form or #register
  if (path === '/register' || path === '/form' || hash === '#register' || hash === '#form') {
    state.isViewingFromAdmin = false;
    const orgParam = searchParams.get('org');
    if (orgParam === 'sant' || orgParam === '1') {
      state.selectedOrg = 'સનાતન યુવા સંત સંગઠન';
    } else if (orgParam === 'manch' || orgParam === '2') {
      state.selectedOrg = 'સનાતન યુવા મંચ';
    }
    state.currentView = 'form';
    render();
    return;
  }

  // 4. Root / Home Route: /
  // Show splash only on first cold visit to root
  if (!state.splashShown && sessionStorage.getItem('sanatan_splash_done') !== 'true') {
    state.currentView = 'splash';
    render();
    setTimeout(() => {
      if (state.currentView === 'splash') {
        state.splashShown = true;
        sessionStorage.setItem('sanatan_splash_done', 'true');
        state.currentView = 'home';
        render();
      }
    }, 2200);
    return;
  }

  state.currentView = 'home';
  state.isViewingFromAdmin = false;
  render();
}

/** Initialize Application */
function init() {
  // Ensure local store is cleanly loaded and deduplicated
  try {
    getLocalMembers();
  } catch (err) {
    console.warn('Init store note:', err);
  }

  handleRoute();

  // Listen to browser Back & Forward navigation buttons
  window.addEventListener('popstate', handleRoute);
  window.addEventListener('hashchange', handleRoute);
}

/** Master Render Function */
function render() {
  if (state.currentView === 'splash') {
    renderSplash();
    return;
  }

  // Toggle admin mode style on root
  if (state.currentView === 'admin') {
    appEl.classList.add('admin-mode-active');
  } else {
    appEl.classList.remove('admin-mode-active');
  }

  appEl.innerHTML = `
    ${renderHeader()}
    <main class="view-content">
      ${state.currentView === 'home' ? renderHome() : ''}
      ${state.currentView === 'form' ? renderForm() : ''}
      ${state.currentView === 'id_card' ? renderIdCardView() : ''}
      ${state.currentView === 'admin_login' ? renderAdminLogin() : ''}
      ${state.currentView === 'admin' ? renderAdminDashboard() : ''}
    </main>
  `;

  attachEventListeners();

  // If on ID Card view, render the canvas
  if (state.currentView === 'id_card' && state.currentMember) {
    const canvas = document.getElementById('idCardCanvas');
    if (canvas) {
      renderIdCard(canvas, state.currentMember).catch(err => {
        console.error('ID Card canvas render error:', err);
      });
    }
  }
}

/** 1. Splash Screen */
function renderSplash() {
  appEl.innerHTML = `
    <div class="splash-container">
      <div class="splash-logo-wrap">
        <div class="splash-glow-ring"></div>
        <img src="/assets/logo.jpg" alt="સનાતન સંગઠન લોગો" class="splash-logo-img" />
      </div>
      <h1 class="splash-title">સનાતન યુવા સંત સંગઠન<br>& સનાતન યુવા મંચ</h1>
      <p class="splash-subtitle">ગુજરાત પ્રદેશ</p>
      <div class="splash-tagline">
        એકતા | સેવા | સંસ્કાર | સંગઠન | સશક્ત ગુજરાત
      </div>
      <div class="splash-loading-bar">
        <div class="splash-loading-progress"></div>
      </div>
      <button class="splash-skip-btn" id="btnSkipSplash">
        આગળ વધો <i class="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  `;

  document.getElementById('btnSkipSplash')?.addEventListener('click', () => {
    state.splashShown = true;
    sessionStorage.setItem('sanatan_splash_done', 'true');
    navigateTo(ROUTES.HOME, true);
  });
}

/** 2. Header Component */
function renderHeader() {
  const isAdminView = state.currentView === 'admin' || state.currentView === 'admin_login';
  return `
    <header class="app-header">
      <div class="header-brand" id="btnGoHome">
        <img src="/assets/logo.jpg" alt="લોગો" class="header-logo" />
        <div class="header-title">
          <span class="header-title-main">${isAdminView ? 'એડમિન પોર્ટલ' : 'સનાતન યુવા સંગઠન'}</span>
          <span class="header-title-sub">ગુજરાત પ્રદેશ</span>
        </div>
      </div>
      ${isAdminView ? `
        <div class="header-actions">
          <button class="btn-icon" id="btnExitAdmin" title="યુઝર સાઇટ પર પાછા જાઓ">
            <i class="fa-solid fa-house"></i>
          </button>
        </div>
      ` : ''}
    </header>
  `;
}

/** 3. Home Screen (Organization Selection) */
function renderHome() {
  return `
    <div class="hero-banner">
      <div class="hero-tag">
        <i class="fa-solid fa-om"></i> સનાતન ધર્મ રક્ષણ & સેવા
      </div>
      <h2 class="hero-heading">ડિજિટલ સભ્ય નોંધણી પોર્ટલ</h2>
      <p class="hero-desc">તમારું સંગઠન પસંદ કરી ૧ મિનિટમાં ડિજિટલ ID કાર્ડ મેળવો</p>
    </div>

    <div class="section-label">સંગઠન પસંદ કરો:</div>

    <div class="org-cards-grid">
      <!-- Option 1: Sant Sangathan -->
      <div class="org-card org-card-sant" data-org="સનાતન યુવા સંત સંગઠન" data-param="sant">
        <div class="org-card-icon-wrap">
          <i class="fa-solid fa-sun"></i>
        </div>
        <div class="org-card-body">
          <h3 class="org-card-title">સનાતન યુવા સંત સંગઠન</h3>
          <p class="org-card-subtitle">પૂજ્ય સંતો, મહંતો અને સાધક યુવાનોનું સંગઠન</p>
        </div>
        <div class="org-card-arrow">
          <i class="fa-solid fa-circle-chevron-right"></i>
        </div>
      </div>

      <!-- Option 2: Yuva Manch -->
      <div class="org-card org-card-manch" data-org="સનાતન યુવા મંચ" data-param="manch">
        <div class="org-card-icon-wrap">
          <i class="fa-solid fa-hand-fist"></i>
        </div>
        <div class="org-card-body">
          <h3 class="org-card-title">સનાતન યુવા મંચ</h3>
          <p class="org-card-subtitle">સશક્ત યુવા શક્તિ, સામાજિક સેવા અને રાષ્ટ્ર હિત</p>
        </div>
        <div class="org-card-arrow">
          <i class="fa-solid fa-circle-chevron-right"></i>
        </div>
      </div>
    </div>

    <!-- Quick Features -->
    <div class="features-grid">
      <div class="feature-pill">
        <div class="feature-pill-icon"><i class="fa-solid fa-id-card"></i></div>
        <div class="feature-pill-title">ત્વરિત ID કાર્ડ</div>
        <div class="feature-pill-sub">ઓનલાઇન જનરેટ</div>
      </div>
      <div class="feature-pill">
        <div class="feature-pill-icon"><i class="fa-solid fa-qrcode"></i></div>
        <div class="feature-pill-title">QR વેરિફિકેશન</div>
        <div class="feature-pill-sub">સત્તાવાર માન્યતા</div>
      </div>
      <div class="feature-pill">
        <div class="feature-pill-icon"><i class="fa-brands fa-whatsapp"></i></div>
        <div class="feature-pill-title">સરળ શેરિંગ</div>
        <div class="feature-pill-sub">WhatsApp પર</div>
      </div>
    </div>
  `;
}

/** 4. Membership Registration Form (PDF Faithful) */
function renderForm() {
  return `
    <div class="form-header-bar">
      <div class="form-header-info">
        <span class="form-header-org">${state.selectedOrg}</span>
        <span class="form-header-tag">સભ્ય નોંધણી ફોર્મ</span>
      </div>
      <button class="btn-change-org" id="btnChangeOrg">
        <i class="fa-solid fa-arrow-left"></i> સંગઠન બદલો
      </button>
    </div>

    <form id="membershipForm" autocomplete="off">
      <!-- Section 1: Personal Information -->
      <div class="form-section">
        <div class="form-section-title">
          <i class="fa-solid fa-user"></i> ૧. વ્યક્તિગત માહિતી
        </div>

        <div class="form-group">
          <label class="form-label">પૂરું નામ <span class="req">*</span></label>
          <input type="text" name="fullName" class="form-input" placeholder="દા.ત. રમેશભાઈ પટેલ" required />
        </div>

        <div class="form-group">
          <label class="form-label">પિતાનું / વાલીનું નામ <span class="req">*</span></label>
          <input type="text" name="fatherName" class="form-input" placeholder="દા.ત. શાંતિલાલ" required />
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">જન્મતારીખ <span class="req">*</span></label>
            <input type="date" name="dob" id="dobInput" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">ઉંમર (વર્ષ) <span class="req">*</span></label>
            <input type="number" name="age" id="ageInput" class="form-input" placeholder="૨૫" min="10" max="100" required />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">ગામ / શહેર <span class="req">*</span></label>
            <input type="text" name="village" class="form-input" placeholder="દા.ત. ગઢડા" required />
          </div>
          <div class="form-group">
            <label class="form-label">તાલુકો <span class="req">*</span></label>
            <input type="text" name="taluka" class="form-input" placeholder="દા.ત. ગઢડા" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">જિલ્લો <span class="req">*</span></label>
          <select name="district" class="form-select" required>
            <option value="">-- જિલ્લો પસંદ કરો --</option>
            ${GUJARAT_DISTRICTS.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">સંપૂર્ણ સરનામું <span class="req">*</span></label>
          <textarea name="address" class="form-textarea" rows="2" placeholder="ઘર નંબર, સોસાયટી/શેરી, વિસ્તાર..." required></textarea>
        </div>
      </div>

      <!-- Section 2: Contact Information -->
      <div class="form-section">
        <div class="form-section-title">
          <i class="fa-solid fa-phone"></i> ૨. સંપર્ક માહિતી
        </div>

        <div class="form-group">
          <label class="form-label">મોબાઇલ નંબર (૧૦ અંક) <span class="req">*</span></label>
          <input type="tel" name="mobile" id="mobileInput" class="form-input" pattern="[0-9]{10}" placeholder="દા.ત. 9876543210" maxlength="10" required />
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin: 0;">WhatsApp નંબર <span class="req">*</span></label>
            <label style="font-size: 11.5px; color: var(--primary-dark); cursor: pointer;">
              <input type="checkbox" id="chkSameWhatsapp" style="margin-right: 4px;"> મોબાઇલ જેવો જ
            </label>
          </div>
          <input type="tel" name="whatsapp" id="whatsappInput" class="form-input" pattern="[0-9]{10}" placeholder="દા.ત. 9876543210" maxlength="10" required />
        </div>

        <div class="form-group">
          <label class="form-label">ઈમેઇલ (વૈકલ્પિક)</label>
          <input type="email" name="email" class="form-input" placeholder="example@gmail.com" />
        </div>
      </div>

      <!-- Section 3: Organization & Role -->
      <div class="form-section">
        <div class="form-section-title">
          <i class="fa-solid fa-sitemap"></i> ૩. સંગઠન સંબંધિત માહિતી
        </div>

        <div class="form-group">
          <label class="form-label">સભ્યનો પ્રકાર <span class="req">*</span></label>
          <div class="member-type-options">
            <label class="radio-card active" data-type="સામાન્ય સભ્ય">
              <span class="radio-circle"></span>
              <span class="radio-label">સામાન્ય સભ્ય</span>
            </label>
            <label class="radio-card" data-type="કાર્યકર">
              <span class="radio-circle"></span>
              <span class="radio-label">કાર્યકર (સક્રિય કાર્યકર્તા)</span>
            </label>
            <label class="radio-card" data-type="હોદ્દેદાર માટે અરજી">
              <span class="radio-circle"></span>
              <span class="radio-label">હોદ્દેદાર માટે અરજી</span>
            </label>
          </div>
          <input type="hidden" name="memberType" id="memberTypeInput" value="સામાન્ય સભ્ય" />
        </div>

        <!-- Conditional Designation Box -->
        <div class="form-group" id="designationGroup" style="display: none;">
          <label class="form-label">ઈચ્છિત પદ / હોદ્દો <span class="req">*</span></label>
          <select name="designation" id="designationSelect" class="form-select">
            <option value="">-- પદ / હોદ્દો પસંદ કરો --</option>
            ${DESIGNATIONS.map(p => `<option value="${p.split(' ')[0]}">${p}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">વ્યવસાય / અભ્યાસ <span class="req">*</span></label>
          <input type="text" name="occupation" class="form-input" placeholder="દા.ત. વેપાર, ખેતી, વિદ્યાર્થી, નોકરી..." required />
        </div>

        <div class="form-group">
          <label class="form-label">સેવા આપવા માટેનો રસ / કુશળતા</label>
          <input type="text" name="skill" class="form-input" placeholder="દા.ત. મેનેજમેન્ટ, આઈટી, સંગીત, પ્રચાર..." />
        </div>

        <div class="form-group">
          <label class="form-label">અગાઉનું સામાજિક / ધાર્મિક સંગઠન (વૈકલ્પિક)</label>
          <input type="text" name="prevOrg" class="form-input" placeholder="જો કોઈ હોય તો નામ લખો" />
        </div>

        <!-- Photo Upload Box -->
        <div class="form-group">
          <label class="form-label">ID કાર્ડ માટે પાસપોર્ટ ફોટો <span class="req">*</span></label>
          <input type="file" id="photoFileInput" accept="image/*" capture="user" style="display: none;" />
          
          <div class="photo-uploader" id="photoDropArea">
            ${state.photoPreviewBase64 ? `
              <div class="photo-preview-wrap">
                <img src="${state.photoPreviewBase64}" class="photo-preview-img" alt="સભ્ય ફોટો" />
                <button type="button" class="btn-photo-action" id="btnChangePhoto">
                  <i class="fa-solid fa-camera"></i> ફોટો બદલો
                </button>
              </div>
            ` : `
              <div class="photo-upload-placeholder">
                <div class="photo-upload-icon"><i class="fa-solid fa-camera"></i></div>
                <div class="photo-upload-text">ફોટો પસંદ કરો અથવા કેમેરાથી પાડો</div>
                <div class="photo-upload-hint">સ્પષ્ટ પાસપોર્ટ સાઇઝ ફોટો વધુ સારો દેખાશે</div>
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Section 4: Declaration & Consent -->
      <div class="form-section">
        <div class="form-section-title">
          <i class="fa-solid fa-file-contract"></i> ૪. ઘોષણા અને સંમતિ
        </div>

        <div class="declaration-box">
          હું સ્વેચ્છાએ <strong>${state.selectedOrg} ગુજરાત</strong>નો સભ્ય બનવા માટે અરજી કરું છું. હું સંગઠનના હેતુઓ, નિયમો, એકતા, સેવા, સંસ્કાર અને સમાજહિતનાં કાર્યોમાં સહયોગ આપવા સંમત છું. હું સંગઠનની શાંતિપૂર્ણ, કાયદેસર અને શિસ્તબદ્ધ કાર્યપદ્ધતિનું પાલન કરીશ. મારા દ્વારા આપવામાં આવેલી માહિતી મારી જાણ મુજબ સાચી છે.
        </div>

        <label class="checkbox-consent">
          <input type="checkbox" id="chkConsent" required />
          <span class="checkbox-label">હું ઉપર જણાવેલ તમામ નિયમો અને ઘોષણા સ્વીકારું છું. <span class="req">*</span></span>
        </label>
      </div>

      <!-- Submit Button -->
      <button type="submit" class="btn-primary-submit" id="btnSubmitForm" ${state.isSubmitting ? 'disabled' : ''}>
        ${state.isSubmitting ? `
          <i class="fa-solid fa-spinner fa-spin"></i> ID કાર્ડ જનરેટ થઈ રહ્યું છે...
        ` : `
          <i class="fa-solid fa-id-card"></i> સભ્ય નોંધણી પૂર્ણ કરો & ID મેળવો
        `}
      </button>
    </form>
  `;
}

/** 5. Generated ID Card View */
function renderIdCardView() {
  const m = state.currentMember;
  if (!m) return `<p style="padding: 20px; text-align: center;">કોઈ વિગત મળી નથી.</p>`;

  return `
    <div class="id-card-view-wrap">
      <div class="congrats-card" ${state.isViewingFromAdmin ? 'style="padding: 10px 14px;"' : ''}>
        ${!state.isViewingFromAdmin ? `
          <div class="congrats-title">🎉 અભિનંદન! સભ્યપદ સફળતાપૂર્વક નોંધાયું છે</div>
          <div class="congrats-sub">તમારું ડિજિટલ સભ્ય ID કાર્ડ નીચે મુજબ તૈયાર છે</div>
        ` : ''}
        <div class="id-badge-pill" ${state.isViewingFromAdmin ? 'style="margin-top: 0;"' : ''}>
          <span>સભ્ય ID નંબર: <strong>${m.idNumber}</strong></span>
          <button type="button" class="btn-copy-id" id="btnCopyId" title="ID નંબર કોપી કરો">
            <i class="fa-solid fa-copy"></i> કોપી કરો
          </button>
        </div>
      </div>

      <!-- Canvas ID Card Stage -->
      <div class="id-canvas-stage">
        <canvas id="idCardCanvas"></canvas>
      </div>

      <!-- Action Buttons -->
      <div class="card-actions-grid">
        <button class="btn-card-action btn-download-hd" id="btnDownloadCard">
          <i class="fa-solid fa-download"></i> ID કાર્ડ ડાઉનલોડ કરો (HD)
        </button>

        ${state.isViewingFromAdmin ? `
          <button class="btn-card-action btn-secondary-action" id="btnBackToAdmin">
            <i class="fa-solid fa-arrow-left"></i> એડમિન પોર્ટલ પર પાછા જાઓ
          </button>
        ` : `
          <button class="btn-card-action btn-secondary-action" id="btnNewRegistration">
            <i class="fa-solid fa-user-plus"></i> નવી સભ્ય નોંધણી કરો
          </button>
        `}
      </div>
    </div>
  `;
}

/** 6. Dedicated Admin PIN Login Screen (accessed only via /admin) */
function renderAdminLogin() {
  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 65vh; padding: 20px; text-align: center;">
      <div style="background: #FFFFFF; border: 2px solid #FFE0B2; border-radius: var(--radius-lg); padding: 32px 22px; width: 100%; max-width: 380px; box-shadow: var(--shadow-md);">
        <img src="/assets/logo.jpg" alt="Logo" style="width: 72px; height: 72px; border-radius: 50%; border: 3px solid var(--primary); margin-bottom: 14px; object-fit: cover;" />
        <h2 style="font-size: 19px; font-weight: 800; color: var(--primary-dark); margin-bottom: 4px;">એડમિન પોર્ટલ લૉગિન</h2>
        <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 20px;">સંચાલન પેનલ ઍક્સેસ કરવા માટે PIN દાખલ કરો</p>
        
        <form id="adminLoginForm">
          <input type="password" id="adminPinInput" class="form-input" placeholder="••••" maxlength="8" autofocus style="font-size: 24px; text-align: center; letter-spacing: 8px; margin-bottom: 8px;" required />
          <p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 18px;">ડિફોલ્ટ એડમિન PIN: <strong>1234</strong></p>
          
          <button type="submit" class="btn-primary-submit" style="margin-bottom: 12px;">
            <i class="fa-solid fa-lock-open"></i> લૉગિન કરો
          </button>
        </form>

        <button type="button" class="btn-card-action btn-secondary-action" id="btnAdminBackToHome" style="font-size: 13px; padding: 10px;">
          <i class="fa-solid fa-arrow-left"></i> યુઝર સાઇટ પર પાછા જાઓ
        </button>
      </div>
    </div>
  `;
}

/** 7. Admin Dashboard */
function renderAdminDashboard() {
  const allMembers = getLocalMembers();
  const santMembers = allMembers.filter(m => m.organization.includes('સંત'));
  const manchMembers = allMembers.filter(m => !m.organization.includes('સંત'));

  const currentOrgMembers = state.activeAdminTab === 'sant' ? santMembers : manchMembers;

  // Filtered members
  const filtered = currentOrgMembers.filter(m => {
    const q = state.adminSearch.toLowerCase();
    const matchSearch = !q || 
      (m.fullName && m.fullName.toLowerCase().includes(q)) ||
      (m.mobile && m.mobile.includes(q)) ||
      (m.idNumber && m.idNumber.toLowerCase().includes(q)) ||
      (m.village && m.village.toLowerCase().includes(q));

    const matchDistrict = !state.adminDistrict || (m.district && m.district.includes(state.adminDistrict));
    const matchType = !state.adminType || m.memberType === state.adminType;

    return matchSearch && matchDistrict && matchType;
  });

  return `
    <div style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <h2 style="font-size: 18px; font-weight: 800; color: var(--primary-dark);">
        <i class="fa-solid fa-shield-halved"></i> એડમિન સંચાલન પોર્ટલ
      </h2>
      <div style="display: flex; gap: 8px;">
        <button class="btn-photo-action" id="btnSyncSheet" title="Google Sheet સાથે લાઈવ સિંક કરો">
          <i class="fa-solid fa-arrows-rotate"></i> લાઈવ સિંક
        </button>
        <button class="btn-photo-action" id="btnExportCSV" title="ડેટા એક્સેલ/CSV માં ડાઉનલોડ કરો">
          <i class="fa-solid fa-file-excel"></i> Excel Export
        </button>
        <button class="btn-photo-action" id="btnClearAllData" style="background: #FFF3E0; border-color: #FFA726; color: #E65100;" title="બધો લોકલ ડેટા સાફ કરો">
          <i class="fa-solid fa-trash-can"></i> ડેટા સાફ કરો
        </button>
        <button class="btn-photo-action" id="btnLogoutAdmin" style="background: #FFEBEE; border-color: #EF5350; color: #C62828;" title="એડમિનમાંથી બહાર નીકળો">
          <i class="fa-solid fa-right-from-bracket"></i> લૉગઆઉટ
        </button>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="admin-stats-row">
      <div class="admin-stat-card">
        <div class="admin-stat-num">${allMembers.length}</div>
        <div class="admin-stat-lbl">કુલ સભ્યો</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-num">${santMembers.length}</div>
        <div class="admin-stat-lbl">સંત સંગઠન</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-num">${manchMembers.length}</div>
        <div class="admin-stat-lbl">યુવા મંચ</div>
      </div>
    </div>

    <!-- 2 Organization Tabs -->
    <div class="admin-header-tabs">
      <button class="admin-tab ${state.activeAdminTab === 'sant' ? 'active' : ''}" data-tab="sant">
        🚩 સનાતન યુવા સંત સંગઠન (${santMembers.length})
      </button>
      <button class="admin-tab ${state.activeAdminTab === 'manch' ? 'active' : ''}" data-tab="manch">
        🚩 સનાતન યુવા મંચ (${manchMembers.length})
      </button>
    </div>

    <!-- Search & Filter Bar -->
    <div class="admin-filter-bar">
      <input type="text" class="admin-search-input" id="adminSearchInput" placeholder="સભ્યનું નામ, ID, મોબાઇલ કે ગામ શોધો..." value="${state.adminSearch}" />
      
      <select class="admin-select-filter" id="adminDistrictSelect">
        <option value="">બધા જિલ્લા</option>
        ${GUJARAT_DISTRICTS.map(d => `<option value="${d.split(' ')[0]}" ${state.adminDistrict === d.split(' ')[0] ? 'selected' : ''}>${d.split(' ')[0]}</option>`).join('')}
      </select>

      <select class="admin-select-filter" id="adminTypeSelect">
        <option value="">બધા પ્રકાર</option>
        <option value="સામાન્ય સભ્ય" ${state.adminType === 'સામાન્ય સભ્ય' ? 'selected' : ''}>સામાન્ય સભ્ય</option>
        <option value="કાર્યકર" ${state.adminType === 'કાર્યકર' ? 'selected' : ''}>કાર્યકર</option>
        <option value="હોદ્દેદાર માટે અરજી" ${state.adminType === 'હોદ્દેદાર માટે અરજી' ? 'selected' : ''}>હોદ્દેદાર</option>
      </select>
    </div>

    <!-- Members List -->
    <div class="members-list-grid">
      ${filtered.length === 0 ? `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          કોઈ સભ્યની નોંધણી મળી નથી.
        </div>
      ` : filtered.map(m => `
        <div class="member-item-card">
          <div class="member-item-info">
            <img 
              src="${m.photoBase64 || formatDriveImageUrl(m.photoUrl) || '/assets/logo.jpg'}" 
              class="member-avatar" 
              alt="${m.fullName}" 
              loading="lazy"
              onerror="this.onerror=null; this.src='/assets/logo.jpg';"
            />
            <div class="member-details">
              <span class="member-name">${m.fullName}</span>
              <span class="member-sub">${m.designation || m.memberType} • ${m.village || m.district}</span>
              <span class="member-sub"><i class="fa-solid fa-phone" style="font-size: 10px;"></i> ${m.mobile}</span>
              <span class="member-id-pill">${m.idNumber}</span>
            </div>
          </div>
          <div class="member-item-actions">
            <button class="btn-admin-action btn-view-card" data-id="${m.idNumber}" title="ID કાર્ડ જુઓ & ડાઉનલોડ કરો">
              <i class="fa-solid fa-id-card"></i>
            </button>
            <button class="btn-admin-action btn-whatsapp-member" data-mobile="${m.mobile}" data-name="${m.fullName}" data-id="${m.idNumber}" title="WhatsApp મેસેજ">
              <i class="fa-brands fa-whatsapp"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/** Show temporary toast notice */
function showToast(msg) {
  const existing = document.querySelector('.toast-notice');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notice';
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #4CAF50;"></i> ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

/** Interactive Modal Dialog for WhatsApp Card Sharing */
function showWhatsAppCardModal(member, imageUrl, filename, cleanMobile) {
  const existing = document.getElementById('waCardModalOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'waCardModalOverlay';
  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 380px;">
      <div class="modal-header" style="background: #F1F8E9;">
        <div class="modal-title" style="color: #2E7D32; font-size: 15px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-brands fa-whatsapp" style="font-size: 20px; color: #25D366;"></i>
          <span>WhatsApp ID કાર્ડ શેર</span>
        </div>
        <button type="button" class="modal-close-btn" id="btnCloseWaModal">&times;</button>
      </div>

      <div class="modal-body" style="text-align: center; padding: 16px 18px;">
        <div style="font-weight: 800; font-size: 15px; color: var(--text-primary); margin-bottom: 2px;">
          ${member.fullName}
        </div>
        <div style="font-size: 12px; color: var(--primary-dark); font-weight: 700; margin-bottom: 12px;">
          ID: ${member.idNumber} | 📱 ${member.mobile}
        </div>

        <div style="position: relative; display: inline-block; margin-bottom: 14px;">
          <img src="${imageUrl}" alt="ID Card PNG" style="width: 140px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.18); border: 2.5px solid #FF6F00; display: block;" />
          <span style="position: absolute; bottom: -8px; right: -8px; background: #25D366; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            PNG HD
          </span>
        </div>

        <div style="background: #E8F5E9; border: 1.5px solid #81C784; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; text-align: left;">
          <div style="font-size: 12.5px; font-weight: 800; color: #1B5E20; margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-check"></i> કાર્ડ ક્લિપબોર્ડમાં કોપી થઈ ગયું છે!
          </div>
          <div style="font-size: 11.5px; color: #2E7D32; line-height: 1.4;">
            👉 WhatsApp Web ખૂલ્યા પછી ચેટમાં ફક્ત <strong><kbd style="background: #FFFFFF; border: 1px solid #81C784; padding: 1px 5px; border-radius: 4px; font-weight: bold;">Ctrl + V</kbd></strong> (Paste) કરો અને એન્ટર આપો!
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <a href="https://web.whatsapp.com/send?phone=91${cleanMobile}" target="_blank" class="btn-card-action btn-share-whatsapp" style="text-decoration: none; padding: 11px; font-size: 13.5px;" id="btnOpenWaDirect">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp ચેટ ખોલો
          </a>
          <button type="button" class="btn-card-action btn-secondary-action" id="btnDismissWaModal" style="padding: 9px; font-size: 12.5px;">
            સમજાઈ ગયું / બંધ કરો
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('btnCloseWaModal')?.addEventListener('click', close);
  document.getElementById('btnDismissWaModal')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

/** Attach All Event Listeners */
function attachEventListeners() {
  // Brand Header Click -> Go to Home Route
  document.getElementById('btnGoHome')?.addEventListener('click', () => {
    navigateTo(ROUTES.HOME);
  });

  // Admin Exit Button (in Admin view) -> Go to Home Route
  document.getElementById('btnExitAdmin')?.addEventListener('click', () => {
    navigateTo(ROUTES.HOME);
  });

  // Admin Back to Home (from login form) -> Go to Home Route
  document.getElementById('btnAdminBackToHome')?.addEventListener('click', () => {
    navigateTo(ROUTES.HOME);
  });

  // Admin Login Submit
  document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('adminPinInput')?.value;
    if (pin === '1234') {
      state.isAdminLoggedIn = true;
      state.currentView = 'admin';
      render();
      showToast('એડમિન પોર્ટલમાં આપનું સ્વાગત છે!');
      syncWithGoogleSheets().then(() => {
        if (state.currentView === 'admin') render();
      }).catch(() => {});
    } else {
      alert('ખોટો PIN! ડિફોલ્ટ PIN 1234 છે.');
    }
  });

  // Admin Logout -> Go to Home Route
  document.getElementById('btnLogoutAdmin')?.addEventListener('click', () => {
    state.isAdminLoggedIn = false;
    navigateTo(ROUTES.HOME);
    showToast('સફળતાપૂર્વક લૉગઆઉટ થયા.');
  });

  // Organization Select Cards (Home View) -> Go to /register?org=sant or /register?org=manch
  document.querySelectorAll('.org-card').forEach(card => {
    card.addEventListener('click', () => {
      const orgName = card.getAttribute('data-org');
      const param = card.getAttribute('data-param');
      state.selectedOrg = orgName;
      navigateTo(`${ROUTES.REGISTER}?org=${param}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Change Org Button (Form View) -> Back to Home
  document.getElementById('btnChangeOrg')?.addEventListener('click', () => {
    navigateTo(ROUTES.HOME);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Member Type Radio Cards
  document.querySelectorAll('.radio-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const val = card.getAttribute('data-type');
      const hiddenInput = document.getElementById('memberTypeInput');
      if (hiddenInput) hiddenInput.value = val;

      const desigGroup = document.getElementById('designationGroup');
      if (desigGroup) {
        if (val === 'હોદ્દેદાર માટે અરજી') {
          desigGroup.style.display = 'block';
        } else {
          desigGroup.style.display = 'none';
        }
      }
    });
  });

  // Auto Age Calculation on DOB change
  const dobInput = document.getElementById('dobInput');
  const ageInput = document.getElementById('ageInput');
  if (dobInput && ageInput) {
    dobInput.addEventListener('change', () => {
      if (dobInput.value) {
        const birthDate = new Date(dobInput.value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age >= 0) ageInput.value = age;
      }
    });
  }

  // Same WhatsApp Checkbox
  const chkSameWhatsapp = document.getElementById('chkSameWhatsapp');
  const mobileInput = document.getElementById('mobileInput');
  const whatsappInput = document.getElementById('whatsappInput');
  if (chkSameWhatsapp && mobileInput && whatsappInput) {
    chkSameWhatsapp.addEventListener('change', () => {
      if (chkSameWhatsapp.checked) {
        whatsappInput.value = mobileInput.value;
      }
    });
    mobileInput.addEventListener('input', () => {
      if (chkSameWhatsapp.checked) {
        whatsappInput.value = mobileInput.value;
      }
    });
  }

  // Photo Uploader Click
  const photoDropArea = document.getElementById('photoDropArea');
  const photoFileInput = document.getElementById('photoFileInput');
  if (photoDropArea && photoFileInput) {
    photoDropArea.addEventListener('click', () => {
      photoFileInput.click();
    });

    photoFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const compressed = await compressImage(file);
          state.photoPreviewBase64 = compressed;
          
          // Direct DOM update keeps existing form values intact!
          photoDropArea.innerHTML = `
            <div class="photo-preview-wrap">
              <img src="${compressed}" class="photo-preview-img" alt="સભ્ય ફોટો" />
              <button type="button" class="btn-photo-action" id="btnChangePhoto">
                <i class="fa-solid fa-camera"></i> ફોટો બદલો
              </button>
            </div>
          `;

          document.getElementById('btnChangePhoto')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            photoFileInput.click();
          });

          showToast('ફોટો સફળતાપૂર્વક અપલોડ & કમ્પ્રેસ થયો!');
        } catch (err) {
          alert('ફોટો અપલોડ કરવામાં સમસ્યા આવી, કૃપા કરીને ફરી પ્રયાસ કરો.');
        }
      }
    });
  }

  // Form Submit Handler
  const membershipForm = document.getElementById('membershipForm');
  if (membershipForm) {
    membershipForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!state.photoPreviewBase64) {
        alert('કૃપા કરીને ID કાર્ડ માટે તમારો પાસપોર્ટ ફોટો પસંદ કરો.');
        document.getElementById('photoDropArea')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const consent = document.getElementById('chkConsent');
      if (!consent || !consent.checked) {
        alert('કૃપા કરીને નિયમો અને ઘોષણા સ્વીકારો.');
        return;
      }

      state.isSubmitting = true;
      const submitBtn = document.getElementById('btnSubmitForm');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ID કાર્ડ જનરેટ થઈ રહ્યું છે...';
      }

      try {
        const formData = new FormData(membershipForm);
        // Generate Next Sequential Unique ID (e.g. SYMG-2026-002, SYSS-2026-002)
        const idNumber = generateNextIdNumber(state.selectedOrg);

        const newMember = {
          idNumber: idNumber,
          organization: state.selectedOrg || 'સનાતન યુવા મંચ',
          fullName: (formData.get('fullName') || '').trim(),
          fatherName: (formData.get('fatherName') || '').trim(),
          dob: formData.get('dob') || '',
          age: formData.get('age') || '',
          village: (formData.get('village') || '').trim(),
          taluka: (formData.get('taluka') || '').trim(),
          district: formData.get('district') || '',
          address: (formData.get('address') || '').trim(),
          mobile: (formData.get('mobile') || '').trim(),
          whatsapp: (formData.get('whatsapp') || '').trim(),
          email: (formData.get('email') || '').trim(),
          memberType: formData.get('memberType') || 'સામાન્ય સભ્ય',
          designation: formData.get('designation') || (formData.get('memberType') === 'કાર્યકર' ? 'કાર્યકર' : 'સભ્ય'),
          occupation: (formData.get('occupation') || '').trim(),
          skill: (formData.get('skill') || '').trim(),
          prevOrg: (formData.get('prevOrg') || '').trim(),
          photoBase64: state.photoPreviewBase64 || '',
          photoUrl: '',
          status: 'મંજૂર',
          createdAt: new Date().toLocaleString('gu-IN')
        };

        // 1. Instantly save in memory, session storage & quota-safe local storage
        state.currentMember = newMember;
        try {
          sessionStorage.setItem('sanatan_current_member', JSON.stringify(newMember));
        } catch (sErr) {}
        saveLocalMember(newMember);

        // 2. Clear submitting flag and Navigate to /id-card
        state.isSubmitting = false;
        state.isViewingFromAdmin = false;
        navigateTo(ROUTES.ID_CARD);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // 3. Confetti celebration 🎉
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch (cErr) {}
        showToast('સભ્ય નોંધણી સફળતાપૂર્વક પૂર્ણ થઈ!');

        // 4. Background Sync to Google Apps Script & Google Drive (Never blocks the UI)
        submitMemberData(newMember).catch(err => {
          console.warn('Background sync note:', err);
        });

      } catch (submitErr) {
        console.error('Submission error:', submitErr);
        alert('ફોર્મ સબમિટ કરવામાં ભૂલ આવી: ' + (submitErr.message || submitErr));
        state.isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-id-card"></i> સભ્ય નોંધણી પૂર્ણ કરો & ID મેળવો';
        }
      }
    });
  }

  // ID Card Actions
  document.getElementById('btnCopyId')?.addEventListener('click', () => {
    if (state.currentMember && state.currentMember.idNumber) {
      navigator.clipboard.writeText(state.currentMember.idNumber);
      showToast(`સભ્ય ID નંબર ${state.currentMember.idNumber} કોપી થયો!`);
    }
  });

  document.getElementById('btnDownloadCard')?.addEventListener('click', () => {
    const canvas = document.getElementById('idCardCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${state.currentMember.idNumber}_${state.currentMember.fullName}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    showToast('ID કાર્ડ HD ઈમેજ ડાઉનલોડ થઈ ગઈ છે!');
  });


  // New Registration button -> Navigate to /
  document.getElementById('btnNewRegistration')?.addEventListener('click', () => {
    state.isViewingFromAdmin = false;
    state.currentMember = null;
    state.photoPreviewBase64 = null;
    navigateTo(ROUTES.HOME);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Back to Admin Portal from ID Card view
  document.getElementById('btnBackToAdmin')?.addEventListener('click', () => {
    state.isViewingFromAdmin = false;
    navigateTo(ROUTES.ADMIN);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Admin Dashboard Events
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.activeAdminTab = tab.getAttribute('data-tab');
      render();
    });
  });

  document.getElementById('adminSearchInput')?.addEventListener('input', (e) => {
    state.adminSearch = e.target.value;
    render();
    const newInp = document.getElementById('adminSearchInput');
    if (newInp) {
      newInp.focus();
      newInp.setSelectionRange(newInp.value.length, newInp.value.length);
    }
  });

  document.getElementById('adminDistrictSelect')?.addEventListener('change', (e) => {
    state.adminDistrict = e.target.value;
    render();
  });

  document.getElementById('adminTypeSelect')?.addEventListener('change', (e) => {
    state.adminType = e.target.value;
    render();
  });

  // Admin View Card button -> Navigate to /id-card
  document.querySelectorAll('.btn-view-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const all = getLocalMembers();
      const m = all.find(item => item.idNumber === id);
      if (m) {
        state.currentMember = m;
        state.isViewingFromAdmin = true;
        navigateTo(`${ROUTES.ID_CARD}?from=admin`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Admin WhatsApp to Member -> Share Actual PNG ID Card
  document.querySelectorAll('.btn-whatsapp-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mobile = btn.getAttribute('data-mobile');
      const id = btn.getAttribute('data-id');

      const all = getLocalMembers();
      const member = all.find(m => (id && m.idNumber === id) || (mobile && String(m.mobile).trim() === String(mobile).trim()));

      if (!member) {
        alert('સભ્યની વિગતો મળી નથી.');
        return;
      }

      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      btn.style.pointerEvents = 'none';
      showToast('ID કાર્ડ PNG તૈયાર થઈ રહ્યું છે...');

      try {
        // 1. Generate High-Res PNG Blob of the exact ID card
        const blob = await generateIdCardBlob(member);
        const filename = `${member.idNumber || 'ID_Card'}_${(member.fullName || 'Member').replace(/\s+/g, '_')}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        const cleanMobile = String(member.mobile || '').replace(/\D/g, '').slice(-10);

        // 2. Try Web Share API (Works natively on Android/iOS mobile to send PNG directly to WhatsApp)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${member.fullName} - ID Card`,
              text: `🚩 *${member.organization} ગુજરાત* 🚩\nસભ્ય ID: *${member.idNumber}*`
            });
            btn.innerHTML = origHtml;
            btn.style.pointerEvents = 'auto';
            showToast('WhatsApp પર ID કાર્ડ શેર થઈ ગયું!');
            return;
          } catch (shareErr) {
            if (shareErr.name === 'AbortError') {
              btn.innerHTML = origHtml;
              btn.style.pointerEvents = 'auto';
              return;
            }
          }
        }

        // 3. Desktop / Windows Flow:
        // A) Copy PNG Image directly to system clipboard so user can simply press Ctrl + V in WhatsApp Web!
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
          }
        } catch (clipErr) {
          console.warn('Clipboard write warning:', clipErr);
        }

        // B) Auto-download the PNG file as well
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // C) Open WhatsApp Web with the member's chat
        const waUrl = `https://web.whatsapp.com/send?phone=91${cleanMobile}`;
        window.open(waUrl, '_blank');

        // D) Show interactive guidance modal
        showWhatsAppCardModal(member, downloadUrl, filename, cleanMobile);

      } catch (err) {
        console.error('Error generating card for WhatsApp:', err);
        alert('ID કાર્ડ PNG બનાવવામાં ભૂલ આવી, કૃપા કરીને ફરી પ્રયાસ કરો.');
      } finally {
        btn.innerHTML = origHtml;
        btn.style.pointerEvents = 'auto';
      }
    });
  });

  // Admin Live Sync with Google Sheets
  document.getElementById('btnSyncSheet')?.addEventListener('click', async () => {
    const syncBtn = document.getElementById('btnSyncSheet');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> સિંક ચાલુ છે...';
    }
    showToast('Google Sheet સાથે લાઈવ સિંક થઈ રહ્યું છે...');
    try {
      const syncedList = await syncWithGoogleSheets();
      render();
      if (!syncedList || syncedList.length === 0) {
        showToast('Google Sheet સિંક પૂર્ણ: શીટમાં કોઈ સભ્ય નથી (0 સભ્યો).');
      } else {
        showToast(`Google Sheet સિંક પૂર્ણ: કુલ ${syncedList.length} સભ્યો મળ્યા.`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      render();
      showToast('સિંક દરમિયાન સમસ્યા આવી, ફરી પ્રયાસ કરો.');
    } finally {
      const resetBtn = document.getElementById('btnSyncSheet');
      if (resetBtn) {
        resetBtn.disabled = false;
        resetBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> લાઈવ સિંક';
      }
    }
  });

  // Admin Clear All Data
  document.getElementById('btnClearAllData')?.addEventListener('click', () => {
    if (confirm('શું તમે ખરેખર બધો ડેટા સાફ કરવા માંગો છો?')) {
      clearAllLocalData();
      render();
      showToast('તમામ ડેટા સફળતાપૂર્વક સાફ થઈ ગયો છે (0 સભ્યો).');
    }
  });

  // Admin Export CSV
  document.getElementById('btnExportCSV')?.addEventListener('click', () => {
    const all = getLocalMembers();
    if (all.length === 0) {
      alert('કોઈ ડેટા ઉપલબ્ધ નથી.');
      return;
    }
    const headers = ["ID", "સંગઠન", "પૂરું નામ", "પિતાનું નામ", "જન્મતારીખ", "ઉંમર", "ગામ", "તાલુકો", "જિલ્લો", "સરનામું", "મોબાઇલ", "WhatsApp", "ઈમેઇલ", "સભ્ય પ્રકાર", "પદ", "વ્યવસાય", "તારીખ"];
    const rows = all.map(m => [
      m.idNumber, m.organization, m.fullName, m.fatherName, m.dob, m.age, m.village, m.taluka, m.district, `"${(m.address || '').replace(/"/g, '""')}"`, m.mobile, m.whatsapp, m.email, m.memberType, m.designation, m.occupation, m.createdAt
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sanatan_Members_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Excel CSV ફાઇલ સફળતાપૂર્વક ડાઉનલોડ થઈ ગઈ!');
  });
}

// Start App
init();
