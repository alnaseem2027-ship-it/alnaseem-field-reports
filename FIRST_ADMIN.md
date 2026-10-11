# إنشاء أول مدير

الدخول في الموقع باسم مستخدم وكلمة مرور. للمدير الأول سنستخدم اسم admin؛ لا توجد كلمة مرور افتراضية.

## Authentication

من Firebase Console > Authentication > Users > Add user:

- Email: admin@alnaseem-field-reports.firebaseapp.com
- Password: اختر بنفسك كلمة مرور قوية لا تقل عن 8 أحرف. لا ترسلها في المحادثة.

احفظ الحساب وانسخ User UID. هذا البريد معرف داخلي للحساب ولا يستقبل رسائل استعادة كلمة المرور.

## Firestore

من Firestore Database > Data:

1. اضغط Start collection واكتب users.
2. في Document ID ألصق User UID نفسه، ولا تستخدم Auto-ID.
3. أضف الحقول التالية ثم Save:

| Field | Type | Value |
| --- | --- | --- |
| uid | string | User UID نفسه |
| username | string | admin |
| email | string | admin@alnaseem-field-reports.firebaseapp.com |
| displayName | string | مدير النسيم |
| role | string | admin |
| active | boolean | true |
| createdAt | string | 2026-10-11T00:00:00.000Z |

ثم افتح https://alnaseem-field-reports.web.app وأدخل admin وكلمة المرور التي اخترتها. من شاشة الموظفين أنشئ حسابًا باختيار الاسم الكامل واسم المستخدم وكلمة المرور.

أسماء المستخدمين من 3 إلى 32 حرفًا إنجليزيًا/رقمًا، مع _ أو - بعد أول حرف. الاسم غير حساس لحالة الأحرف، فلا يمكن إنشاء Admin وadmin كحسابين منفصلين. الحسابات لا تملك مسار تسجيل ذاتي في واجهة الموقع، ووجود حساب Authentication وحده لا يعطي الوصول إلى البيانات.

استعادة كلمات المرور بالبريد غير متاحة لهذه المعرفات الداخلية؛ عند الحاجة يعدل صاحب المشروع كلمة المرور من Firebase Console.
