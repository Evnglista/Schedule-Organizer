const MASTER_PROMPT = `Prompt:
Please format the following schedule into a plain text list.
Use the exact repeating format below for each subject:
Format:

Section
Subject
Units
[SECTION]
[SUBJECT CODE] : [COURSE TITLE]
[DAYS] [START TIME 24hr]-[END TIME 24hr] [ROOM]
[UNITS]

Formatting Rules:
1. Start with the header lines: Section, Subject, Units.
2. Convert 12-hour AM/PM times into 24-hour format (e.g., 01:00PM - 03:40PM becomes 13:00-15:40).
3. Separate each course entry with a blank line.

Here is my raw schedule text:
[PASTE YOUR RAW SCHEDULE HERE]`;

function copyMasterPrompt() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(MASTER_PROMPT).then(() => {
      alert("Master Prompt copied to clipboard!");
    }).catch(() => {
      prompt("Copy this master prompt manually:", MASTER_PROMPT);
    });
  } else {
    prompt("Copy this master prompt manually:", MASTER_PROMPT);
  }
}

const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// 7 Days Setup (Sun -> Sat)
const wallDays = [
  { label: 'SU', code: 'Sun' },
  { label: 'M', code: 'Mon' },
  { label: 'T', code: 'Tue' },
  { label: 'W', code: 'Wed' },
  { label: 'TH', code: 'Thu' },
  { label: 'FRI', code: 'Fri' },
  { label: 'SAT', code: 'Sat' }
];

let isTransparentBgMode = false;
let isRoseCardsMode = localStorage.getItem('wallpaper_rose_cards') === 'true';
let wallpaperWidth = 1179;
let wallpaperHeight = 2556;

let semestersData = JSON.parse(localStorage.getItem('semesters_db')) || {
  "1st Term": []
};

let activeSem = localStorage.getItem('active_sem') || "1st Term";
if (!semestersData[activeSem]) activeSem = Object.keys(semestersData)[0];

function renderSemesterSelector() {
  const select = document.getElementById('semesterSelect');
  select.innerHTML = '';
  Object.keys(semestersData).forEach(sem => {
    const opt = document.createElement('option');
    opt.value = sem;
    opt.textContent = sem;
    if (sem === activeSem) opt.selected = true;
    select.appendChild(opt);
  });
  document.getElementById('currentSemLabel').textContent = activeSem;
}

function switchSemester() {
  activeSem = document.getElementById('semesterSelect').value;
  localStorage.setItem('active_sem', activeSem);
  document.getElementById('currentSemLabel').textContent = activeSem;
  renderAll();
}

function addNewSemester() {
  const name = prompt("Name new semester/term:");
  if (name && name.trim()) {
    const trimmed = name.trim();
    if (!semestersData[trimmed]) {
      semestersData[trimmed] = [];
      activeSem = trimmed;
      saveData();
      renderSemesterSelector();
      const savedWallpaperResolution = JSON.parse(localStorage.getItem('wallpaper_resolution') || 'null');
      if (savedWallpaperResolution &&
          Number.isInteger(savedWallpaperResolution.width) &&
          Number.isInteger(savedWallpaperResolution.height)) {
        wallpaperWidth = savedWallpaperResolution.width;
        wallpaperHeight = savedWallpaperResolution.height;
        const matchingPreset = document.getElementById('wallpaperSizeSelect');
        matchingPreset.value = `${wallpaperWidth}x${wallpaperHeight}`;
        if (matchingPreset.selectedIndex === -1) matchingPreset.value = 'custom';
        setWallpaperResolution(wallpaperWidth, wallpaperHeight);
        if (matchingPreset.value === 'custom') {
          document.getElementById('customResolution').style.display = 'grid';
        }
      } else {
        document.getElementById('customResolution').style.display = 'none';
        setWallpaperResolution(wallpaperWidth, wallpaperHeight);
      }
      renderAll();

      window.addEventListener('resize', () => {
        if (document.body.classList.contains('wallpaper-active')) {
          fitWallpaperPreview();
        }
      });
    } else {
      alert("A term with this name already exists.");
    }
  }
}

