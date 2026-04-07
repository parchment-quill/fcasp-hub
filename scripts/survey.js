/* FCASP — Survey Logic
   Requires SUPABASE_URL and SUPABASE_KEY defined before this script loads.
   Requires sessionStorage keys fcasp_validated_id and fcasp_validated_code. */

// Guard: must arrive via validated access code
const validatedCode    = sessionStorage.getItem('fcasp_validated_id');
const validatedCodeStr = sessionStorage.getItem('fcasp_validated_code');
if (!validatedCode) {
  window.location.href = '/sonoma';
}
const isMasterCode = validatedCode === 'master';

const TOTAL_STEPS  = 6;
let currentStep    = 1;
let selectedJudges = [];

/* ---- PROGRESS ---- */
function renderProgress(step) {
  const wrap = document.getElementById('progressSteps');
  wrap.innerHTML = '';
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const d = document.createElement('div');
    d.className = 'prog-dot' + (i < step ? ' done' : i === step ? ' active' : '');
    wrap.appendChild(d);
  }
  const labels = ['', 'Your Case', 'Professionals', 'Misconduct', 'DV Context', 'Outcomes', 'Contact'];
  document.getElementById('progressLabel').textContent =
    labels[step] + ' — Step ' + step + ' of ' + TOTAL_STEPS;
}

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('step-' + (n === 'complete' ? 'complete' : n));
  if (el) el.classList.add('active');
  if (n !== 'complete') renderProgress(n);
  window.scrollTo(0, 0);
}

function nextStep(from) {
  if (!validateStep(from)) return;
  currentStep = from + 1;
  showStep(currentStep);
}

function prevStep(from) {
  currentStep = from - 1;
  showStep(currentStep);
}

/* ---- STEP VALIDATION ---- */
function validateStep(step) {
  if (step === 1) {
    if (document.querySelectorAll('#caseTypeGroup input:checked').length === 0) {
      alert('Please select at least one case type.');
      return false;
    }
  }
  if (step === 2) {
    if (selectedJudges.length === 0) {
      alert('Please select at least one judge (or "Other" if unknown).');
      return false;
    }
  }
  return true;
}

/* ---- JUDGE TAGS ---- */
function toggleJudge(el) {
  el.classList.toggle('selected');
  const val = el.dataset.value;
  if (el.classList.contains('selected')) {
    if (!selectedJudges.includes(val)) selectedJudges.push(val);
  } else {
    selectedJudges = selectedJudges.filter(j => j !== val);
  }
}

/* ---- CHECK-ITEM STYLING ---- */
document.addEventListener('change', function (e) {
  if (e.target.type !== 'checkbox' && e.target.type !== 'radio') return;
  const item = e.target.closest('.check-item');
  if (!item) return;
  if (e.target.type === 'radio') {
    document.querySelectorAll(`input[name="${e.target.name}"]`).forEach(r => {
      r.closest('.check-item').classList.remove('selected');
    });
  }
  if (e.target.checked) item.classList.add('selected');
  else item.classList.remove('selected');

  if (e.target.name === 'contactConsent') {
    document.getElementById('contactInfoField').style.display =
      e.target.value === 'yes' ? 'block' : 'none';
  }
});

/* ---- CHAR COUNT ---- */
function updateCharCount(el, countId) {
  document.getElementById(countId).textContent = el.value.length + ' / ' + el.maxLength;
}

/* ---- DATA COLLECTION ---- */
function getCheckedValues(groupId) {
  return Array.from(document.querySelectorAll(`#${groupId} input:checked`)).map(i => i.value);
}
function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}
function collectData() {
  return {
    case_type:              getCheckedValues('caseTypeGroup'),
    case_start_year:        parseInt(document.getElementById('caseYear').value) || null,
    case_status:            getRadioValue('caseStatus'),
    minor_children:         getRadioValue('minorChildren') === 'yes',
    judges:                 selectedJudges,
    petitioner_attorney:    attyGetValue('your'),
    respondent_attorney:    attyGetValue('opp'),
    gal_counsel:            attyGetValue('gal'),
    other_professionals:    document.getElementById('otherProfs').value.trim() || null,
    judicial_violations:    getCheckedValues('judicialViolations'),
    attorney_violations:    getCheckedValues('attorneyViolations'),
    experience_description: document.getElementById('experienceText').value.trim() || null,
    complaints_filed:       document.getElementById('complaintsText').value.trim() || null,
    dv_alleged:             getRadioValue('dvAlleged'),
    dv_evidence_submitted:  getRadioValue('dvEvidence') !== 'no' && getRadioValue('dvEvidence') !== 'na',
    dv_evidence_considered: getRadioValue('dvEvidence') === 'yes_considered',
    dv_minimized:           getRadioValue('dvMinimized') === 'yes',
    protective_order:       getRadioValue('protectiveOrder') !== 'no',
    protective_order_enforced: getRadioValue('protectiveOrder') === 'yes_enforced',
    custody_outcome:        document.getElementById('custodyOutcome').value.trim() || null,
    outcome_influenced:     getRadioValue('outcomeInfluenced'),
    financial_harm:         getCheckedValues('financialHarmGroup'),
    safety_concerns:        getRadioValue('safetyConcerns') === 'yes',
    contact_consent:        getRadioValue('contactConsent') === 'yes',
    data_use_consent:       getRadioValue('dataUse') === 'yes',
    contact_info:           document.getElementById('contactInfo').value.trim() || null
  };
}

