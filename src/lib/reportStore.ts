"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
  ,runTransaction
} from "firebase/firestore";
import { auth, db, firebaseConfig, isFirebaseConfigured } from "./firebase";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, setPersistence, signOut } from "firebase/auth";
import type { AppUser, AutofillOptions, FieldReport, ReportPart } from "./types";

const storageKey = "alnaseem_reports_demo";
const usersKey = "alnaseem_users_demo";

export function makeReportNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = crypto.randomUUID();
  return `FR-${y}${m}${d}-${suffix}`;
}

export function emptyPart(): ReportPart {
  return {
    id: crypto.randomUUID(),
    item: "",
    quantity: 1,
    price: 0
  };
}

export function readDemoReports(): FieldReport[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(storageKey) || "[]");
}

export function writeDemoReports(reports: FieldReport[]) {
  localStorage.setItem(storageKey, JSON.stringify(reports));
}

export function readDemoUsers(): AppUser[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem(usersKey) || "[]");
}

export function writeDemoUsers(users: AppUser[]) {
  localStorage.setItem(usersKey, JSON.stringify(users));
}

export function listenToReports(
  user: AppUser,
  callback: (reports: FieldReport[]) => void,
  onError: (error: Error) => void
) {
  if (!isFirebaseConfigured || !db) {
    const reports = readDemoReports();
    callback(user.role === "admin" ? reports : reports.filter((item) => item.createdByUid === user.uid));
    return () => {};
  }

  const base = collection(db, "reports");
  const reportQuery =
    user.role === "admin"
      ? query(base)
      : query(
          base,
          where("createdByUid", "==", user.uid)
        );

  return onSnapshot(
    reportQuery,
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as FieldReport).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    onError
  );
}

export async function saveReport(report: FieldReport, user: AppUser) {
  if (!isFirebaseConfigured || !db) {
    const reports = readDemoReports();
    const existingIndex = reports.findIndex((item) => item.id === report.id);
    const previous = reports[existingIndex];
    if (!user.active || (previous && user.role !== "admin" && previous.createdByUid !== user.uid)) throw new Error("ليس لديك صلاحية.");
    if (previous?.archived) throw new Error("استرجع التقرير قبل تعديله.");
    if (previous && (previous.revision || 0) !== (report.revision || 0)) throw new Error("تم تعديل التقرير من جلسة أخرى.");
    const nextReport = { ...report, createdByUid: previous?.createdByUid || user.uid, createdByName: previous?.createdByName || user.displayName, id: report.id || crypto.randomUUID(), updatedAt: new Date().toISOString(), revision: (previous?.revision || 0) + 1 };
    if (existingIndex >= 0) reports[existingIndex] = nextReport;
    else reports.unshift(nextReport);
    writeDemoReports(reports);
    recordDemoHistory(nextReport, user, previous ? "save" : "create");
    return nextReport;
  }

  return mutateReport("save", report.id || crypto.randomUUID(), report);
}

export async function archiveReport(reportId: string, user: AppUser, restore = false) {
  if (!isFirebaseConfigured || !db) {
    const reports = readDemoReports();
    const report = reports.find((r) => r.id === reportId);
    if (!report || (user.role !== "admin" && (restore || report.createdByUid !== user.uid))) throw new Error("ليس لديك صلاحية.");
    const next = { ...report, archived: !restore, updatedAt: new Date().toISOString(), revision: (report.revision || 0) + 1 };
    writeDemoReports(reports.map((r) => r.id === reportId ? next : r));
    recordDemoHistory(next, user, restore ? "restore" : "archive");
    return;
  }
  await mutateReport(restore ? "restore" : "archive", reportId);
}

