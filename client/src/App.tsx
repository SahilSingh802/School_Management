import Login from "./Login";
import type { LoginUser } from "./Login";
import api from "./services/api";
import { useState, useEffect } from "react";
import Students from "./Students";
import ManagementPages from "./ManagementPages";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  CalendarCheck, ClipboardList, Wallet,
  Plus, ArrowUpRight, MoreHorizontal, Menu, X, LogOut
} from "lucide-react";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { name: "Students", icon: Users, roles: ["ADMIN", "TEACHER", "GUARDIAN"] },
  { name: "Teachers", icon: GraduationCap, roles: ["ADMIN"] },
  { name: "Classes & Subjects", icon: BookOpen, roles: ["ADMIN"] },
  { name: "Attendance", icon: CalendarCheck, roles: ["ADMIN", "TEACHER", "GUARDIAN"] },
  { name: "Examinations", icon: ClipboardList, roles: ["ADMIN", "TEACHER", "GUARDIAN"] },
  { name: "Results", icon: ClipboardList, roles: ["ADMIN", "TEACHER", "GUARDIAN"] },
  { name: "Fee Management", icon: Wallet, roles: ["ADMIN", "GUARDIAN"] },
];

// const students = [
//   { name: "Aarav Sharma", id: "STU-2026-001", className: "Class 10-A", status: "Active", initials: "AS", color: "bg-indigo-100 text-indigo-700" },
//   { name: "Ananya Verma", id: "STU-2026-002", className: "Class 9-B", status: "Active", initials: "AV", color: "bg-pink-100 text-pink-700" },
//   { name: "Arjun Singh", id: "STU-2026-003", className: "Class 12-A", status: "Pending", initials: "AS", color: "bg-amber-100 text-amber-700" },
//   { name: "Meera Kapoor", id: "STU-2026-004", className: "Class 8-C", status: "Active", initials: "MK", color: "bg-emerald-100 text-emerald-700" },
// ];