/* ---- SUBMIT ---- */
async function submitSurvey() {
  const alertEl = document.getElementById('submitAlert');
  const btn     = document.getElementById('submitBtn');

  if (!getRadioValue('dataUse')) {
    alertEl.innerHTML = '<div class="alert alert-warning">Please indicate your consent preference before submitting.</div>';
    return;
  }

  btn.innerHTML = '<span class="loading"></span>Submitting...';
  btn.disabled  = true;
  alertEl.innerHTML = '';

  try {
    const surveyData = collectData();
    const payload = {
      survey_data:      surveyData,
      attorney_name:    surveyData.petitioner_attorney || surveyData.respondent_attorney || null,
      judge_name:       Array.isArray(surveyData.judges) ? surveyData.judges.join(', ') : (surveyData.judges || null),
      access_code_used: validatedCodeStr
    };

    const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/survey_responses`, {
      method: 'POST',
      headers: {
        apikey:         SUPABASE_KEY,
        Authorization:  `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!resInsert.ok) {
      const errBody = await resInsert.json().catch(() => ({}));
      throw new Error(`Insert failed (${resInsert.status}): ${errBody.message || errBody.hint || JSON.stringify(errBody)}`);
    }

    // Master codes are never consumed
    if (!isMasterCode) {
      await fetch(`${SUPABASE_URL}/rest/v1/access_codes?id=eq.${validatedCode}`, {
        method: 'PATCH',
        headers: {
          apikey:         SUPABASE_KEY,
          Authorization:  `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_used: true })
      });
    }

    sessionStorage.removeItem('fcasp_validated_id');
    sessionStorage.removeItem('fcasp_validated_code');
    showStep('complete');

  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">Something went wrong: ${err.message}. Please try again. Your answers have not been lost.</div>`;
    btn.innerHTML = 'Submit My Response';
    btn.disabled  = false;
  }
}

/* ---- ATTORNEY SELECTOR ---- */
const ATTORNEYS = [
  "A. Trombetta Jr","Aaron Light","Alisha Sikes","Alison Ronald","Amanda Waters","Andrew Conway",
  "Andrew Stadler","Angelle Wertz","Ann Larson","Anne Tamar-Mattis","Bartholome Kemp","Brandon Blevans",
  "Bret Campoy","Brian Lanz","Carla Boyd","Carla Hernandez Castillo","Carla Roden","Carolyn McBeath",
  "Carolyn Vandyk","Catherine Thompson","Celeste Johansson","Charlotte Creaghan","Charlotte Huggins",
  "Chelsea Condiotti","Christine Gregson","Christopher Lomanto","Christopher Malloy","Christopher Vivian",
  "Claudia Heyde","Constance Burtnett","Cynthia Acevedo","Danelle Jacobs","Daniel Cantrell","Daniel Chester",
  "Daniel Riviera","Danielle Petersen","Danielle Restieaux-Louis","David Gonzalez","Debora Loughner",
  "Deborah Bull","Debra Bel","Deirdre Kingsbury","Destinee Tartuffe","Diane Nguyen","Dominic Rosales",
  "Douglas Provencher","Edward Collins","Elissa Urlik","Elizabeth Gowdy","Elizabeth Strasen","Ellen Levy",
  "Erin Farley","Fiona Murphy","Francisco Martinez","George Castagnola Jr","Gina Fortino Dickson",
  "Harold Sewall","Heather Stone","Jackie Martens","Jacob Faircloth","James Barnes","James Carroll",
  "James Castranova","Janessa McCune","Jarin Beck","Jason Hight","Jeanne Browne","Jeffrey Adams",
  "Jenna Coffey","Jennifer Alexander","Jennifer Applegate","Jennifer Knops","Jennifer Obergfell","Jill White",
  "JoAnn Bertram","Johanna Kleppe","John Johnson","Jon VonderHaar","Julie Kurt","Kara Herren","Karen Webb",
  "Kathleen Henderson","Kathleen Smith","Kelsey O'Rourke","Laura Dunst","Lauren Camarda Costlow",
  "Lawrence Moskowitz","Leo Bartolotta","Linda Penzotti","Lindsay Torgerson","Lisa Gygax","Lorilee Zimmer",
  "Lorraine Cleff","Margaret England","Marianne Skipper","Marla Keenan-Rivero","MaryAnna Machi",
  "Michael Dietrick","Michael Fish","Michael Liotta","Michael Samuels","Michael Shambrook","Michael Watters",
  "Morgan Vendrick","Morna Challoner","Nathan Siedman","Nicole Smith","Nicole Umemoto-Snyder",
  "Patricia Schuermann","Patrick Grattan","Paula Hall","Peter Balogh","Rachael Erickson","Rachael McFarren",
  "Rachel Clift","Rebecca Berrey-May","Rebecca Hickox","Richard Paris","Richard Sax","Robert Blevans",
  "Robert Montgomery","Robin Estes","Rod Moore","Russell Townsend","Samantha Vance","Sandra Acevedo",
  "Sarah Kaplan","Shannon Kiser","Shawn Bunyard","Sheila Craig","Sheri Chlebowski","Stephanie Ransom",
  "Stephen Zollman","Susan Barrett","Susannah Edwards","Tasha Bollinger","Thomas Wright","Traci Carrillo",
  "Travis Ransom","Tricia Seifert","Wallace Francis","William Doty","William Paynter","Yatindra Pandya"
];

const attyState  = { your: [], opp: [], gal: [] };
let attyTimers   = {};

function attyFilter(field) {
  const input    = document.getElementById('search' + attyFieldId(field));
  const q        = input.value.trim().toLowerCase();
  const clearBtn = document.getElementById('clear' + attyFieldId(field));
  clearBtn.style.display = q ? 'flex' : 'none';
  attyRenderDropdown(field, q);
}
function attyOpen(field) {
  if (attyTimers[field]) clearTimeout(attyTimers[field]);
  const q = document.getElementById('search' + attyFieldId(field)).value.trim().toLowerCase();
  attyRenderDropdown(field, q);
}
function attyClose(field) {
  attyTimers[field] = setTimeout(() => {
    document.getElementById('drop' + attyFieldId(field)).classList.remove('open');
  }, 200);
}
function attyRenderDropdown(field, q) {
  const dd       = document.getElementById('drop' + attyFieldId(field));
  const selected = attyState[field];
  const filtered = ATTORNEYS.filter(a => !selected.includes(a) && (!q || a.toLowerCase().includes(q)));
  if (filtered.length === 0) {
    dd.innerHTML = '<div class="atty-dropdown-empty">No match — use the field below to enter the name</div>';
  } else {
    dd.innerHTML = filtered.slice(0, 40).map(a => {
      const esc     = a.replace(/'/g, "\\'");
      const display = q
        ? a.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>')
        : a;
      return `<div class="atty-dropdown-item" onmousedown="attySelect('${field}','${esc}')">${display}</div>`;
    }).join('');
    if (filtered.length > 40)
      dd.innerHTML += '<div class="atty-dropdown-empty">Keep typing to narrow results</div>';
  }
  dd.classList.add('open');
}
function attySelect(field, name) {
  if (!attyState[field].includes(name)) attyState[field].push(name);
  document.getElementById('search' + attyFieldId(field)).value = '';
  document.getElementById('clear'  + attyFieldId(field)).style.display = 'none';
  document.getElementById('drop'   + attyFieldId(field)).classList.remove('open');
  attyRenderTags(field);
}
function attyRemove(field, name) {
  attyState[field] = attyState[field].filter(a => a !== name);
  attyRenderTags(field);
}
function attyRenderTags(field) {
  const tags = document.getElementById('tags' + attyFieldId(field));
  tags.innerHTML = attyState[field].map(a => {
    const esc = a.replace(/'/g, "\\'");
    return `<div class="atty-tag">${a}<button class="atty-tag-remove" onmousedown="attyRemove('${field}','${esc}')">✕</button></div>`;
  }).join('');
}
function attyClear(field) {
  document.getElementById('search' + attyFieldId(field)).value = '';
  document.getElementById('clear'  + attyFieldId(field)).style.display = 'none';
  document.getElementById('drop'   + attyFieldId(field)).classList.remove('open');
}
function attyFieldId(field) {
  return field === 'your' ? 'YourAtty' : field === 'opp' ? 'OppAtty' : 'GalAtty';
}
function attyGetValue(field) {
  const selected = attyState[field];
  const free     = document.getElementById('free' + attyFieldId(field)).value.trim();
  const all      = [...selected, ...(free ? [free] : [])];
  return all.length ? all.join('; ') : null;
}

/* ---- INIT ---- */
renderProgress(1);