function deleteCurrentTerm() {
  const termNames = Object.keys(semestersData);
  if (termNames.length <= 1) {
    alert("You must keep at least one term!");
    return;
  }
  if (confirm(`Are you sure you want to delete "${activeSem}"?`)) {
    delete semestersData[activeSem];
    activeSem = Object.keys(semestersData)[0];
    saveData();
    renderSemesterSelector();

    const savedWallpaperResolution = JSON.parse(localStorage.getItem('wallpaper_resolution') || 'null');
    if (savedWallpaperResolution &&
        Number.isInteger(savedWallpaperResolution.width) &&
        Number.isInteger(savedWallpaperResolution.height)) {
      wallpaperWidth = savedWallpaperResolution.width;
      wallpaperHeight = savedWallpaperResolution.height;
      const wallpaperSizeSelect = document.getElementById('wallpaperSizeSelect');
      wallpaperSizeSelect.value = `${wallpaperWidth}x${wallpaperHeight}`;
      if (wallpaperSizeSelect.selectedIndex === -1) wallpaperSizeSelect.value = 'custom';
      setWallpaperResolution(wallpaperWidth, wallpaperHeight);
      if (wallpaperSizeSelect.value === 'custom') {
        document.getElementById('customResolution').style.display = 'grid';
      } else {
        document.getElementById('customResolution').style.display = 'none';
      }
    } else {
      document.getElementById('customResolution').style.display = 'none';
      setWallpaperResolution(wallpaperWidth, wallpaperHeight);
    }

    renderAll();
    window.addEventListener('resize', () => {
      if (document.body.classList.contains('wallpaper-active')) fitWallpaperPreview();
    });
  }
}

