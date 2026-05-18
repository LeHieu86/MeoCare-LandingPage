// Tiện ích ký số dùng chung cho InvoicePrint và OrderModal.

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export async function signPayload(payload, keyFile) {
  const keyPem  = await keyFile.text();
  const keyData = pemToArrayBuffer(keyPem);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoded   = new TextEncoder().encode(payload);
  const sigBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoded);

  const sigArray = Array.from(new Uint8Array(sigBuffer));
  return btoa(String.fromCharCode(...sigArray));
}

// Toàn bộ luồng: lấy payload → ký bằng keyFile → gửi server lưu.
// Trả về { signature, verifyUrl, signedAt } khi xong.
export async function signOrder(invoiceNo, keyFile, apiBase) {
  const token = localStorage.getItem("mc_admin_token");
  const authHeader = { Authorization: `Bearer ${token}` };

  const payloadRes = await fetch(`${apiBase}/sign/payload/${invoiceNo}`, { headers: authHeader });
  if (!payloadRes.ok) throw new Error("Không lấy được payload từ server");
  const { payload } = await payloadRes.json();

  const signature = await signPayload(payload, keyFile);

  const signRes = await fetch(`${apiBase}/sign/${invoiceNo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ signature }),
  });
  if (!signRes.ok) throw new Error("Server từ chối lưu signature");
  const result = await signRes.json();

  return { ...result, signature };
}
