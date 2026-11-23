/**
 * Generates a valid Brazilian Pix EMV BR Code (Copia e Cola) payload
 * following the Banco Central do Brasil specification.
 */

function normalizeAscii(str: string, maxLen: number): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
    .toUpperCase();
}

function formatPixKey(key: string, type: string): string {
  const trimmed = (key || '').trim();
  if (type === 'cpf' || type === 'cnpj') {
    return trimmed.replace(/\D/g, '');
  }
  if (type === 'phone') {
    const digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+')) return `+${digits}`;
    return digits.startsWith('55') && digits.length >= 12 ? `+${digits}` : `+55${digits}`;
  }
  if (type === 'email') {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(params: {
  pixKey: string;
  pixKeyType: string;
  receiverName: string;
  city?: string;
  amount: number;
  txid?: string;
}): string {
  const formattedKey = formatPixKey(params.pixKey, params.pixKeyType);
  const merchantName = normalizeAscii(params.receiverName || 'ANFITRIAO', 25) || 'ANFITRIAO';
  const merchantCity = normalizeAscii(params.city || 'BRASIL', 15) || 'BRASIL';
  const amountStr = Number(params.amount || 0).toFixed(2);
  const cleanTxid = (params.txid || 'PRESENTE')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25) || 'PRESENTE';

  const merchantAccountInfo =
    tlv('00', 'BR.GOV.BCB.PIX') +
    tlv('01', formattedKey);

  const additionalData = tlv('05', cleanTxid);

  const payloadWithoutCrc =
    tlv('00', '01') +
    tlv('26', merchantAccountInfo) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', amountStr) +
    tlv('58', 'BR') +
    tlv('59', merchantName) +
    tlv('60', merchantCity) +
    tlv('62', additionalData) +
    '6304';

  const crc = crc16Ccitt(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}
