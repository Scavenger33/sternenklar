export async function onRequestPost(context) {
  const { env, request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const { email, source } = body;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const apiKey = env.BREVO_API_KEY;
  const listIdRaw = source === 'waitlist'
    ? env.BREVO_LIST_ID_WAITLIST
    : env.BREVO_LIST_ID;
  const listId = parseInt(listIdRaw, 10);

  if (!apiKey || !listId) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), {
      status: 500, headers: corsHeaders,
    });
  }

  const brevoBody = {
    email,
    listIds: [listId],
    updateEnabled: true,
  };

  let brevoRes;
  try {
    brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(brevoBody),
    });
  } catch (err) {
    console.error('Brevo fetch failed:', err);
    return new Response(JSON.stringify({ ok: false, error: 'brevo_unreachable' }), {
      status: 502, headers: corsHeaders,
    });
  }

  // 201 = created, 204 = updated — beide sind Erfolg
  // 400 mit code "duplicate_parameter" = Kontakt existiert bereits → still behandeln
  if (brevoRes.ok || brevoRes.status === 204) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }

  const errBody = await brevoRes.json().catch(() => ({}));
  const isDuplicate = errBody?.code === 'duplicate_parameter';
  if (isDuplicate) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }

  console.error('Brevo error:', brevoRes.status, errBody);
  return new Response(JSON.stringify({ ok: false, error: 'brevo_error', detail: errBody }), {
    status: 502, headers: corsHeaders,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