function getTimeMinutes(timeStr) {
  if (!timeStr) return 9999;
  const startStr = normalizeScheduleTime(timeStr, true).split('-')[0];
  if (!startStr) return 9999;

  const match = startStr.trim().match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i);
  if (!match) return 9999;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function normalizeScheduleTime(timeStr, inferLegacyAfternoon = false) {
  const rawTime = String(timeStr || '').trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(?:[-–—|]|\bto\b)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return rawTime;

  const startPeriod = match[3] || match[6];
  const endPeriod = match[6] || match[3];
  const startHour = parseInt(match[1], 10);
  const endHour = parseInt(match[4], 10);
  const inferEndAfternoon = inferLegacyAfternoon && !startPeriod &&
    match[1].length === 1 && startHour >= 1 && startHour <= 6 &&
    endHour > 6 && endHour <= 11;
  const to24Hour = (hourText, minuteText, period, inheritAfternoon = false) => {
    let hours = parseInt(hourText, 10);
    if (period && period.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (period && period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    // Older imports converted afternoon times to single-digit hours without retaining PM.
    if (!period && inferLegacyAfternoon && hourText.length === 1 && hours >= 1 && hours <= 6) hours += 12;
    else if (!period && inheritAfternoon) hours += 12;
    return `${String(hours).padStart(2, '0')}:${minuteText}`;
  };

  return `${to24Hour(match[1], match[2], startPeriod)}-${to24Hour(match[4], match[5], endPeriod, inferEndAfternoon)}`;
}

function standardizeTime(rawTime) {
  if (!rawTime) return '';
  return normalizeScheduleTime(rawTime);
}

function parseUniversalDays(text) {
  const days = new Set();
  const upper = text.toUpperCase().trim();

  if (/\b(MTH|M-TH)\b/.test(upper)) { days.add('Mon'); days.add('Thu'); }
  if (/\b(TF|T-F)\b/.test(upper)) { days.add('Tue'); days.add('Fri'); }
  if (/\b(TTH|T-TH|TTHU)\b/.test(upper)) { days.add('Tue'); days.add('Thu'); }
  if (/\bMWF\b/.test(upper)) { days.add('Mon'); days.add('Wed'); days.add('Fri'); }

  if (days.size === 0) {
    if (/\b(MON|MONDAY|M)\b/.test(upper)) days.add('Mon');
    if (/\b(TUE|TUESDAY|TUES|T)\b/.test(upper)) days.add('Tue');
    if (/\b(WED|WEDNESDAY|W)\b/.test(upper)) days.add('Wed');
    if (/\b(THU|THUR|THURSDAY|TH)\b/.test(upper)) days.add('Thu');
    if (/\b(FRI|FRIDAY|F)\b/.test(upper)) days.add('Fri');
    if (/\b(SAT|SATURDAY|SA|S)\b/.test(upper)) days.add('Sat');
    if (/\b(SUN|SUNDAY|SU)\b/.test(upper)) days.add('Sun');
  }

  return Array.from(days);
}

function parseTextSchedule(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const newEntries = [];
  const timeRegex = /(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*(?:[-–—|]|\bto\b)\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const timeMatch = line.match(timeRegex);

    if (timeMatch) {
      const rawTime = timeMatch[0];
      const formattedTime = standardizeTime(rawTime);
      const dayPart = line.substring(0, line.indexOf(rawTime)).trim();
      const extractedDays = parseUniversalDays(dayPart);
      const roomPart = line.substring(line.indexOf(rawTime) + rawTime.length).trim();
      const room = roomPart || '';

      let title = "SUBJECT CLASS";
      let sectionCode = "";

      for (let j = i - 1; j >= 0; j--) {
        if (!lines[j].match(timeRegex) && !/^\d+$/.test(lines[j])) {
          title = lines[j];
          if (j > 0 && /^\d+$/.test(lines[j - 1])) {
            sectionCode = lines[j - 1];
          }
          break;
        }
      }

      newEntries.push({
        id: Date.now() + Math.random(),
        section: sectionCode,
        title: title,
        days: extractedDays.length > 0 ? extractedDays : ['Mon'],
        time: formattedTime,
        room: room
      });
    }
  }

  if (newEntries.length > 0) {
    semestersData[activeSem] = [...semestersData[activeSem], ...newEntries];
    saveData();
    renderAll();
  } else {
    alert("Could not extract classes. Please check the text layout.");
  }
}

function getEarliestDayIndex(days) {
  if (!days || days.length === 0) return 999;
  const indices = days.map(d => daysList.indexOf(d)).filter(i => i !== -1);
  return indices.length > 0 ? Math.min(...indices) : 999;
}

function renderTable() {
  const tbody = document.getElementById('scheduleBody');
  tbody.innerHTML = '';
  const currentSubjects = semestersData[activeSem] || [];

  const sortedSubjects = [...currentSubjects].sort((a, b) => {
    const dayDiff = getEarliestDayIndex(a.days) - getEarliestDayIndex(b.days);
    if (dayDiff !== 0) return dayDiff;
    return getTimeMinutes(a.time) - getTimeMinutes(b.time);
  });

  sortedSubjects.forEach(item => {
    const tr = document.createElement('tr');
    let html = `<td class="sec-code">${item.section || '—'}</td>`;
    html += `<td class="subject-title">${item.title}</td>`;

    daysList.forEach(day => {
      const isChecked = item.days && item.days.includes(day);
      html += `<td style="text-align:center;">${isChecked ? '<div class="checkbox-custom"></div>' : ''}</td>`;
    });

    html += `<td style="white-space:nowrap; font-weight:600; color:var(--time-badge-color);">${item.time}</td>`;
    html += `<td style="color:var(--text-muted);">${item.room}</td>`;
    html += `<td><button class="del-btn" onclick="deleteSubject(${item.id})">✕</button></td>`;

    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

function renderColumns() {
  const carousel = document.getElementById('columnsCarousel');
  const pills = document.getElementById('dayPills');
  carousel.innerHTML = '';
  pills.innerHTML = '';

  const currentSubjects = semestersData[activeSem] || [];

  daysList.forEach((day, idx) => {
    const daySubjects = currentSubjects
      .filter(s => s.days.includes(day))
      .sort((a, b) => getTimeMinutes(a.time) - getTimeMinutes(b.time));

    const pill = document.createElement('button');
    pill.className = `pill ${idx === 0 ? 'active' : ''}`;
    pill.textContent = `${day} (${daySubjects.length})`;
    pill.onclick = () => scrollToColumn(day);
    pills.appendChild(pill);

    const col = document.createElement('div');
    col.className = 'column';
    col.id = `mobile-col-${day}`;

    let cardsHtml = '';
    daySubjects.forEach(s => {
      cardsHtml += `
        <div class="class-card">
          <div class="title">${s.title}</div>
          <div class="tags">
            ${s.section ? `<span class="badge-sec">SEC ${s.section}</span>` : ''}
            <span class="badge-time">⏰ ${s.time}</span>
            ${s.room ? `<span class="badge-room">📍 ${s.room}</span>` : ''}
          </div>
        </div>
      `;
    });

    col.innerHTML = `
      <div class="column-title">
        <span>${day}</span>
        <span class="badge">${daySubjects.length}</span>
      </div>
      <div>${cardsHtml || '<div style="font-size:0.75rem; color:var(--text-muted); padding: 8px 0;">No classes scheduled</div>'}</div>
    `;

    carousel.appendChild(col);
  });
}

function titleCaseWallpaperSubject(title) {
  const text = String(title || '').trim().toLowerCase();
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'via']);
  const wordCount = (text.match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) || []).length;
  let wordIndex = 0;

  return text.replace(/[a-z0-9]+(?:['’][a-z0-9]+)*/g, word => {
    const shouldCapitalize = wordIndex === 0 || wordIndex === wordCount - 1 || !smallWords.has(word);
    wordIndex++;
    return shouldCapitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  }).replace(/\b(lec|lab|ict|it|ai|pe|mls)\b/gi, word => word.toUpperCase());
}

function getWallpaperSubjectParts(title) {
  const text = String(title || '').trim();
  const match = text.match(/^([\w./-]+)\s*:\s*(.+)$/);
  return match
    ? { code: match[1].toUpperCase(), subject: titleCaseWallpaperSubject(match[2]) }
    : { code: '', subject: titleCaseWallpaperSubject(text) };
}

function getPhoneWallpaperCourseText(title) {
  const text = String(title || '').trim();
  const match = text.match(/^([\w./-]+)\s*:\s*(.+)$/);
  return match ? `${match[1].toUpperCase()} : ${match[2].trim()}` : text;
}

function formatPhoneWallpaperTime(time) {
  return normalizeScheduleTime(time, true).replace(/\b0(?=\d:)/g, '');
}

function renderWallpaper() {
  const grid = document.getElementById('wallpaperGrid');
  grid.innerHTML = '';

  const currentSubjects = semestersData[activeSem] || [];
  const isPhoneWallpaper = wallpaperHeight / wallpaperWidth >= 1.75;
  const visibleDays = isPhoneWallpaper
    ? wallDays.filter(day => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day.code))
    : wallDays;
  const wallpaperPanel = document.getElementById('wallpaperPanel');
  const maxDayCount = isPhoneWallpaper
    ? Math.max(0, ...visibleDays.map(day =>
      currentSubjects.filter(subject => subject.days.includes(day.code)).length
    ))
    : 0;

  if (isPhoneWallpaper) {
    const panelWidth = wallpaperWidth;
    const panelHeight = wallpaperHeight;
    const horizontalPadding = Math.max(6, panelWidth * 0.006);
    const columnGap = Math.max(6, panelWidth * 0.008);
    const cardGap = Math.max(6, panelHeight * 0.004);
    const dayHeight = Math.max(10, panelWidth * 0.0115);
    const dayGap = Math.max(2, panelHeight * 0.002);
    const gridHeight = panelHeight * 0.62 - 25;
    const cardHeight = maxDayCount > 1
      ? Math.max(64, Math.floor((gridHeight - dayHeight - dayGap - cardGap * maxDayCount) / maxDayCount))
      : Math.max(64, panelHeight * 0.045);
    const cardWidth = Math.max(1, (panelWidth - horizontalPadding * 2 - columnGap * 4 - 2) / 5);

    wallpaperPanel.style.setProperty('--wall-phone-card-height', `${cardHeight}px`);
    wallpaperPanel.style.setProperty('--wall-phone-card-gap', `${cardGap}px`);
    wallpaperPanel.style.setProperty('--wall-phone-card-padding-y', `${Math.max(6, Math.min(panelHeight * 0.006, cardHeight * 0.08))}px`);
    wallpaperPanel.style.setProperty('--wall-phone-card-padding-x', `${Math.max(4, panelWidth * 0.006)}px`);
    wallpaperPanel.style.setProperty('--wall-phone-time-size', `${Math.max(10, Math.min(cardWidth * 0.14, cardHeight * 0.085))}px`);
    wallpaperPanel.style.setProperty('--wall-phone-course-size', `${Math.max(9, Math.min(cardWidth * 0.12, cardHeight * 0.07))}px`);
    wallpaperPanel.style.setProperty('--wall-phone-meta-size', `${Math.max(8, Math.min(cardWidth * 0.08, cardHeight * 0.055))}px`);
  }

  visibleDays.forEach((dayObj, colIdx) => {
    const daySubjects = currentSubjects
      .filter(s => s.days.includes(dayObj.code))
      .sort((a, b) => getTimeMinutes(a.time) - getTimeMinutes(b.time));

    const colEl = document.createElement('div');
    colEl.className = 'wall-col';
    const dayHeader = document.createElement('div');
    dayHeader.className = 'wall-day-head';
    dayHeader.textContent = dayObj.label;
    colEl.appendChild(dayHeader);

    daySubjects.forEach((s, itemIdx) => {
      const themeClass = (colIdx + itemIdx) % 2 === 0 ? 'light' : 'dark';
      const card = document.createElement('article');
      card.className = `wall-card-item ${themeClass}`;

      const time = document.createElement('div');
      time.className = 'wall-card-time';
      const normalizedTime = isPhoneWallpaper
        ? formatPhoneWallpaperTime(s.time)
        : normalizeScheduleTime(s.time, true);
      time.textContent = isPhoneWallpaper
        ? normalizedTime
        : (isRoseCardsMode ? normalizedTime.replace('-', ' – ') : normalizedTime);
      card.appendChild(time);

      if (isPhoneWallpaper) {
        const course = document.createElement('div');
        course.className = 'wall-card-course';
        course.textContent = getPhoneWallpaperCourseText(s.title);
        card.appendChild(course);

        if (s.section && String(s.section).trim()) {
          const section = document.createElement('div');
          section.className = 'wall-card-section';
          section.textContent = `(${String(s.section).trim()})`;
          card.appendChild(section);
        }

        if (s.room && String(s.room).trim()) {
          const room = document.createElement('div');
          room.className = 'wall-card-room';
          room.textContent = String(s.room).trim();
          card.appendChild(room);
        }
      } else {
        const subjectParts = getWallpaperSubjectParts(s.title);
        const title = document.createElement('div');
        title.className = 'wall-card-title';
        if (subjectParts.code) {
          const code = document.createElement('div');
          code.className = 'wall-card-code';
          code.textContent = subjectParts.code;
          title.appendChild(code);
        }

        const subject = document.createElement('div');
        subject.className = 'wall-card-subject';
        subject.textContent = subjectParts.subject;
        title.appendChild(subject);
        card.appendChild(title);

        const metadata = [s.section && `SEC ${s.section}`, s.room].filter(Boolean).join(' · ');
        if (metadata) {
          const room = document.createElement('div');
          room.className = 'wall-card-room';
          room.textContent = metadata;
          card.appendChild(room);
        }
      }

      colEl.appendChild(card);
    });

    grid.appendChild(colEl);
  });

  if (isPhoneWallpaper && maxDayCount > 1) {
    const canvas = document.getElementById('wallpaperCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    const scale = canvasRect.height / canvas.offsetHeight;
    const fullestColumn = [...grid.children].reduce((fullest, column) =>
      column.querySelectorAll('.wall-card-item').length > fullest.querySelectorAll('.wall-card-item').length
        ? column
        : fullest
    );
    const cards = [...fullestColumn.querySelectorAll('.wall-card-item')];

    if (scale > 0 && cards.length === maxDayCount) {
      const firstCardTop = cards[0].getBoundingClientRect().top;
      const cardGap = parseFloat(getComputedStyle(fullestColumn).rowGap);
      const fittedHeight = (
        canvasRect.bottom - 16 * scale - firstCardTop - cardGap * scale * (cards.length - 1)
      ) / (cards.length * scale);

      wallpaperPanel.style.setProperty(
        '--wall-phone-card-height',
        `${Math.max(64, fittedHeight)}px`
      );
    }
  }
}

function updateWallpaperHeader() {
  const titleVal = document.getElementById('wallTitleInput').value;
  const degreeVal = document.getElementById('wallDegreeInput').value;
  
  document.getElementById('wallDisplayTitle').textContent = titleVal || 'Class Schedule';
  document.getElementById('wallDisplaySub').textContent = degreeVal || '1st Year - 1st Sem';
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const panel = document.getElementById('wallpaperPanel');
      panel.style.backgroundImage = `url('${evt.target.result}')`;
      panel.classList.add('has-background-image');
    };
    reader.readAsDataURL(file);
  }
}

function updateOverlay(val) {
  document.getElementById('wallpaperOverlay').style.background = `rgba(0, 0, 0, ${val})`;
}

function toggleTransparentBgMode() {
  isTransparentBgMode = !isTransparentBgMode;
  const canvas = document.getElementById('wallpaperCanvas');
  const toggleBtn = document.getElementById('btnTransparentToggle');

  if (isTransparentBgMode) {
    canvas.classList.add('transparent-mode');
    toggleBtn.classList.add('active');
    toggleBtn.textContent = 'Transparent background active';
    toggleBtn.setAttribute('aria-pressed', 'true');
  } else {
    canvas.classList.remove('transparent-mode');
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = 'Enable transparent background';
    toggleBtn.setAttribute('aria-pressed', 'false');
  }
}

function setRoseCardsMode(enabled) {
  isRoseCardsMode = enabled;
  document.getElementById('wallpaperPanel').classList.toggle('rose-cards', enabled);
  document.getElementById('wallpaperCanvas').classList.toggle('rose-cards-mode', enabled);

  const toggleButton = document.getElementById('btnRoseCardsToggle');
  toggleButton.classList.toggle('active', enabled);
  toggleButton.setAttribute('aria-pressed', String(enabled));
  toggleButton.textContent = enabled ? 'Restore black subject cards' : 'Color black subject cards rose';
  localStorage.setItem('wallpaper_rose_cards', String(enabled));
}

function toggleRoseCardsMode() {
  setRoseCardsMode(!isRoseCardsMode);
  setWallpaperResolution(wallpaperWidth, wallpaperHeight);
  renderWallpaper();
}

function toggleWallpaperMode() {
  document.body.classList.toggle('wallpaper-active');
  if (document.body.classList.contains('wallpaper-active')) {
    setWallpaperResolution(wallpaperWidth, wallpaperHeight);
    updateWallpaperHeader();
    renderWallpaper();
    requestAnimationFrame(fitWallpaperPreview);
  }
}

function applyWallpaperPreset(value) {
  const customResolution = document.getElementById('customResolution');
  if (value === 'custom') {
    customResolution.style.display = 'grid';
    return;
  }

  customResolution.style.display = 'none';
  const [width, height] = value.split('x').map(Number);
  setWallpaperResolution(width, height);
  renderWallpaper();
}

function applyCustomResolution() {
  const widthInput = document.getElementById('customWidth');
  const heightInput = document.getElementById('customHeight');
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);

  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 256 || height < 256 || width > 7680 || height > 7680) {
    alert('Enter a width and height between 256 and 7680 pixels.');
    return;
  }

  setWallpaperResolution(width, height);
  renderWallpaper();
}

