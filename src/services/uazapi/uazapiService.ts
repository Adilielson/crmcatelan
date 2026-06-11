// URL base fixa — não editável pelo usuário.
// Somente token de instância é usado no header "token". Nunca admintoken.
const UAZAPI_BASE_URL = 'https://ipazua.uazapi.com';

function makeHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'token': token,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let bodyMsg = '';
    try {
      const body = await res.json();
      bodyMsg = body?.error ? String(body.error) : JSON.stringify(body);
    } catch {
      bodyMsg = await res.text().catch(() => '');
    }
    throw new Error(bodyMsg || `Erro HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface InstanceStatus {
  connected: boolean;
  name?: string;
  phone?: string;
}

export interface QRCodeResponse {
  qrcode?: string;
  base64?: string;
}

export async function checkInstanceStatus(token: string): Promise<InstanceStatus> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/instance/info`, {
      method: 'GET',
      headers: makeHeaders(token),
    });
    return handleResponse<InstanceStatus>(res);
  } catch {
    throw new Error('Não foi possível verificar o status da instância.');
  }
}

export async function getQRCode(token: string): Promise<QRCodeResponse> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/instance/qrcode`, {
      method: 'GET',
      headers: makeHeaders(token),
    });
    return handleResponse<QRCodeResponse>(res);
  } catch {
    throw new Error('Não foi possível obter o QR Code.');
  }
}

export async function disconnectInstance(token: string): Promise<void> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/instance/logout`, {
      method: 'DELETE',
      headers: makeHeaders(token),
    });
    await handleResponse<unknown>(res);
  } catch {
    throw new Error('Não foi possível desconectar a instância.');
  }
}

export async function sendTextMessage(token: string, phone: string, text: string): Promise<void> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/message/sendText`, {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify({ number: phone, text }),
    });
    await handleResponse<unknown>(res);
  } catch {
    throw new Error('Não foi possível enviar a mensagem de texto.');
  }
}

export async function sendImageMessage(
  token: string,
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<void> {
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/message/sendImage`, {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify({ number: phone, imageUrl, caption }),
    });
    await handleResponse<unknown>(res);
  } catch {
    throw new Error('Não foi possível enviar a imagem.');
  }
}
