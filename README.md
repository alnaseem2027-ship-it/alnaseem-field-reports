# Alnaseem Field Reports

تطبيق ويب عربي لإدارة تقارير العمل الميداني لشركة النسيم إخوان.

## التشغيل المحلي

```bash
npm install
npm run dev
```

افتح `http://localhost:3000`.

## إعداد Firebase

انسخ `.env.example` إلى `.env.local` وأضف قيم مشروع Firebase.

المتغيرات التي تبدأ بـ `NEXT_PUBLIC_` تخص تطبيق الويب. أما:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

لم تعد مطلوبة في بنية Spark الحالية؛ الحسابات والتقارير تدار عبر Firebase client وقواعد Firestore. تعليمات النشر المعتمدة موجودة في DEPLOYMENT.md.

## الحفظ وسجل التعديلات

- المسودة تحفظ تلقائيًا على الجهاز لكل حساب، ويمكن متابعتها بعد إعادة التحميل؛ الحفظ النهائي يرسل التقرير إلى قاعدة البيانات.
- المدير يسترجع التقارير من شاشة المحذوفات، والموظف يملك تعديل وحذف تقاريره فقط.
- سجل التعديلات يحتفظ بنسخ التقرير واسم الفاعل، بدءًا من تفعيل الخاصية.
- الترقيم في بنية Spark يستخدم FR-UUID فريدًا وثابتًا، دون عداد سنوي.
- اختبار الدورة المحلية: `node tests/report-lifecycle.cjs` مع تثبيت Playwright وتشغيل الموقع على 3001.
- اختبار Excel: `node tests/excel-export.cjs`.

## النشر

- ارفع المشروع إلى GitHub.
- املأ .env.local بإعدادات تطبيق Web ثم ابن التطبيق بموجب npm run build.
- انشر out على Firebase Hosting وفق DEPLOYMENT.md. لا تستخدم Vercel أو App Hosting.
- انشر قواعد Firestore من Firebase CLI أو من لوحة Firebase.