function setWallpaperResolution(width, height) {
  wallpaperWidth = width;
  wallpaperHeight = height;

  const canvas = document.getElementById('wallpaperCanvas');
  const panel = document.getElementById('wallpaperPanel');
  const isTallPhoneWallpaper = height / width >= 1.75;
  const isLandscapeWallpaper = width > height;
  const landscapePanelHeightRatio = isRoseCardsMode || width / height >= 1.7 ? 0.9 : 0.7;
  const panelWidth = isLandscapeWallpaper ? width * 0.94 : width;
  const panelHeight = isLandscapeWallpaper ? height * landscapePanelHeightRatio : height;
  const typographyHeight = isLandscapeWallpaper ? height * 0.70 : panelHeight;
  const headerGapRatio = isTallPhoneWallpaper ? 0.006 : (isLandscapeWallpaper ? 0.021 : 0.015);
  const gridTopInsetRatio = isTallPhoneWallpaper ? 0.01 : 0.025;
  panel.classList.toggle('phone-compact-layout', isTallPhoneWallpaper);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  panel.style.width = isLandscapeWallpaper ? '94%' : '100%';
  panel.style.height = isLandscapeWallpaper ? `${landscapePanelHeightRatio * 100}%` : '100%';

  panel.style.setProperty('--wall-padding-x', `${Math.max(6, panelWidth * 0.006)}px`);
  panel.style.setProperty('--wall-padding-y', `${Math.max(8, panelHeight * 0.012)}px`);
  panel.style.setProperty('--wall-padding-bottom', `${isLandscapeWallpaper ? 0 : Math.max(8, panelHeight * 0.012)}px`);
  panel.style.setProperty('--wall-title-size', `${Math.max(18, panelWidth * 0.027)}px`);
  panel.style.setProperty('--wall-sub-size', `${Math.max(10, panelWidth * 0.011)}px`);
  panel.style.setProperty('--wall-header-inset', `${isLandscapeWallpaper || isTallPhoneWallpaper ? 0 : Math.max(12, panelHeight * 0.03)}px`);
  panel.style.setProperty('--wall-header-gap', `${Math.max(6, panelHeight * headerGapRatio)}px`);
  panel.style.setProperty('--wall-sub-gap', `${Math.max(4, panelHeight * 0.003)}px`);
  panel.style.setProperty('--wall-grid-gap', `${Math.max(3, panelWidth * 0.002)}px`);
  panel.style.setProperty('--wall-grid-inset-top', `${Math.max(8, panelHeight * gridTopInsetRatio)}px`);
  panel.style.setProperty('--wall-grid-inset-bottom', `${isLandscapeWallpaper ? 0 : Math.max(16, panelHeight * (isTallPhoneWallpaper ? 0.02 : 0.05))}px`);
  panel.style.setProperty('--wall-phone-header-top', `${panelHeight * 0.345}px`);
  panel.style.setProperty('--wall-phone-grid-top', `${panelHeight * 0.38}px`);
  panel.style.setProperty('--wall-phone-grid-bottom', '1rem');
  panel.style.setProperty('--wall-phone-column-gap', `${Math.max(6, panelWidth * 0.008)}px`);
  panel.style.setProperty('--wall-phone-card-gap', `${Math.max(6, panelHeight * 0.004)}px`);
  panel.style.setProperty('--wall-card-gap', `${Math.max(3, panelHeight * 0.004)}px`);
  panel.style.setProperty('--wall-card-inner-gap', `${Math.max(3, panelHeight * 0.002)}px`);
  panel.style.setProperty('--wall-day-size', `${Math.max(10, panelWidth * 0.0115)}px`);
  panel.style.setProperty('--wall-day-gap', `${Math.max(2, panelHeight * 0.002)}px`);
  panel.style.setProperty('--wall-card-y', `${Math.max(8, panelHeight * 0.006)}px`);
  panel.style.setProperty('--wall-card-x', `${Math.max(8, panelWidth * 0.004)}px`);
  panel.style.setProperty('--wall-card-min-height', `${Math.max(38, panelHeight * 0.055)}px`);
  panel.style.setProperty('--wall-time-size', `${Math.max(9, Math.min(panelWidth * 0.0105, typographyHeight * 0.022))}px`);
  panel.style.setProperty('--wall-card-title-size', `${Math.max(12, Math.min(panelWidth * 0.011, typographyHeight * 0.021))}px`);
  panel.style.setProperty('--wall-room-size', `${Math.max(8, Math.min(panelWidth * 0.008, typographyHeight * 0.017))}px`);

  document.getElementById('customWidth').value = width;
  document.getElementById('customHeight').value = height;
  document.getElementById('wallpaperSizeStatus').textContent = `${width} × ${height} px`;
  localStorage.setItem('wallpaper_resolution', JSON.stringify({ width, height }));
  fitWallpaperPreview();
}