function App() {
  const [currentYear] = useState(() => new Date().getFullYear());
  const [active, setActive] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("edu_user") || "null");
      return savedUser?.role === "ADMIN" ? "Dashboard" : "Students";
    } catch {
      return "Dashboard";
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [dashboardError, setDashboardError] = useState("");

  const [token, setToken] = useState(
    () => localStorage.getItem("edu_token")
  );

  const [currentUser, setCurrentUser] = useState<LoginUser | null>(() => {
    try {
      const saved = localStorage.getItem("edu_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem("edu_user");
      return null;
    }
  });

  const handleLogin = (newToken: string, user: LoginUser) => {
    localStorage.setItem("edu_token", newToken);
    localStorage.setItem("edu_user", JSON.stringify(user));

    setToken(newToken);
    setCurrentUser(user);
    setActive(user.role === "ADMIN" ? "Dashboard" : "Students");
  };

  const handleLogout = () => {
    localStorage.removeItem("edu_token");
    localStorage.removeItem("edu_user");

    setToken(null);
    setCurrentUser(null);
    setActive("Dashboard");
  };

  useEffect(() => {
    const handleUnauthorized = () => handleLogout();
    window.addEventListener("edu:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("edu:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      if (!token || currentUser?.role !== "ADMIN") {
        setDashboardLoading(false);
        return;
      }

      setDashboardLoading(true);
      try {
        const [statsResponse, studentsResponse] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/academic/students"),
        ]);
        setDashboardData(statsResponse.data.data);
        setRecentStudents(studentsResponse.data.data.slice(0, 5));
        setDashboardError("");
      } catch (error) {
        setDashboardError(
          (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          "Unable to load current school data."
        );
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboardStats();
  }, [token, currentUser?.role]);

  const stats = [
    {
      title: "Total Students",
      value: dashboardLoading ? "..." : dashboardData?.totalStudents ?? 0,
      description: "Total registered students",
      icon: Users,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Total Teachers",
      value: dashboardLoading ? "..." : dashboardData?.totalTeachers ?? 0,
      description: "Total registered teachers",
      icon: GraduationCap,
      color: "bg-violet-50 text-violet-600",
    },
    {
      title: "Attendance Rate",
      value: dashboardLoading
        ? "..."
        : `${dashboardData?.attendanceRate ?? 0}%`,
      description: "Today's attendance",
      icon: CalendarCheck,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Fee Collection",
      value: dashboardLoading
        ? "..."
        : `₹${(dashboardData?.totalCollected ?? 0).toLocaleString("en-IN")}`,
      description: "Total fees collected",
      icon: Wallet,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  const attendance = dashboardData?.weeklyAttendance ?? [];

  const totalAttended = attendance.reduce(
    (sum: number, day: any) => sum + day.attended,
    0
  );

  const totalAttendanceCount = attendance.reduce(
    (sum: number, day: any) => sum + day.total,
    0
  );

  const averageAttendance = totalAttendanceCount > 0
    ? Number(
      ((totalAttended / totalAttendanceCount) * 100).toFixed(1)
    )
    : 0;

  if (!token || !currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  if (!["ADMIN", "TEACHER", "GUARDIAN"].includes(currentUser.role)) {
    return <Login onLogin={handleLogin} />;
  }

  const visibleNavigation = navigation.filter((item) => item.roles.includes(currentUser.role));

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-6 py-7">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/20">
          <GraduationCap size={25} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">EduSphere</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">School Management</p>
        </div>
      </div>

      {dashboardError && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {dashboardError}
        </div>
      )}

      <div className="px-4 pt-5">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[1.8px] text-slate-500">
          Main Menu
        </p>

        <div className="space-y-1">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const selected = active === item.name;

            return (
              <button
                key={item.name}
                onClick={() => {
                  setActive(item.name);
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${selected
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
              >
                <Icon size={18} />
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto p-4">
        <p className="px-3 py-4 text-xs text-slate-500">Signed in as {currentUser.role.toLowerCase()}</p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-slate-800">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-[#151B35] lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-[#151B35]">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-5 text-white"
              aria-label="Close sidebar"
            >
              <X size={22} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="min-h-screen lg:ml-[260px]">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="text-xs text-slate-400">Pages / {active}</p>
              <h2 className="text-lg font-bold text-slate-800">{active}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3 md:pl-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700">
                {currentUser.name?.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {currentUser.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        {active === "Students" ? (
          <div className="mx-auto max-w-[1600px] p-5 md:p-8">
            <Students canManage={currentUser.role === "ADMIN"} />
          </div>
        ) : active === "Dashboard" && currentUser.role === "ADMIN" ? (
          <div className="mx-auto max-w-[1600px] p-5 md:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-[28px]">
                  Good morning, {currentUser.name}! <span>👋</span>
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Here's what's happening at your school today.
                </p>
              </div>

              <button
                onClick={() => setActive("Students")}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <Plus size={17} />
                Add New Student
              </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div key={stat.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}>
                        <Icon size={21} />
                      </div>
                      {stat.title === "Total Students" && (
                        <button
                          onClick={() => setActive("Students")}
                          className="rounded-lg p-1 text-slate-300 hover:bg-slate-50"
                          aria-label="View students"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      )}
                    </div>

                    <p className="mt-5 text-sm font-medium text-slate-500">{stat.title}</p>
                    <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                      <h3 className="text-[27px] font-extrabold tracking-tight text-slate-900">{stat.value}</h3>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{stat.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Charts */}
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm xl:col-span-2 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800">Attendance Overview</h3>
                    <p className="mt-1 text-xs text-slate-400">Weekly attendance performance</p>
                  </div>
                  <span className="text-xs text-slate-400">Last 7 days</span>
                </div>

                <div className="mt-8 flex h-[210px] items-end justify-around gap-3 border-b border-l border-slate-100 px-3 pb-0">
                  {attendance.map((day: any) => (
                    <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div className="flex h-full w-full items-end justify-center">
                        <div
                          title={`${day.attendanceRate}%`}
                          style={{ height: `${day.attendanceRate}%` }}
                          className="w-full max-w-12 rounded-t-lg bg-indigo-500 transition-all hover:bg-indigo-700"
                        />
                      </div>
                      <span className="mb-2 text-[10px] text-slate-400">
                        {day.day}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Average attendance</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-800">{averageAttendance}%</p>
                  </div>
                  <span className="text-xs text-slate-400">Based on recorded attendance</span>
                </div>
              </section>

              {/* Fee Summary */}
              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">Fee Collection</h3>
                    <p className="mt-1 text-xs text-slate-400">All recorded fee invoices</p>
                  </div>
                  <Wallet className="text-indigo-500" size={21} />
                </div>

                <div className="mt-7">
                  <p className="text-xs text-slate-400">Total collected</p>
                  <h3 className="mt-1 text-3xl font-extrabold text-slate-900">
                    ₹{(dashboardData?.totalCollected ?? 0).toLocaleString("en-IN")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {dashboardData?.totalFees > 0
                      ? `${Math.round((dashboardData.totalCollected / dashboardData.totalFees) * 100)}% of invoiced fees collected`
                      : "No fee invoices recorded"}
                  </p>
                </div>

                <div className="mt-7 space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">Collected</span>
                      {dashboardData?.totalFees > 0
                        ? Math.round((dashboardData.totalCollected / dashboardData.totalFees) * 100)
                        : 0}%
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{
                          width: `${dashboardData?.totalFees > 0
                            ? (dashboardData.totalCollected / dashboardData.totalFees) * 100
                            : 0
                            }%`
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">Outstanding</span>
                      <span className="font-bold text-slate-800">
                        {dashboardData?.totalFees > 0
                          ? Math.round((dashboardData.outstanding / dashboardData.totalFees) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{
                          width: `${dashboardData?.totalFees > 0
                            ? (dashboardData.outstanding / dashboardData.totalFees) * 100
                            : 0
                            }%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActive("Fee Management")}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50"
                >
                  View Fee Details <ArrowUpRight size={15} />
                </button>
              </section>
            </div>

            {/* Recent Students */}
            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-6">
                <div>
                  <h3 className="font-bold text-slate-800">Recent Students</h3>
                  <p className="mt-1 text-xs text-slate-400">Latest student registrations</p>
                </div>
                <button
                  onClick={() => setActive("Students")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  View all students →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Student</th>
                      <th className="px-6 py-4 font-semibold">Student ID</th>
                      <th className="px-6 py-4 font-semibold">Class</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">

                    {recentStudents.map((student) => (
                      <tr key={student._id} className="transition hover:bg-slate-50/80">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">
                              {student.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-700">
                              {student.name}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-500">
                          {student.admissionNo}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-500">
                          {student.classId?.name} - {student.classId?.section}
                        </td>

                        <td className="px-6 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600">
                            Registered
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => setActive("Students")}
                            aria-label={`View ${student.name}`}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                          >
                            <ArrowUpRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {recentStudents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                          No students found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bottom Activity */}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><Users size={20} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Classes</p>
                  <p className="mt-1 text-[11px] text-slate-400">{dashboardData?.totalClasses ?? 0} classes configured</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Wallet size={20} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Outstanding Fees</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    ₹{(dashboardData?.outstanding ?? 0).toLocaleString("en-IN")} pending
                  </p>
                </div>
              </div>
            </div>

            <footer className="py-8 text-center text-[11px] text-slate-400">
              © {currentYear} EduSphere School Management System.
            </footer>
          </div>
        ) : (
          <div className="mx-auto max-w-[1600px] p-5 md:p-8">
            <ManagementPages page={active as "Teachers" | "Classes & Subjects" | "Attendance" | "Examinations" | "Results" | "Fee Management"} role={currentUser.role} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
