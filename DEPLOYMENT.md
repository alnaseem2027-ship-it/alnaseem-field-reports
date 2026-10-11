# النشر على Firebase Spark

المستودع: https://github.com/alnaseem2027-ship-it/alnaseem-field-reports

Project ID: alnaseem-field-reports

Project number: 343899326790

## البنية الحالية

Next.js يصدر موقعًا ثابتًا إلى out. Firebase Hosting يستضيف الموقع، وAuthentication للحسابات، وFirestore للتقارير والسجل. لا توجد مسارات API خادمية أو App Hosting أو Vercel، ولا حاجة لمفتاح خدمة Firebase Admin.

الخطة Spark لها حدود استخدام مجانية؛ تجاوز الحصص قد يعطل عمليات بدلاً من ضمان خدمة غير محدودة. أنشئ Firestore في production mode، وفعل Email/Password في Authentication.

## إعداد تطبيق Web

من Project settings > General أضف Web app ثم احصل على firebaseConfig. انسخ .env.example إلى .env.local واملأ API key وApp ID وباقي القيم من إعدادات التطبيق. هذه إعدادات تطبيق ويب عامة وليست مفتاح خدمة خاصًا.

## GitHub

اكتمل تسجيل الدخول بالحساب alnaseem2027-ship-it ورفع الكود إلى main. لإعادة إعداد جهاز جديد:

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
git push -u origin main
```

ملفات البيئة وPDF المرجعي وصور الفحص مستبعدة. لا تضع مفاتيح خدمة أو كلمات مرور في المستودع.

## نشر Firebase

```powershell
npx firebase-tools login
npm run build
npx firebase-tools deploy --only hosting,firestore:rules --project alnaseem-field-reports
```

تم نشر الموقع بنجاح على https://alnaseem-field-reports.web.app بتاريخ 2026-10-11، مع إنشاء قاعدة default ونشر قواعد Firestore. إعدادات Web متوفرة محليًا وفي بيئة فحص GitHub. ما زال تفعيل Email/Password وإنشاء أول مدير واختبار الحسابات مطلوبًا.

## أول مدير

أنشئ حساب المدير من Firebase Authentication، ثم مستند users/UID من Console يحوي uid وemail وdisplayName وrole=admin وactive=true وcreatedAt كنص ISO. لا تتيح قواعد عامة لإنشاء المدير. المدير ينشئ الموظفين باستخدام جلسة Auth ثانوية مؤقتة دون تبديل جلسته.

## الضوابط والاختبارات

كل حساب Auth دون مستند مستخدم فعال ممنوع من البيانات. قواعد Firestore تفرض الملكية وثبات رقم التقرير والمالك وزيادة revision وإرفاق سجل نسخة ضمن المعاملة. السجلات لا تقبل تعديلًا أو حذفًا. استرجاع المؤرشف للمدير فقط.

الترقيم الحالي FR-UUID فريد ومستقر؛ ليس عدادًا سنويًا متسلسلًا. بيانات السجل تبدأ من تفعيل الخاصية. المسودات محلية للجهاز.

قبل اعتماد العمل: اختبر القواعد بحساب مدير وموظفين، تعارض التعديل، الأرشفة والاسترجاع، وعدم الوصول إلى تقارير موظف آخر. اختبار محاكي/مشروع حقيقي لم يكتمل بعد.

مراجع: https://firebase.google.com/docs/hosting/quickstart وhttps://firebase.google.com/docs/firestore/security/rules-conditions