function fitWallpaperPreview() {
  const canvas = document.getElementById('wallpaperCanvas');
  const wrapper = canvas.parentElement;
  if (!canvas || !wrapper || !document.body.classList.contains('wallpaper-active')) return;

  const availableWidth = Math.max(1, wrapper.clientWidth - 24);
  const availableHeight = Math.max(1, wrapper.clientHeight - 24);
  const scale = Math.min(availableWidth / wallpaperWidth, availableHeight / wallpaperHeight);
  canvas.style.transform = `scale(${scale})`;
}

function exportWallpaperImage() {
  const targetElement = document.getElementById('wallpaperCanvas');
  const exportUsesRoseTheme = isRoseCardsMode;
  
  if (!window.html2canvas) {
    alert("Image export library is loading... Please try again in a moment.");
    return;
  }

  const originalTransform = targetElement.style.transform;
  targetElement.style.transform = 'none';

  const captureExport = async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    return html2canvas(targetElement, {
      scale: 1,
      width: wallpaperWidth,
      height: wallpaperHeight,
      windowWidth: wallpaperWidth,
      windowHeight: wallpaperHeight,
      useCORS: true,
      allowTaint: true,
      backgroundColor: isTransparentBgMode ? null : (exportUsesRoseTheme ? '#FFF8FA' : '#000000'),
      onclone: clonedDocument => {
        const wallpaperPanel = clonedDocument.getElementById('wallpaperPanel');
        if (!wallpaperPanel.classList.contains('phone-compact-layout')) {
          const wallpaperGrid = clonedDocument.getElementById('wallpaperGrid');
          wallpaperGrid.style.overflow = 'visible';
          clonedDocument.querySelectorAll('.wall-col:last-child').forEach(column => {
            column.style.overflow = 'visible';
            column.querySelectorAll('.wall-card-item').forEach(card => {
              card.style.boxSizing = 'border-box';
              card.style.alignSelf = 'flex-start';
              card.style.width = 'calc(100% + var(--wall-padding-x) + 1px)';
            });
          });
        }
        if (!exportUsesRoseTheme) {
          clonedDocument.querySelectorAll('.wall-card-item').forEach(card => {
            card.style.boxShadow = 'none';
          });
        }
      }
    });
  };

  captureExport().then(canvas => {
    targetElement.style.transform = originalTransform;
    const link = document.createElement('a');
    link.download = `Schedule_Wallpaper_${activeSem.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
    targetElement.style.transform = originalTransform;
    console.error("Export Error:", err);
    alert("Could not export wallpaper image.");
  });
}

function scrollToColumn(day) {
  const el = document.getElementById(`mobile-col-${day}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function scrollToElement(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('pasteArea').addEventListener('input', (e) => {
  if (e.target.value.trim().length > 0) {
    parseTextSchedule(e.target.value);
    e.target.value = '';
  }
});

function deleteSubject(id) {
  semestersData[activeSem] = semestersData[activeSem].filter(s => s.id !== id);
  saveData();
  renderAll();
}

function clearCurrentSemester() {
  if (confirm(`Clear all items in ${activeSem}?`)) {
    semestersData[activeSem] = [];
    saveData();
    renderAll();
  }
}

function saveData() {
  localStorage.setItem('semesters_db', JSON.stringify(semestersData));
  localStorage.setItem('active_sem', activeSem);
}

function renderAll() {
  renderTable();
  renderColumns();
  renderWallpaper();
}

renderSemesterSelector();
renderAll();
setRoseCardsMode(isRoseCardsMode);