async function mutateReport(action: "save" | "archive" | "restore", id: string, input?: FieldReport): Promise<FieldReport> {
  if (!db || !auth?.currentUser) throw new Error("يلزم تسجيل الدخول.");
  const database = db;
  const actor = auth.currentUser;
  const ref = doc(database, "reports", id);
  return runTransaction(database, async (tx) => {
    const profile = (await tx.get(doc(database, "users", actor.uid))).data();
    const previous = (await tx.get(ref)).data() as FieldReport | undefined;
    if (!profile || profile.active === false || (previous && profile.role !== "admin" && previous.createdByUid !== actor.uid)) throw new Error("ليس لديك صلاحية.");
    if (action === "restore" && profile.role !== "admin") throw new Error("الاسترجاع للمدير فقط.");
    if (!previous && action !== "save") throw new Error("التقرير غير موجود.");
    if (action === "save" && previous?.archived) throw new Error("استرجع التقرير قبل تعديله.");
    if (action === "save" && previous && (input?.revision || 0) !== (previous.revision || 0)) throw new Error("تم تعديل التقرير من جلسة أخرى. افتح أحدث نسخة.");
    const now = new Date().toISOString();
    const next: FieldReport = action === "save" ? { ...input!, id, reportNumber: previous?.reportNumber || `FR-${id}`, createdByUid: previous?.createdByUid || actor.uid, createdByName: previous?.createdByName || profile.displayName, createdAt: previous?.createdAt || now, updatedAt: now, archived: false, revision: (previous?.revision || 0) + 1 } : { ...previous!, archived: action === "archive", updatedAt: now, revision: (previous?.revision || 0) + 1 };
    tx.set(ref, next);
    tx.set(doc(database, "reports", id, "history", String(next.revision)), { action: previous ? action : "create", actorUid: actor.uid, actorName: profile.displayName, at: now, snapshot: next });
    return next;
  });
}

export async function createEmployeeAccount(form: { email: string; password: string; displayName: string }) {
  if (!db || !auth?.currentUser) throw new Error("يلزم تسجيل الدخول.");
  // A separate in-memory Auth instance leaves the manager's session intact.
  const secondary = initializeApp(firebaseConfig, `employee-${crypto.randomUUID()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
    try {
      await setDoc(doc(db, "users", user.uid), { uid: user.uid, email: form.email, displayName: form.displayName, role: "employee", active: true, createdAt: new Date().toISOString(), createdByUid: auth.currentUser.uid });
    } catch (error) { await deleteUser(user); throw error; }
    await signOut(secondaryAuth);
  } finally { await deleteApp(secondary); }
}

export type HistoryEntry = { action: string; actorName: string; at: string; snapshot: FieldReport };
function recordDemoHistory(report: FieldReport, user: AppUser, action: string) {
  const key = `alnaseem_history_${report.id}`;
  const history = JSON.parse(localStorage.getItem(key) || "[]");
  localStorage.setItem(key, JSON.stringify([{ action, actorName: user.displayName, at: new Date().toISOString(), snapshot: report }, ...history]));
}
export async function loadReportHistory(id: string): Promise<HistoryEntry[]> {
  if (!db || !isFirebaseConfigured) return JSON.parse(localStorage.getItem(`alnaseem_history_${id}`) || "[]");
  const snapshot = await getDocs(query(collection(db, "reports", id, "history"), orderBy("at", "desc")));
  return snapshot.docs.map((item) => item.data() as HistoryEntry);
}

export async function loadUsers(): Promise<AppUser[]> {
  if (!isFirebaseConfigured || !db) return readDemoUsers();
  const snapshot = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200)));
  return snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }) as AppUser);
}

export async function saveDemoUser(user: AppUser) {
  const users = readDemoUsers();
  writeDemoUsers([{ ...user, uid: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...users]);
}

export async function deleteReportPermanently(reportId: string) {
  if (!isFirebaseConfigured || !db) {
    writeDemoReports(readDemoReports().filter((report) => report.id !== reportId));
    return;
  }
  await deleteDoc(doc(db, "reports", reportId));
}

export function buildAutofillOptions(reports: FieldReport[]): AutofillOptions {
  const customers = new Map<string, AutofillOptions["customers"][number]>();
  const parts = new Map<string, AutofillOptions["parts"][number]>();
  const technicians = new Set<string>();
  const areas = new Set<string>();
  const carNumbers = new Set<string>();

  reports.forEach((report) => {
    if (report.customerName) {
      customers.set(report.customerName, {
        name: report.customerName,
        phone: report.customerPhone,
        area: report.area,
        projectName: report.projectName,
        previousSupply: report.previousSupply
      });
    }
    if (report.area) areas.add(report.area);
    if (report.carNumber) carNumbers.add(report.carNumber);
    report.technicians.filter(Boolean).forEach((name) => technicians.add(name));
    report.parts.forEach((part) => {
      if (part.item) parts.set(part.item, { item: part.item, price: part.price });
    });
  });

  return {
    customers: Array.from(customers.values()).slice(0, 30),
    parts: Array.from(parts.values()).slice(0, 60),
    technicians: Array.from(technicians).slice(0, 40),
    areas: Array.from(areas).slice(0, 30),
    carNumbers: Array.from(carNumbers).slice(0, 30)
  };
}
