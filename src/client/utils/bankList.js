// Danh sách ngân hàng VN phổ biến — BIN code cho VietQR
// Nguồn: https://api.vietqr.io/v2/banks
export const VN_BANKS = [
  { code: "VCB", bin: "970436", name: "Vietcombank" },
  { code: "TCB", bin: "970407", name: "Techcombank" },
  { code: "MB",  bin: "970422", name: "MB Bank" },
  { code: "ACB", bin: "970416", name: "ACB" },
  { code: "VPB", bin: "970432", name: "VPBank" },
  { code: "TPB", bin: "970423", name: "TPBank" },
  { code: "BIDV", bin: "970418", name: "BIDV" },
  { code: "VTB", bin: "970415", name: "VietinBank" },
  { code: "AGR", bin: "970405", name: "Agribank" },
  { code: "SHB", bin: "970443", name: "SHB" },
  { code: "STB", bin: "970403", name: "Sacombank" },
  { code: "HDB", bin: "970437", name: "HDBank" },
  { code: "OCB", bin: "970448", name: "OCB" },
  { code: "MSB", bin: "970426", name: "MSB" },
  { code: "EIB", bin: "970431", name: "Eximbank" },
  { code: "VIB", bin: "970441", name: "VIB" },
  { code: "SCB", bin: "970429", name: "SCB" },
  { code: "ABB", bin: "970425", name: "ABBank" },
  { code: "NAB", bin: "970428", name: "NamABank" },
];

// Gen VietQR image URL (PNG) — quét bằng app banking VN sẽ tự fill STK + amount + memo
export function vietQrUrl({ bin, account, amount, memo }) {
  if (!bin || !account) return null;
  const params = new URLSearchParams();
  if (amount) params.set("amount", String(amount));
  if (memo) params.set("addInfo", memo);
  const qs = params.toString();
  return `https://img.vietqr.io/image/${bin}-${account}-qr_only.png${qs ? "?" + qs : ""}`;
}
