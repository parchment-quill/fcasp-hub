/* FCASP — Access Code Validation
   Requires SUPABASE_URL and SUPABASE_KEY defined before this script loads */

document.getElementById('accessCode').addEventListener('input', function () {
  let v = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
  if (v.length > 9) v = v.slice(0, 9) + '-' + v.slice(9);
  if (v.length > 14) v = v.slice(0, 14);
  this.value = v;
});

document.getElementById('accessCode').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') validateCode();
});

async function validateCode() {
  const code = document.getElementById('accessCode').value.trim().toUpperCase();
  const alertEl = document.getElementById('codeAlert');
  const btn = document.getElementById('codeBtn');

  if (!code || code.length < 14) {
    alertEl.innerHTML = '<div class="alert alert-error">Please enter a complete access code (format: XXXX-XXXX-XXXX)</div>';
    return;
  }

  btn.innerHTML = '<span class="loading"></span>Verifying...';
  btn.disabled = true;
  alertEl.innerHTML = '';

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code)}&select=id,code,is_used`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      alertEl.innerHTML = `<div class="alert alert-error">Server error (${res.status}): ${data.message || data.hint || JSON.stringify(data)}</div>`;
      btn.innerHTML = 'Verify Code &amp; Begin Survey';
      btn.disabled = false;
      return;
    }

    if (!data || data.length === 0) {
      alertEl.innerHTML = '<div class="alert alert-error">This code was not found. Please check it and try again, or contact the person who gave you the code.</div>';
      btn.innerHTML = 'Verify Code &amp; Begin Survey';
      btn.disabled = false;
      return;
    }

    if (data[0].is_used === true) {
      alertEl.innerHTML = '<div class="alert alert-error">This code has already been used. Each code can only be used once. Please contact your gatekeeper for assistance.</div>';
      btn.innerHTML = 'Verify Code &amp; Begin Survey';
      btn.disabled = false;
      return;
    }

    sessionStorage.setItem('fcasp_validated_id', data[0].id);
    sessionStorage.setItem('fcasp_validated_code', data[0].code);
    window.location.href = '/sonoma/survey';

  } catch (err) {
    alertEl.innerHTML = '<div class="alert alert-error">Connection error. Please check your internet and try again.</div>';
    btn.innerHTML = 'Verify Code &amp; Begin Survey';
    btn.disabled = false;
  }
}
