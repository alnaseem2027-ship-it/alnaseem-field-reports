"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Car,
  CheckCircle2,
  ClipboardList,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  History,
  RotateCcw,
  LogOut,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import {
  archiveReport,
  buildAutofillOptions,
  emptyPart,
  listenToReports,
  loadUsers,
  makeReportNumber,
  readDemoReports,
  saveDemoUser,
  saveReport
  ,loadReportHistory, createEmployeeAccount, type HistoryEntry
} from "@/lib/reportStore";
import type { AppUser, FieldReport, ReportPart, UserRole, WarrantyStatus, WorkType } from "@/lib/types";

const workTypeLabels: Record<WorkType, string> = {
  installation: "تركيب",
  maintenance: "صيانة",
  inspection: "كشف"
};

const today = () => new Date().toISOString().slice(0, 10);

function createEmptyReport(user: AppUser): FieldReport {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    reportNumber: "يُحدد عند الحفظ",
    customerName: "",
    customerPhone: "",
    orderNumber: "",
    workType: "installation",
    problemDescription: "",
    area: "",
    projectName: "",
    previousSupply: "no",
    previousSupplyDetails: "",
    technicians: [""],
    parts: [emptyPart()],
    serviceFee: 0,
    warranty: "yes",
    paymentStatus: "cash",
    recommendations: "",
    receiverSignature: "",
    technicianSignature: "",
    managerSignature: "",
    carNumber: "",
    startTime: "",
    endTime: "",
    reportDate: today(),
    createdByUid: user.uid,
    createdByName: user.displayName,
    createdAt: now,
    updatedAt: now,
    archived: false
  };
}

