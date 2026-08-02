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
      renderAll();
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
    renderAll();
  }
}

function getTimeMinutes(timeStr) {
  if (!timeStr) return 9999;
  const startStr = timeStr.split('–')[0] || timeStr.split('-')[0] || timeStr.split('to')[0];
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

function standardizeTime(rawTime) {
  if (!rawTime) return '';
  const parts = rawTime.split(/[-–—|to]+/i);
  if (parts.length < 2) return rawTime.trim();

  const parseSingleTime = (t) => {
    let match = t.trim().match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i);
    if (!match) return t.trim();
    let h = parseInt(match[1], 10);
    let m = match[2] ? parseInt(match[2], 10) : 0;
    let ampm = match[3] ? match[3].toUpperCase() : null;

    if (!ampm) {
      if (h >= 12) { ampm = 'PM'; if (h > 12) h -= 12; }
      else { ampm = 'AM'; }
    }
    return `${h}:${m < 10 ? '0' + m : m}`;
  };

  return `${parseSingleTime(parts[0])}-${parseSingleTime(parts[1])}`;
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
  const timeRegex = /(\d{1,2}:\d{2}\s*[-–—|to]+\s*\d{1,2}:\d{2})/i;

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

function renderWallpaper() {
  const grid = document.getElementById('wallpaperGrid');
  grid.innerHTML = '';

  const currentSubjects = semestersData[activeSem] || [];

  wallDays.forEach((dayObj, colIdx) => {
    const daySubjects = currentSubjects
      .filter(s => s.days.includes(dayObj.code))
      .sort((a, b) => getTimeMinutes(a.time) - getTimeMinutes(b.time));

    const colEl = document.createElement('div');
    colEl.className = 'wall-col';

    let cardsHtml = '';
    daySubjects.forEach((s, itemIdx) => {
      const themeClass = (colIdx + itemIdx) % 2 === 0 ? 'light' : 'dark';
      
      cardsHtml += `
        <div class="wall-card-item ${themeClass}">
          <div class="wall-card-time">${s.time}</div>
          <div class="wall-card-title">${s.title}</div>
          <div class="wall-card-room">${s.room || s.section || ''}</div>
        </div>
      `;
    });

    colEl.innerHTML = `
      <div class="wall-day-head">${dayObj.label}</div>
      ${cardsHtml}
    `;

    grid.appendChild(colEl);
  });
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
      document.getElementById('wallpaperCanvas').style.backgroundImage = `url('${evt.target.result}')`;
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
    toggleBtn.textContent = '✔️ Pure Transparent Active';
  } else {
    canvas.classList.remove('transparent-mode');
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '✨ Enable Pure Transparent BG';
  }
}

function toggleWallpaperMode() {
  document.body.classList.toggle('wallpaper-active');
  if (document.body.classList.contains('wallpaper-active')) {
    updateWallpaperHeader();
    renderWallpaper();
  }
}

function exportWallpaperImage() {
  const targetElement = document.getElementById('wallpaperCanvas');
  
  if (!window.html2canvas) {
    alert("Image export library is loading... Please try again in a moment.");
    return;
  }

  html2canvas(targetElement, {
    scale: 3, 
    useCORS: true,
    allowTaint: true,
    backgroundColor: null
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Schedule_Wallpaper_${activeSem.replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }).catch(err => {
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