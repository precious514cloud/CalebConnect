// CalebConnect
// Dynamic Academic System Types
//
// This file defines the structure for the dynamic
// student, lecturer, department, course and attendance system.
//
// IMPORTANT:
// Do not put actual students, lecturers or courses here.
// Those will eventually come from the database/backend.


// ----------------------------------------------------
// DEPARTMENTS
// ----------------------------------------------------

export type Department = string;


// ----------------------------------------------------
// LEVELS
// ----------------------------------------------------

export type Level =
  | '100 Level'
  | '200 Level'
  | '300 Level'
  | '400 Level'
  | '500 Level'
  | string;


// ----------------------------------------------------
// USER ROLES
// ----------------------------------------------------

export type UserRole =
  | 'student'
  | 'lecturer'
  | 'course-rep'
  | 'admin';


// ----------------------------------------------------
// STUDENT
// ----------------------------------------------------

export type Student = {
  id: string;

  fullName: string;

  matricNumber: string;

  department: Department;

  level: Level;

  role: 'student';

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// LECTURER
// ----------------------------------------------------

export type Lecturer = {
  id: string;

  fullName: string;

  lecturerId: string;

  departments: Department[];

  role: 'lecturer';

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// COURSE
// ----------------------------------------------------

export type Course = {
  id: string;

  code: string;

  title: string;

  unit: number;

  departmentIds: string[];

  level: Level;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// LECTURER ↔ COURSE
//
// A course can have MORE THAN ONE lecturer.
// A lecturer can teach MORE THAN ONE course.
//
// This is deliberately a separate relationship.
// ----------------------------------------------------

export type LecturerCourse = {
  id: string;

  lecturerId: string;

  courseId: string;

  departmentIds: string[];

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// COURSE REPRESENTATIVE ↔ COURSE
//
// A course representative can also be authorised
// to work with a course.
// ----------------------------------------------------

export type CourseRepresentative = {
  id: string;

  studentId: string;

  courseId: string;

  departmentIds: string[];

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// COURSE UPDATE
//
// Anything posted by an authorised lecturer/course rep
// belongs to a specific course and can target one or
// more departments.
// ----------------------------------------------------

export type CourseUpdate = {
  id: string;

  courseId: string;

  authorId: string;

  authorRole: 'lecturer' | 'course-rep';

  title: string;

  content: string;

  departmentIds: string[];

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// LECTURE MATERIAL
// ----------------------------------------------------

export type LectureMaterial = {
  id: string;

  courseId: string;

  uploadedBy: string;

  uploadedByRole: 'lecturer' | 'course-rep';

  title: string;

  description?: string;

  type: 'pdf' | 'document' | 'video' | 'link' | 'other';

  url: string;

  departmentIds: string[];

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// ATTENDANCE SESSION
//
// One session can contain ONE OR MORE departments.
//
// Example:
//
// CSC101
// Lecturer A
// Computer Science
// Information System & Software Engineering
//
// This allows joint classes.
// ----------------------------------------------------

export type AttendanceSession = {
  id: string;

  courseId: string;

  createdBy: string;

  createdByRole: 'lecturer' | 'course-rep';

  departmentIds: string[];

  level?: Level;

  date: string;

  startTime: string;

  endTime?: string;

  durationMinutes?: number;

  qrCode: string;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// ATTENDANCE RECORD
//
// Each student gets an individual attendance record.
//
// Department is stored on the record so records can
// always be separated by department.
// ----------------------------------------------------

export type AttendanceRecord = {
  id: string;

  sessionId: string;

  studentId: string;

  studentMatricNumber: string;

  studentName: string;

  departmentId: string;

  courseId: string;

  scannedAt: string;

  status: 'present' | 'late' | 'absent';

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// ATTENDANCE DEPARTMENT SUMMARY
//
// Used when displaying attendance records separately
// for each department in a joint class.
// ----------------------------------------------------

export type AttendanceDepartmentSummary = {
  departmentId: string;

  departmentName: string;

  totalStudents: number;

  present: number;

  late: number;

  absent: number;
};


// ----------------------------------------------------
// ACADEMIC PROFILE
//
// Common profile information that can be used by
// both student and lecturer-facing systems.
// ----------------------------------------------------

export type AcademicProfile = {
  userId: string;

  fullName: string;

  role: UserRole;

  departments: Department[];

  level?: Level;

  matricNumber?: string;

  lecturerId?: string;
};


// ----------------------------------------------------
// DEPARTMENT MEMBERSHIP
//
// This is the important connection between a user
// and a department.
//
// A student belongs to one department.
// A lecturer can belong to multiple departments.
// ----------------------------------------------------

export type DepartmentMembership = {
  id: string;

  userId: string;

  departmentId: string;

  role: 'student' | 'lecturer' | 'course-rep';

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// STUDENT ↔ COURSE
//
// We are keeping this relationship separate from the
// course itself.
//
// This allows the system to scale to thousands of
// students without storing students inside the course.
// ----------------------------------------------------

export type StudentCourse = {
  id: string;

  studentId: string;

  courseId: string;

  departmentId: string;

  level: Level;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// DYNAMIC DEPARTMENT
// ----------------------------------------------------

export type AcademicDepartment = {
  id: string;

  name: string;

  code?: string;

  isActive: boolean;

  createdAt: string;

  updatedAt: string;
};


// ----------------------------------------------------
// SYSTEM RELATIONSHIP
//
// This describes the overall academic structure:
//
// Department
//     ↓
// Students
//     ↓
// Courses
//     ↓
// Lecturers
//     ↓
// Course Updates
//     ↓
// Attendance
// ----------------------------------------------------

export type AcademicSystem = {
  departments: AcademicDepartment[];

  students: Student[];

  lecturers: Lecturer[];

  courses: Course[];

  lecturerCourses: LecturerCourse[];

  studentCourses: StudentCourse[];

  courseRepresentatives: CourseRepresentative[];

  courseUpdates: CourseUpdate[];

  lectureMaterials: LectureMaterial[];

  attendanceSessions: AttendanceSession[];

  attendanceRecords: AttendanceRecord[];
};