function reportTotal(report: FieldReport) {
  return report.parts.reduce((sum, part) => sum + Number(part.quantity || 0) * Number(part.price || 0), 0) + Number(report.serviceFee || 0);
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [allReports, setReports] = useState<FieldReport[]>([]);
  const reports = useMemo(() => allReports.filter((r) => !r.archived), [allReports]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeView, setActiveView] = useState<"reports" | "dashboard" | "users" | "archive">("reports");
  const [draft, setDraft] = useState<FieldReport | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [editingReport, setEditingReport] = useState<FieldReport | null>(null);
  const [previewReport, setPreviewReport] = useState<FieldReport | null>(null);
  const [query, setQuery] = useState("");
  const [workFilter, setWorkFilter] = useState<"all" | WorkType>("all");
  const [saving, setSaving] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ displayName: "", email: "", password: "" });
  const [notice, setNotice] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editorMessage, setEditorMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) return;
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        return;
      }
      if (!db) return;
      const profile = await getDoc(doc(db, "users", firebaseUser.uid));
      const data = profile.data();
      if (!data || data.active === false) { setAuthError("الحساب غير فعال."); if (auth) await signOut(auth); return; }
      setCurrentUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: data?.displayName || firebaseUser.displayName || firebaseUser.email || "مستخدم",
        role: (data?.role as UserRole) || "employee",
        active: data?.active !== false
      });
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = listenToReports(currentUser, setReports, (error) => setNotice(error.message));
    loadUsers().then(setUsers).catch(() => undefined);
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    try { setDraft(JSON.parse(localStorage.getItem(`alnaseem_draft_${currentUser.uid}`) || "null")); }
    catch { setDraftStatus("تعذر قراءة المسودة المحلية."); }
  }, [currentUser]);
  useEffect(() => {
    if (!editingReport || !currentUser) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`alnaseem_draft_${currentUser.uid}`, JSON.stringify(editingReport));
        setDraft(editingReport); setDraftStatus("المسودة محفوظة على هذا الجهاز");
      } catch { setDraftStatus("تعذر حفظ المسودة على الجهاز."); }
    }, 600);
    return () => clearTimeout(timer);
  }, [editingReport, currentUser]);
  useEffect(() => {
    if (!editingReport) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editingReport]);

  function openNewReport() {
    if (!currentUser) return;
    if (draft && !window.confirm("إنشاء تقرير جديد سيستبدل المسودة المحفوظة. هل تريد المتابعة؟")) return;
    setEditorMessage(""); setEditingReport(createEmptyReport(currentUser));
  }

  const autofill = useMemo(() => buildAutofillOptions(reports), [reports]);

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesSearch =
        !normalized ||
        [
          report.reportNumber,
          report.customerName,
          report.customerPhone,
          report.orderNumber,
          report.area,
          report.projectName,
          report.createdByName
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalized));
      const matchesType = workFilter === "all" || report.workType === workFilter;
      return matchesSearch && matchesType && (!dateFrom || report.reportDate >= dateFrom) && (!dateTo || report.reportDate <= dateTo) && (currentUser?.role !== "admin" || !employeeFilter || report.createdByUid === employeeFilter);
    });
  }, [query, reports, workFilter, dateFrom, dateTo, employeeFilter, currentUser]);

  async function exportExcel() {
    if (!currentUser || exporting) return;
    setExporting(true);
    try {
      const { downloadReportsExcel } = await import("@/lib/exportReports");
      const scope = `من ${dateFrom || "البداية"} إلى ${dateTo || "النهاية"}؛ النوع: ${workFilter === "all" ? "الكل" : workTypeLabels[workFilter]}؛ البحث: ${query || "الكل"}؛ الموظف: ${currentUser.role === "admin" ? employeeFilter || "الكل" : currentUser.displayName}؛ ${filteredReports.length} تقرير`;
      await downloadReportsExcel(filteredReports, currentUser, scope);
      setNotice("تم تجهيز ملف Excel وتنزيله.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تصدير Excel. يرجى المحاولة مجددًا.");
    } finally {
      setExporting(false);
    }
  }

  const dashboard = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const byEmployee = new Map<string, number>();
    const byType = new Map<WorkType, number>();
    let todayCount = 0;
    let monthCount = 0;

    reports.forEach((report) => {
      if (report.reportDate === today()) todayCount += 1;
      if (report.reportDate.startsWith(thisMonth)) monthCount += 1;
      byEmployee.set(report.createdByName, (byEmployee.get(report.createdByName) || 0) + 1);
      byType.set(report.workType, (byType.get(report.workType) || 0) + 1);
    });

    return {
      todayCount,
      monthCount,
      total: reports.length,
      totalValue: reports.reduce((sum, report) => sum + reportTotal(report), 0),
      byEmployee: Array.from(byEmployee.entries()).sort((a, b) => b[1] - a[1]),
      byType
    };
  }, [reports]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");
    if (!isFirebaseConfigured || !auth) {
      setCurrentUser({
        uid: "demo-admin",
        email: "admin@demo.local",
        displayName: "مدير تجريبي",
        role: "admin",
        active: true
      });
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setAuthError("تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.");
    }
  }

  async function logout() {
    if (auth) await signOut(auth);
    setCurrentUser(null);
    setEditingReport(null);
    setPreviewReport(null);
    setDraft(null); setReports([]); setHistory(null); setActiveView("reports");
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!editingReport || !currentUser) return;
    setSaving(true);
    setEditorMessage("");
    const reportToSave = {
      ...editingReport,
      createdByUid: editingReport.createdByUid || currentUser.uid,
      createdByName: editingReport.createdByName || currentUser.displayName,
      parts: editingReport.parts.filter((part) => part.item || part.quantity || part.price)
    };
    try {
    if (reportToSave.reportNumber === "يُحدد عند الحفظ" && !isFirebaseConfigured) reportToSave.reportNumber = makeReportNumber();
    await saveReport(reportToSave, currentUser);
    setEditingReport(null);
    localStorage.removeItem(`alnaseem_draft_${currentUser.uid}`);
    setDraft(null);
    if (!isFirebaseConfigured) {
      const demoReports = readDemoReports();
      setReports(currentUser.role === "admin" ? demoReports : demoReports.filter((item) => item.createdByUid === currentUser.uid));
    }
    setNotice("تم حفظ التقرير بنجاح.");
    setEditorMessage("تم حفظ التقرير بنجاح.");
    } catch (error) {
      setEditorMessage(error instanceof Error ? error.message : "تعذر الحفظ. بياناتك ما زالت موجودة، يرجى المحاولة مجددًا.");
    } finally {
      setSaving(false);
    }
  }

  async function removeReport(report: FieldReport) {
    if (!report.id || !currentUser) return;
    if (!window.confirm(`هل تريد حذف التقرير ${report.reportNumber}؟`)) return;
    try {
    await archiveReport(report.id, currentUser);
    if (!isFirebaseConfigured) {
      const demoReports = readDemoReports();
      setReports(currentUser?.role === "admin" ? demoReports : demoReports.filter((item) => item.createdByUid === currentUser?.uid));
    }
    setNotice(currentUser?.role === "admin" ? "تمت أرشفة التقرير." : "تم حذف التقرير من قائمتك.");
    } catch {
      setNotice("تعذر حذف التقرير. يرجى المحاولة مجددًا.");
    }
  }

  async function restoreReport(report: FieldReport) {
    if (!report.id || !currentUser) return;
    try {
      await archiveReport(report.id, currentUser, true);
      if (!isFirebaseConfigured) setReports(readDemoReports());
      setNotice("تم استرجاع التقرير.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر الاسترجاع."); }
  }
  async function showHistory(report: FieldReport) {
    if (!report.id) return;
    try { setHistory(await loadReportHistory(report.id)); }
    catch { setNotice("تعذر تحميل سجل التعديلات."); }
  }

  function updateReport<K extends keyof FieldReport>(key: K, value: FieldReport[K]) {
    setEditingReport((report) => (report ? { ...report, [key]: value } : report));
  }

  function updatePart(id: string, changes: Partial<ReportPart>) {
    setEditingReport((report) =>
      report
        ? {
            ...report,
            parts: report.parts.map((part) => (part.id === id ? { ...part, ...changes } : part))
          }
        : report
    );
  }

  async function createEmployee(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    setNotice("");

    if (!isFirebaseConfigured || !auth) {
      await saveDemoUser({
        uid: "",
        email: employeeForm.email,
        displayName: employeeForm.displayName,
        role: "employee",
        active: true
      });
      setUsers(await loadUsers());
      setEmployeeForm({ displayName: "", email: "", password: "" });
      setNotice("تم إنشاء موظف تجريبي محليًا.");
      return;
    }

    try { await createEmployeeAccount(employeeForm); }
    catch { setNotice("تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور وصلاحياتك."); return; }

    setUsers(await loadUsers());
    setEmployeeForm({ displayName: "", email: "", password: "" });
    setNotice("تم إنشاء حساب الموظف بنجاح.");
  }

  if (!currentUser) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand-lockup">
            <Image src="/alnaseem-logo.png" alt="شعار شركة النسيم إخوان" width={118} height={118} priority />
            <div>
              <p>شركة النسيم إخوان</p>
              <h1>تقارير العمل الميداني</h1>
            </div>
          </div>
          <form onSubmit={login} className="login-form">
            <label>
              البريد الإلكتروني
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@company.com" />
            </label>
            <label>
              كلمة المرور
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" />
            </label>
            {authError && <p className="error-text">{authError}</p>}
            {!isFirebaseConfigured && <p className="hint">نسخة تجريبية · البيانات محفوظة على هذا الجهاز فقط</p>}
            <button className="primary-btn" type="submit">
              <ShieldCheck size={18} />
              دخول النظام
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Image src="/alnaseem-logo.png" alt="شعار شركة النسيم إخوان" width={72} height={72} />
          <div>
            <strong>النسيم إخوان</strong>
            <span>{currentUser.role === "admin" ? "مدير النظام" : "موظف إدخال"}</span>
          </div>
        </div>
        <nav>
          <button className={activeView === "reports" ? "active" : ""} onClick={() => setActiveView("reports")}>
            <ClipboardList size={18} />
            التقارير
          </button>
          {currentUser.role === "admin" && (
            <>
              <button className={activeView === "dashboard" ? "active" : ""} onClick={() => setActiveView("dashboard")}>
                <BarChart3 size={18} />
                لوحة المدير
              </button>
              <button className={activeView === "users" ? "active" : ""} onClick={() => setActiveView("users")}>
                <Users size={18} />
                الموظفون
              </button>
              <button className={activeView === "archive" ? "active" : ""} onClick={() => setActiveView("archive")}><Archive size={18} />المحذوفات</button>
            </>
          )}
        </nav>
        <div className="sidebar-account"><span className="avatar">{currentUser.displayName.slice(0, 1)}</span><div><strong>{currentUser.displayName}</strong><span>{currentUser.role === "admin" ? "مدير النظام" : "موظف إدخال"}</span></div></div>
        <button className="ghost-btn logout" onClick={logout}>
          <LogOut size={18} />
          خروج
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>مرحبًا، {currentUser.displayName}</p>
            <h1>{activeView === "dashboard" ? "لوحة إنجازات الموظفين" : activeView === "users" ? "إدارة موظفي الإدخال" : "تقارير العمل الميداني"}</h1>
          </div>
          <button className="primary-btn" onClick={openNewReport}>
            <FilePlus2 size={18} />
            تقرير جديد
          </button>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}
        {draft && !editingReport && <div className="notice draft-banner"><span>لديك مسودة محفوظة: {draft.customerName || "تقرير جديد"}</span><button className="ghost-btn" onClick={() => { setEditorMessage(""); setEditingReport(draft); }}>متابعة المسودة</button><button className="ghost-btn" onClick={() => { if (window.confirm("حذف المسودة نهائيًا؟")) { localStorage.removeItem(`alnaseem_draft_${currentUser.uid}`); setDraft(null); } }}>حذف المسودة</button></div>}
        {activeView === "archive" && currentUser.role === "admin" && <section className="panel"><h2>التقارير المحذوفة</h2>{allReports.filter((r) => r.archived).length === 0 && <p>لا توجد تقارير محذوفة.</p>}{allReports.filter((r) => r.archived).map((r) => <div className="archive-row" key={r.id}><strong>{r.reportNumber}</strong><span>{r.customerName}</span><button className="ghost-btn" onClick={() => showHistory(r)}><History size={18} />السجل</button><button className="ghost-btn" onClick={() => restoreReport(r)}><RotateCcw size={18} />استرجاع</button></div>)}</section>}

        {activeView === "dashboard" && currentUser.role === "admin" && (
          <Dashboard dashboard={dashboard} reports={reports} />
        )}

        {activeView === "users" && currentUser.role === "admin" && (
          <section className="panel-grid two">
            <form className="panel form-panel" onSubmit={createEmployee}>
              <div className="panel-title">
                <UserPlus size={19} />
                <h2>إنشاء حساب موظف</h2>
              </div>
              <label>
                اسم الموظف
                <input required value={employeeForm.displayName} onChange={(event) => setEmployeeForm({ ...employeeForm, displayName: event.target.value })} />
              </label>
              <label>
                البريد الإلكتروني
                <input required type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} />
              </label>
              <label>
                كلمة المرور
                <input required type="password" value={employeeForm.password} onChange={(event) => setEmployeeForm({ ...employeeForm, password: event.target.value })} />
              </label>
              <button className="primary-btn" type="submit">
                <UserPlus size={18} />
                إنشاء الموظف
              </button>
            </form>
            <section className="panel">
              <div className="panel-title">
                <Users size={19} />
                <h2>الحسابات</h2>
              </div>
              <div className="stack-list">
                {users.length === 0 && <p className="empty-text">لا توجد حسابات محفوظة بعد.</p>}
                {users.map((user) => (
                  <div className="user-row" key={user.uid || user.email}>
                    <div>
                      <strong>{user.displayName}</strong>
                      <span>{user.email}</span>
                    </div>
                    <b>{user.role === "admin" ? "مدير" : "موظف"}</b>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeView === "reports" && (
          <>
            <div className="report-summary"><span><ClipboardList size={18} /> <strong>{reports.length}</strong> تقرير</span><span><CalendarDays size={18} /> اليوم <strong>{dashboard.todayCount}</strong></span><span><CheckCircle2 size={18} /> هذا الشهر <strong>{dashboard.monthCount}</strong></span></div>
            <section className="filters panel">
              <label className="search-box">
                <Search size={18} />
                <input aria-label="البحث في التقارير" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن عميل أو رقم تقرير..." />
              </label>
              <select aria-label="نوع العمل" value={workFilter} onChange={(event) => setWorkFilter(event.target.value as "all" | WorkType)}>
                <option value="all">كل أنواع العمل</option>
                <option value="installation">تركيب</option>
                <option value="maintenance">صيانة</option>
                <option value="inspection">كشف</option>
              </select>
              <label className="date-filter">من<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label className="date-filter">إلى<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
            </section>
            <div className="export-toolbar">
              <div className="results-count">{filteredReports.length} تقرير مطابق</div>
              {currentUser.role === "admin" && <select aria-label="تصفية حسب الموظف" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
                <option value="">جميع الموظفين</option>
                {[...new Map(reports.map((r) => [r.createdByUid, r.createdByName])).entries()].map(([uid, name]) => <option key={uid} value={uid}>{name}</option>)}
              </select>}
              <button className="ghost-btn" disabled={exporting || !filteredReports.length} onClick={exportExcel}><FileSpreadsheet size={18} />{exporting ? "جارٍ التصدير..." : "تصدير Excel"}</button>
            </div>
            <ReportsTable reports={filteredReports} onHistory={showHistory} onEdit={(report) => { if (draft && draft.id !== report.id && !window.confirm("سيستبدل هذا التقرير المسودة الحالية. متابعة؟")) return; setEditorMessage(""); setEditingReport(report); }} onPreview={setPreviewReport} onDelete={removeReport} />
          </>
        )}
      </section>

      {editingReport && (
        <ReportEditor
          report={editingReport}
          setReport={setEditingReport}
          updateReport={updateReport}
          updatePart={updatePart}
          autofill={autofill}
          saving={saving}
          message={editorMessage || draftStatus}
          onSubmit={submitReport}
          onClose={() => { if (!saving) { try { localStorage.setItem(`alnaseem_draft_${currentUser.uid}`, JSON.stringify(editingReport)); setDraft(editingReport); setEditingReport(null); } catch { setEditorMessage("تعذر حفظ المسودة. أبق التقرير مفتوحًا أو احفظه."); } } }}
        />
      )}

      {previewReport && <PrintPreview report={previewReport} onClose={() => setPreviewReport(null)} />}
      {history && <div className="modal-backdrop"><section className="history-panel" role="dialog" aria-modal="true" aria-label="سجل التعديلات"><button className="ghost-btn" onClick={() => setHistory(null)}>إغلاق</button><h2>سجل التعديلات</h2>{!history.length && <p>لا يوجد سجل للتعديلات السابقة قبل تفعيل هذه الخاصية.</p>}{history.map((entry, index) => <div className="history-entry" key={index}><strong>{{ create: "إنشاء", save: "تعديل", archive: "حذف", restore: "استرجاع" }[entry.action] || entry.action}</strong><span>{entry.actorName} · {new Date(entry.at).toLocaleString("ar")}</span><button className="ghost-btn" onClick={() => setPreviewReport(entry.snapshot)}>عرض نسخة التقرير</button></div>)}</section></div>}
    </main>
  );
}

type DashboardSummary = {
  todayCount: number;
  monthCount: number;
  total: number;
  totalValue: number;
  byEmployee: Array<[string, number]>;
  byType: Map<WorkType, number>;
};

function Dashboard({ dashboard, reports }: { dashboard: DashboardSummary; reports: FieldReport[] }) {
  return (
    <section className="dashboard">
      <div className="metric-card">
        <CalendarDays size={22} />
        <span>تقارير اليوم</span>
        <strong>{dashboard.todayCount}</strong>
      </div>
      <div className="metric-card">
        <ClipboardList size={22} />
        <span>تقارير الشهر</span>
        <strong>{dashboard.monthCount}</strong>
      </div>
      <div className="metric-card">
        <CheckCircle2 size={22} />
        <span>إجمالي التقارير</span>
        <strong>{dashboard.total}</strong>
      </div>
      <div className="metric-card">
        <Archive size={22} />
        <span>القيمة التقريبية</span>
        <strong>{dashboard.totalValue.toLocaleString()} ₪</strong>
      </div>
      <section className="panel chart-panel">
        <h2>إنجازات الموظفين</h2>
        {dashboard.byEmployee.length === 0 && <p className="empty-text">لا توجد تقارير بعد.</p>}
        {dashboard.byEmployee.map(([name, count]: [string, number]) => (
          <div className="bar-row" key={name}>
            <span>{name}</span>
            <div><i style={{ width: `${Math.max(12, (count / Math.max(1, dashboard.total)) * 100)}%` }} /></div>
            <b>{count}</b>
          </div>
        ))}
      </section>
      <section className="panel chart-panel">
        <h2>توزيع أنواع العمل</h2>
        {(Object.keys(workTypeLabels) as WorkType[]).map((type) => (
          <div className="type-row" key={type}>
            <span>{workTypeLabels[type]}</span>
            <strong>{dashboard.byType.get(type) || 0}</strong>
          </div>
        ))}
      </section>
      <section className="panel recent-panel">
        <h2>آخر التقارير</h2>
        {reports.slice(0, 6).map((report) => (
          <div className="recent-row" key={report.id || report.reportNumber}>
            <span>{report.reportNumber}</span>
            <strong>{report.customerName || "بدون اسم"}</strong>
            <em>{report.createdByName}</em>
          </div>
        ))}
      </section>
    </section>
  );
}

function ReportsTable({
  reports,
  onEdit,
  onPreview,
  onDelete
  ,onHistory
}: {
  reports: FieldReport[];
  onEdit: (report: FieldReport) => void;
  onPreview: (report: FieldReport) => void;
  onDelete: (report: FieldReport) => void;
  onHistory: (report: FieldReport) => void;
}) {
  return (
    <section className="panel reports-panel">
      <div className="table-head">
        <span>رقم التقرير</span>
        <span>العميل</span>
        <span>نوع العمل</span>
        <span>التاريخ</span>
        <span>الموظف</span>
        <span>الإجراءات</span>
      </div>
      {reports.length === 0 && <div className="empty-state"><ClipboardList size={36} /><h3>لا توجد تقارير مطابقة</h3><p>لم يتم العثور على تقارير ضمن هذه النتائج.</p></div>}
      {reports.map((report) => (
        <div className="report-row" key={report.id || report.reportNumber}>
          <strong>{report.reportNumber}</strong>
          <span>{report.customerName || "غير محدد"}</span>
          <b className={`work-badge ${report.workType}`}>{workTypeLabels[report.workType]}</b>
          <span>{report.reportDate}</span>
          <span>{report.createdByName}</span>
          <div className="row-actions">
            <button title="سجل التعديلات" aria-label="سجل التعديلات" onClick={() => onHistory(report)}><History size={17} /></button>
            <button title="عرض" onClick={() => onPreview(report)}><Eye size={17} /></button>
            <button title="تعديل" onClick={() => onEdit(report)}><Pencil size={17} /></button>
            <button title="طباعة" onClick={() => onPreview(report)}><Printer size={17} /></button>
            <button title="حذف" onClick={() => onDelete(report)}><Trash2 size={17} /></button>
          </div>
        </div>
      ))}
    </section>
  );
}

function ReportEditor({
  report,
  setReport,
  updateReport,
  updatePart,
  autofill,
  saving,
  message,
  onSubmit,
  onClose
}: {
  report: FieldReport;
  setReport: Dispatch<SetStateAction<FieldReport | null>>;
  updateReport: <K extends keyof FieldReport>(key: K, value: FieldReport[K]) => void;
  updatePart: (id: string, changes: Partial<ReportPart>) => void;
  autofill: ReturnType<typeof buildAutofillOptions>;
  saving: boolean;
  message: string;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const customerOptions = autofill.customers.filter((item) => item.name.includes(report.customerName)).slice(0, 6);
  const total = reportTotal(report);
  const [customerFocused, setCustomerFocused] = useState(false);

  function chooseCustomer(name: string) {
    const customer = autofill.customers.find((item) => item.name === name);
    if (!customer) return;
    setReport((current) =>
      current
        ? {
            ...current,
            customerName: customer.name,
            customerPhone: customer.phone,
            area: customer.area,
            projectName: customer.projectName,
            previousSupply: customer.previousSupply
          }
        : current
    );
  }

  return (
    <div className="modal-backdrop">
      <form className="report-editor" role="dialog" aria-modal="true" aria-label="تحرير التقرير" onSubmit={onSubmit}>
        <header className="editor-header">
          <div>
            <p>رقم التقرير</p>
            <h2>{report.reportNumber}</h2>
          </div>
          <div className="editor-actions">
            <button className="ghost-btn" type="button" onClick={onClose}>إغلاق</button>
            <button className="primary-btn" type="submit" disabled={saving}>
              <Save size={18} />
              {saving ? "جاري الحفظ..." : "حفظ التقرير"}
            </button>
          </div>
        </header>
        {message && <div className="editor-status" role="status">{message}</div>}

        <section className="editor-section">
          <h3>بيانات العميل والعمل</h3>
          <div className="form-grid">
            <label className="has-suggestions">
              اسم العميل
              <input required autoComplete="off" onFocus={() => setCustomerFocused(true)} onBlur={() => setCustomerFocused(false)} value={report.customerName} onChange={(event) => updateReport("customerName", event.target.value)} />
              {customerFocused && report.customerName && customerOptions.length > 0 && (
                <div className="suggestions">
                  {customerOptions.map((customer) => (
                    <button type="button" key={customer.name} onMouseDown={(event) => event.preventDefault()} onClick={() => { chooseCustomer(customer.name); setCustomerFocused(false); }}>
                      {customer.name} - {customer.phone}
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label>
              الجوال
              <input type="tel" dir="ltr" value={report.customerPhone} onChange={(event) => updateReport("customerPhone", event.target.value)} />
            </label>
            <label>
              رقم الطلب
              <input value={report.orderNumber} onChange={(event) => updateReport("orderNumber", event.target.value)} />
            </label>
            <label>
              التاريخ
              <input type="date" value={report.reportDate} onChange={(event) => updateReport("reportDate", event.target.value)} />
            </label>
          </div>
          <div className="segmented">
            {(Object.keys(workTypeLabels) as WorkType[]).map((type) => (
              <button className={report.workType === type ? "selected" : ""} type="button" key={type} onClick={() => updateReport("workType", type)}>
                {workTypeLabels[type]}
              </button>
            ))}
          </div>
          <label>
            وصف العمل / المشكلة
            <textarea value={report.problemDescription} onChange={(event) => updateReport("problemDescription", event.target.value)} rows={4} />
          </label>
        </section>

        <section className="editor-section">
          <h3>تفاصيل موقع العمل</h3>
          <div className="form-grid">
            <label>
              المنطقة
              <input list="areas" value={report.area} onChange={(event) => updateReport("area", event.target.value)} />
              <datalist id="areas">{autofill.areas.map((area) => <option value={area} key={area} />)}</datalist>
            </label>
            <label>
              اسم المشروع
              <input value={report.projectName} onChange={(event) => updateReport("projectName", event.target.value)} />
            </label>
            <label>
              توريد سابق من الشركة
              <select value={report.previousSupply} onChange={(event) => updateReport("previousSupply", event.target.value as WarrantyStatus)}>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            </label>
            <label>
              رقم السيارة
              <input list="cars" value={report.carNumber} onChange={(event) => updateReport("carNumber", event.target.value)} />
              <datalist id="cars">{autofill.carNumbers.map((car) => <option value={car} key={car} />)}</datalist>
            </label>
          </div>
          <label>
            في حال لا، اذكر التفاصيل
            <textarea value={report.previousSupplyDetails} onChange={(event) => updateReport("previousSupplyDetails", event.target.value)} rows={3} />
          </label>
        </section>

        <section className="editor-section">
          <h3>الطاقم الفني</h3>
          <div className="repeat-grid">
            {report.technicians.map((name, index) => (
              <input
                key={index}
                aria-label={`الفني ${index + 1}`}
                list="technicians"
                value={name}
                placeholder={`الفني ${index + 1}`}
                onChange={(event) => {
                  const technicians = [...report.technicians];
                  technicians[index] = event.target.value;
                  updateReport("technicians", technicians);
                }}
              />
            ))}
            <datalist id="technicians">{autofill.technicians.map((name) => <option value={name} key={name} />)}</datalist>
            <button className="add-line-btn" type="button" onClick={() => updateReport("technicians", [...report.technicians, ""])}>
              <Plus size={16} />
              إضافة فني
            </button>
          </div>
        </section>

        <section className="editor-section">
          <h3>القطع المستخدمة</h3>
          <div className="parts-table">
            {report.parts.map((part) => (
              <div className="part-row" key={part.id}>
                <label>الصنف<input
                  list="parts"
                  placeholder="الصنف"
                  value={part.item}
                  onChange={(event) => {
                    const matched = autofill.parts.find((item) => item.item === event.target.value);
                    updatePart(part.id, { item: event.target.value, price: matched?.price ?? part.price });
                  }}
                /></label>
                <label>العدد<input type="number" min="0" step="any" placeholder="العدد" value={part.quantity} onChange={(event) => updatePart(part.id, { quantity: Number(event.target.value) })} /></label>
                <label>السعر<input type="number" min="0" step="0.01" placeholder="السعر" value={part.price} onChange={(event) => updatePart(part.id, { price: Number(event.target.value) })} /></label>
                <strong>{(Number(part.quantity || 0) * Number(part.price || 0)).toLocaleString()} ₪</strong>
                <button type="button" className="icon-btn" title="حذف القطعة" aria-label="حذف القطعة" onClick={() => updateReport("parts", report.parts.filter((item) => item.id !== part.id))}><Trash2 size={18} /></button>
              </div>
            ))}
            <datalist id="parts">{autofill.parts.map((part) => <option value={part.item} key={part.item} />)}</datalist>
          </div>
          <button className="add-line-btn" type="button" onClick={() => updateReport("parts", [...report.parts, emptyPart()])}>
            <Plus size={16} />
            إضافة قطعة
          </button>
        </section>

        <section className="editor-section">
          <h3>المالية والكفالة</h3>
          <div className="form-grid">
            <label>
              أجور الصيانة
              <input type="number" min="0" value={report.serviceFee} onChange={(event) => updateReport("serviceFee", Number(event.target.value))} />
            </label>
            <label>
              ضمن الكفالة
              <select value={report.warranty} onChange={(event) => updateReport("warranty", event.target.value as WarrantyStatus)}>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            </label>
            <label>
              طريقة الدفع
              <select value={report.paymentStatus} onChange={(event) => updateReport("paymentStatus", event.target.value as FieldReport["paymentStatus"])}>
                <option value="cash">نقدًا</option>
                <option value="on_account">على الذمة</option>
              </select>
            </label>
            <div className="total-box">المجموع النهائي: <strong>{total.toLocaleString()} ₪</strong></div>
          </div>
        </section>

        <section className="editor-section">
          <h3>التوصيات والتواقيع</h3>
          <label>
            التوصيات
            <textarea rows={3} value={report.recommendations} onChange={(event) => updateReport("recommendations", event.target.value)} />
          </label>
          <div className="form-grid">
            <label>اسم وتوقيع المستلم<input value={report.receiverSignature} onChange={(event) => updateReport("receiverSignature", event.target.value)} /></label>
            <label>اسم وتوقيع الفني<input value={report.technicianSignature} onChange={(event) => updateReport("technicianSignature", event.target.value)} /></label>
            <label>اسم وتوقيع المسؤول<input value={report.managerSignature} onChange={(event) => updateReport("managerSignature", event.target.value)} /></label>
            <label>وقت البداية<input type="time" value={report.startTime} onChange={(event) => updateReport("startTime", event.target.value)} /></label>
            <label>وقت النهاية<input type="time" value={report.endTime} onChange={(event) => updateReport("endTime", event.target.value)} /></label>
          </div>
        </section>
      </form>
    </div>
  );
}

function PrintPreview({ report, onClose }: { report: FieldReport; onClose: () => void }) {
  return (
    <div className="modal-backdrop print-backdrop">
      <section className="print-shell">
        <div className="print-toolbar">
          <button className="ghost-btn" onClick={onClose}>إغلاق</button>
          <button className="primary-btn" onClick={() => window.print()}>
            <Printer size={18} />
            طباعة
          </button>
        </div>
        <article className="print-page">
          <header>
            <Image src="/alnaseem-logo.png" alt="شعار شركة النسيم إخوان" width={92} height={92} />
            <div>
              <h1>تقرير عمل ميداني</h1>
              <p>رقم التقرير: {report.reportNumber}</p>
            </div>
          </header>
          <div className="print-grid">
            <span>اسم الزبون: <b>{report.customerName}</b></span>
            <span>الجوال: <b>{report.customerPhone}</b></span>
            <span>رقم الطلب: <b>{report.orderNumber}</b></span>
            <span>نوع العمل: <b>{workTypeLabels[report.workType]}</b></span>
            <span>المنطقة: <b>{report.area}</b></span>
            <span>اسم المشروع: <b>{report.projectName}</b></span>
          </div>
          <PrintBlock title="وصف العمل / المشكلة" value={report.problemDescription} />
          <PrintBlock title="الطاقم الفني" value={report.technicians.filter(Boolean).join("، ")} />
          <section className="print-block">
            <h2>القطع المستخدمة</h2>
            <table>
              <thead><tr><th>الصنف</th><th>العدد</th><th>السعر</th><th>المجموع</th></tr></thead>
              <tbody>
                {report.parts.map((part) => (
                  <tr key={part.id}><td>{part.item}</td><td>{part.quantity}</td><td>{part.price}</td><td>{Number(part.quantity || 0) * Number(part.price || 0)}</td></tr>
                ))}
              </tbody>
            </table>
            <strong>المجموع النهائي: {reportTotal(report).toLocaleString()} ₪</strong>
          </section>
          <PrintBlock title="التوصيات" value={report.recommendations} />
          <div className="print-grid">
            <span>ضمن الكفالة: <b>{report.warranty === "yes" ? "نعم" : "لا"}</b></span>
            <span>الدفع: <b>{report.paymentStatus === "cash" ? "نقدًا" : "على الذمة"}</b></span>
            <span>رقم السيارة: <b>{report.carNumber}</b></span>
            <span>التاريخ: <b>{report.reportDate}</b></span>
            <span>وقت البداية: <b>{report.startTime}</b></span>
            <span>وقت النهاية: <b>{report.endTime}</b></span>
          </div>
          <footer>
            <span>اسم وتوقيع المستلم: {report.receiverSignature}</span>
            <span>اسم وتوقيع الفني: {report.technicianSignature}</span>
            <span>اسم وتوقيع المسؤول: {report.managerSignature}</span>
          </footer>
        </article>
      </section>
    </div>
  );
}

function PrintBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="print-block">
      <h2>{title}</h2>
      <p>{value || " "}</p>
    </section>
  );
}
