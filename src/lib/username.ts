export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) {
    throw new Error("اسم المستخدم من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا، ويمكن استخدام _ أو - بعد الحرف الأول.");
  }
  return username;
}

export function usernameEmail(value: string) {
  return `${normalizeUsername(value)}@alnaseem-field-reports.firebaseapp.com`;
}
