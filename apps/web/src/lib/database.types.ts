// Types for the current schema (migrations 0001 + 0002).
// Once the Supabase CLI is linked you can regenerate with:
//   supabase gen types typescript --linked > apps/web/src/lib/database.types.ts
// Until then this hand-written version keeps the client fully typed.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type InstitutionType =
  | 'primary_school' | 'secondary_school' | 'combined_school' | 'college'
  | 'polytechnic' | 'university' | 'professional_academy'
  | 'vocational_center' | 'coaching_center' | 'learning_institute';

export type AppRole =
  | 'super_admin' | 'institution_admin' | 'principal' | 'vice_principal'
  | 'rector' | 'provost' | 'dean' | 'head_of_department' | 'academic_officer'
  | 'lecturer' | 'teacher' | 'class_teacher' | 'bursar' | 'accountant'
  | 'librarian' | 'hostel_manager' | 'admissions_officer' | 'parent'
  | 'student' | 'guardian' | 'proprietor' | 'registrar';

export type RecordStatus = 'active' | 'inactive' | 'archived';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export interface Institution {
  id: string;
  slug: string;
  name: string;
  type: InstitutionType;
  logo_url: string | null;
  letterhead_url: string | null;
  stamp_url: string | null;
  signature_url: string | null;
  motto: string | null;
  primary_color: string;
  secondary_color: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  social_links: Json;
  registration_number: string | null;
  tax_id: string | null;
  currency: string;
  timezone: string;
  locale: string;
  grading_system: Json;
  session_structure: Json;
  enabled_modules: Json;
  settings: Json;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campus {
  id: string;
  institution_id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_main: boolean;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  institution_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  institution_id: string | null;
  campus_id: string | null;
  role: AppRole;
  created_at: string;
}

export type StudentStatus =
  | 'prospective' | 'enrolled' | 'graduated' | 'transferred'
  | 'withdrawn' | 'suspended' | 'deferred';
export type StaffStatus = 'active' | 'on_leave' | 'suspended' | 'terminated' | 'retired';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'visiting' | 'volunteer';

export interface Student {
  id: string;
  institution_id: string;
  campus_id: string | null;
  user_id: string | null;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  nationality: string | null;
  state_of_origin: string | null;
  blood_group: string | null;
  genotype: string | null;
  medical_notes: string | null;
  admission_date: string | null;
  current_level: string | null;
  status: StudentStatus;
  meta: Json;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  institution_id: string;
  campus_id: string | null;
  user_id: string | null;
  staff_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  job_title: string | null;
  department: string | null;
  employment_type: EmploymentType;
  qualification: string | null;
  date_joined: string | null;
  status: StaffStatus;
  meta: Json;
  created_at: string;
  updated_at: string;
}

export interface Guardian {
  id: string;
  institution_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  occupation: string | null;
  meta: Json;
  created_at: string;
  updated_at: string;
}

export interface StudentGuardian {
  id: string;
  institution_id: string;
  student_id: string;
  guardian_id: string;
  relationship: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  created_at: string;
}

export type ProgrammeAward =
  | 'certificate' | 'diploma' | 'national_diploma' | 'higher_national_diploma'
  | 'degree' | 'postgraduate' | 'professional';
export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn' | 'repeating';

export interface AcademicSession {
  id: string; institution_id: string; name: string;
  starts_on: string | null; ends_on: string | null; is_current: boolean;
  created_at: string; updated_at: string;
}
export interface AcademicTerm {
  id: string; institution_id: string; session_id: string; name: string;
  sort_order: number; starts_on: string | null; ends_on: string | null;
  is_current: boolean; created_at: string;
}
export interface Class {
  id: string; institution_id: string; name: string; level_order: number;
  next_class_id: string | null; created_at: string; updated_at: string;
}
export interface ClassArm {
  id: string; institution_id: string; class_id: string; name: string;
  capacity: number | null; class_teacher_id: string | null;
  created_at: string; updated_at: string;
}
export interface Faculty {
  id: string; institution_id: string; name: string; code: string | null;
  dean_id: string | null; created_at: string; updated_at: string;
}
export interface Department {
  id: string; institution_id: string; faculty_id: string | null; name: string;
  code: string | null; hod_id: string | null; created_at: string; updated_at: string;
}
export interface Programme {
  id: string; institution_id: string; department_id: string | null; name: string;
  code: string | null; award: ProgrammeAward | null; duration_years: number | null;
  created_at: string; updated_at: string;
}
export interface Subject {
  id: string; institution_id: string; code: string | null; title: string;
  credit_units: number | null; department_id: string | null; is_elective: boolean;
  created_at: string; updated_at: string;
}
export interface StudentEnrollment {
  id: string; institution_id: string; student_id: string; session_id: string;
  class_arm_id: string | null; programme_id: string | null; level: string | null;
  status: EnrollmentStatus; created_at: string; updated_at: string;
}
export interface TeachingAssignment {
  id: string; institution_id: string; staff_id: string; subject_id: string;
  session_id: string | null; class_arm_id: string | null; programme_id: string | null;
  level: string | null; created_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type StaffAttendanceStatus = 'present' | 'absent' | 'late' | 'on_leave';

export interface AttendanceRecord {
  id: string; institution_id: string; date: string; student_id: string;
  status: AttendanceStatus; class_arm_id: string | null; subject_id: string | null;
  session_id: string | null; term_id: string | null; note: string | null;
  recorded_by: string | null; created_at: string;
}
export interface StaffAttendance {
  id: string; institution_id: string; date: string; staff_id: string;
  status: StaffAttendanceStatus; check_in: string | null; check_out: string | null;
  note: string | null; recorded_by: string | null; created_at: string;
}

export interface AssessmentComponent {
  id: string; institution_id: string; name: string; max_score: number;
  sort_order: number; created_at: string; updated_at: string;
}
export interface StudentScore {
  id: string; institution_id: string; student_id: string; subject_id: string;
  session_id: string; term_id: string; component_id: string;
  class_arm_id: string | null; programme_id: string | null; level: string | null;
  score: number; recorded_by: string | null; updated_at: string;
}

export type ResultStatus = 'draft' | 'submitted' | 'approved' | 'published';
export interface ResultPublication {
  id: string; institution_id: string; session_id: string; term_id: string;
  class_arm_id: string | null; programme_id: string | null; level: string | null;
  status: ResultStatus; submitted_by: string | null; submitted_at: string | null;
  approved_by: string | null; approved_at: string | null; published_at: string | null;
  created_at: string; updated_at: string;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'online' | 'cheque' | 'other';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'cancelled';

export interface FeeStructure {
  id: string; institution_id: string; name: string; amount: number;
  session_id: string; term_id: string | null; class_id: string | null;
  programme_id: string | null; level: string | null; created_at: string; updated_at: string;
}
export interface Invoice {
  id: string; institution_id: string; student_id: string; session_id: string; term_id: string | null;
  reference: string; title: string; total: number; discount: number; amount_paid: number;
  balance: number; status: InvoiceStatus; due_date: string | null; created_by: string | null;
  created_at: string; updated_at: string;
}
export interface InvoiceItem {
  id: string; invoice_id: string; institution_id: string; description: string; amount: number; created_at: string;
}
export interface Payment {
  id: string; institution_id: string; invoice_id: string; student_id: string; amount: number;
  method: PaymentMethod; reference: string; note: string | null; recorded_by: string | null;
  paid_at: string; created_at: string;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type CbtExamStatus = 'draft' | 'published' | 'closed';

export interface QuestionCategory {
  id: string; institution_id: string; name: string; subject_id: string | null;
  created_at: string; updated_at: string;
}
export interface Question {
  id: string; institution_id: string; category_id: string | null; subject_id: string | null;
  type: QuestionType; text: string; marks: number; difficulty: QuestionDifficulty;
  answer_text: string | null; explanation: string | null; created_by: string | null;
  created_at: string; updated_at: string;
}
export interface QuestionOption {
  id: string; question_id: string; institution_id: string; text: string; is_correct: boolean; sort_order: number; created_at: string;
}
export interface CbtExam {
  id: string; institution_id: string; title: string; subject_id: string | null;
  session_id: string | null; term_id: string | null; class_arm_id: string | null;
  programme_id: string | null; level: string | null; duration_minutes: number; pass_mark: number;
  opens_at: string | null; closes_at: string | null; shuffle_questions: boolean; shuffle_options: boolean;
  max_attempts: number; instructions: string | null; status: CbtExamStatus; created_by: string | null;
  created_at: string; updated_at: string;
}
export interface CbtExamQuestion {
  id: string; exam_id: string; question_id: string; institution_id: string; sort_order: number; marks: number | null; created_at: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'graded' | 'expired';
export interface CbtAttempt {
  id: string; institution_id: string; exam_id: string; student_id: string;
  status: AttemptStatus; score: number; total: number; focus_losses: number;
  started_at: string; submitted_at: string | null;
}
export interface CbtAnswer {
  id: string; attempt_id: string; question_id: string; institution_id: string;
  selected_option_ids: string[]; answer_text: string | null; is_correct: boolean | null;
  marks_awarded: number; sort_order: number;
}

export interface LibrarySettings {
  institution_id: string; loan_period_days: number; fine_per_day: number; max_books: number; updated_at: string;
}
export interface LibraryBook {
  id: string; institution_id: string; title: string; author: string | null; isbn: string | null;
  category: string | null; publisher: string | null; year: number | null; description: string | null;
  cover_url: string | null; total_copies: number; available_copies: number; created_at: string; updated_at: string;
}
export interface LibraryLoan {
  id: string; institution_id: string; book_id: string;
  borrower_student_id: string | null; borrower_staff_id: string | null;
  borrowed_at: string; due_date: string; returned_at: string | null;
  fine_amount: number; fine_paid: boolean; note: string | null; issued_by: string | null; created_at: string;
}

export type MessageChannel = 'email' | 'sms' | 'whatsapp';
export type MessageStatus = 'queued' | 'sent' | 'failed' | 'delivered';
export interface Notification {
  id: string; institution_id: string; user_id: string; title: string; body: string | null;
  category: string; link: string | null; read_at: string | null; created_by: string | null; created_at: string;
}
export interface Message {
  id: string; institution_id: string; channel: MessageChannel; recipient: string;
  recipient_user_id: string | null; recipient_student_id: string | null; subject: string | null; body: string;
  status: MessageStatus; provider: string | null; provider_message_id: string | null; error: string | null;
  created_by: string | null; created_at: string; sent_at: string | null;
}
export interface MessageTemplate {
  id: string; institution_id: string; name: string; channel: MessageChannel | null;
  subject: string | null; body: string; created_at: string; updated_at: string;
}

export interface Document {
  id: string; institution_id: string; doc_type: string; title: string; body: string;
  instructions: string | null; created_by: string | null; created_at: string; updated_at: string;
}

export type HostelGender = 'male' | 'female' | 'mixed';
export interface Hostel {
  id: string; institution_id: string; name: string; gender: HostelGender;
  warden_staff_id: string | null; description: string | null; created_at: string; updated_at: string;
}
export interface HostelRoom {
  id: string; institution_id: string; hostel_id: string; room_number: string;
  capacity: number; floor: string | null; created_at: string; updated_at: string;
}
export interface HostelAllocation {
  id: string; institution_id: string; room_id: string; student_id: string;
  session_id: string | null; allocated_at: string; vacated_at: string | null; created_at: string;
}

export type VehicleStatus = 'active' | 'maintenance' | 'inactive';
export interface Vehicle {
  id: string; institution_id: string; name: string; plate_number: string | null; model: string | null;
  capacity: number; driver_name: string | null; driver_phone: string | null; status: VehicleStatus;
  created_at: string; updated_at: string;
}
export interface TransportRoute {
  id: string; institution_id: string; name: string; description: string | null;
  fare: number; vehicle_id: string | null; created_at: string; updated_at: string;
}
export interface RouteStop {
  id: string; institution_id: string; route_id: string; name: string; sequence: number; pickup_time: string | null; created_at: string;
}
export interface TransportAssignment {
  id: string; institution_id: string; route_id: string; student_id: string; stop_id: string | null;
  session_id: string | null; assigned_at: string; ended_at: string | null; created_at: string;
}

export type MovementType = 'receive' | 'issue' | 'adjust';
export interface InventoryCategory {
  id: string; institution_id: string; name: string; created_at: string; updated_at: string;
}
export interface InventoryItem {
  id: string; institution_id: string; category_id: string | null; name: string; sku: string | null;
  unit: string; quantity: number; reorder_level: number; unit_cost: number | null; location: string | null;
  created_at: string; updated_at: string;
}
export interface StockMovement {
  id: string; institution_id: string; item_id: string; type: MovementType; change: number;
  issued_to: string | null; note: string | null; balance_after: number; created_by: string | null; created_at: string;
}

export type ApplicationStatus = 'submitted' | 'under_review' | 'offered' | 'accepted' | 'rejected' | 'enrolled' | 'withdrawn';
export interface AdmissionApplication {
  id: string; institution_id: string; application_number: string; first_name: string; last_name: string;
  email: string | null; phone: string | null; dob: string | null; gender: string | null; address: string | null;
  prior_school: string | null; programme_id: string | null; class_id: string | null; session_id: string | null;
  intended_study: string | null;
  score: number | null; notes: string | null; status: ApplicationStatus; student_id: string | null;
  created_at: string; updated_at: string;
}

export type MaterialKind = 'file' | 'link' | 'video' | 'note';
export interface LessonMaterial {
  id: string; institution_id: string; subject_id: string; title: string; description: string | null;
  kind: MaterialKind; url: string | null; created_by: string | null; created_at: string; updated_at: string;
}
export interface Assignment {
  id: string; institution_id: string; subject_id: string; title: string; instructions: string | null;
  due_date: string | null; max_points: number; published: boolean; created_by: string | null; created_at: string; updated_at: string;
}
export interface AssignmentSubmission {
  id: string; institution_id: string; assignment_id: string; student_id: string; content: string | null; file_url: string | null; file_path: string | null;
  submitted_at: string; grade: number | null; feedback: string | null; graded_by: string | null; graded_at: string | null; created_at: string;
}

export type DiscountType = 'percent' | 'fixed';
export interface Scholarship {
  id: string; institution_id: string; name: string; discount_type: DiscountType; value: number;
  session_id: string | null; active: boolean; created_at: string; updated_at: string;
}
export interface StudentScholarship {
  id: string; institution_id: string; student_id: string; scholarship_id: string;
  session_id: string | null; active: boolean; awarded_by: string | null; created_at: string;
}

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      institutions: { Row: Row<Institution>; Insert: Insert<Institution>; Update: Update<Institution>; Relationships: [] };
      campuses: { Row: Row<Campus>; Insert: Insert<Campus>; Update: Update<Campus>; Relationships: [] };
      profiles: { Row: Row<Profile>; Insert: Insert<Profile>; Update: Update<Profile>; Relationships: [] };
      user_roles: { Row: Row<UserRole>; Insert: Insert<UserRole>; Update: Update<UserRole>; Relationships: [] };
      students: { Row: Row<Student>; Insert: Insert<Student>; Update: Update<Student>; Relationships: [] };
      staff: { Row: Row<Staff>; Insert: Insert<Staff>; Update: Update<Staff>; Relationships: [] };
      guardians: { Row: Row<Guardian>; Insert: Insert<Guardian>; Update: Update<Guardian>; Relationships: [] };
      student_guardians: { Row: Row<StudentGuardian>; Insert: Insert<StudentGuardian>; Update: Update<StudentGuardian>; Relationships: [] };
      academic_sessions: { Row: Row<AcademicSession>; Insert: Insert<AcademicSession>; Update: Update<AcademicSession>; Relationships: [] };
      academic_terms: { Row: Row<AcademicTerm>; Insert: Insert<AcademicTerm>; Update: Update<AcademicTerm>; Relationships: [] };
      classes: { Row: Row<Class>; Insert: Insert<Class>; Update: Update<Class>; Relationships: [] };
      class_arms: { Row: Row<ClassArm>; Insert: Insert<ClassArm>; Update: Update<ClassArm>; Relationships: [] };
      faculties: { Row: Row<Faculty>; Insert: Insert<Faculty>; Update: Update<Faculty>; Relationships: [] };
      departments: { Row: Row<Department>; Insert: Insert<Department>; Update: Update<Department>; Relationships: [] };
      programmes: { Row: Row<Programme>; Insert: Insert<Programme>; Update: Update<Programme>; Relationships: [] };
      subjects: { Row: Row<Subject>; Insert: Insert<Subject>; Update: Update<Subject>; Relationships: [] };
      student_enrollments: { Row: Row<StudentEnrollment>; Insert: Insert<StudentEnrollment>; Update: Update<StudentEnrollment>; Relationships: [] };
      teaching_assignments: { Row: Row<TeachingAssignment>; Insert: Insert<TeachingAssignment>; Update: Update<TeachingAssignment>; Relationships: [] };
      attendance_records: { Row: Row<AttendanceRecord>; Insert: Insert<AttendanceRecord>; Update: Update<AttendanceRecord>; Relationships: [] };
      staff_attendance: { Row: Row<StaffAttendance>; Insert: Insert<StaffAttendance>; Update: Update<StaffAttendance>; Relationships: [] };
      assessment_components: { Row: Row<AssessmentComponent>; Insert: Insert<AssessmentComponent>; Update: Update<AssessmentComponent>; Relationships: [] };
      student_scores: { Row: Row<StudentScore>; Insert: Insert<StudentScore>; Update: Update<StudentScore>; Relationships: [] };
      result_publications: { Row: Row<ResultPublication>; Insert: Insert<ResultPublication>; Update: Update<ResultPublication>; Relationships: [] };
      fee_structures: { Row: Row<FeeStructure>; Insert: Insert<FeeStructure>; Update: Update<FeeStructure>; Relationships: [] };
      invoices: { Row: Row<Invoice>; Insert: Insert<Invoice>; Update: Update<Invoice>; Relationships: [] };
      invoice_items: { Row: Row<InvoiceItem>; Insert: Insert<InvoiceItem>; Update: Update<InvoiceItem>; Relationships: [] };
      payments: { Row: Row<Payment>; Insert: Insert<Payment>; Update: Update<Payment>; Relationships: [] };
      question_categories: { Row: Row<QuestionCategory>; Insert: Insert<QuestionCategory>; Update: Update<QuestionCategory>; Relationships: [] };
      questions: { Row: Row<Question>; Insert: Insert<Question>; Update: Update<Question>; Relationships: [] };
      question_options: { Row: Row<QuestionOption>; Insert: Insert<QuestionOption>; Update: Update<QuestionOption>; Relationships: [] };
      cbt_exams: { Row: Row<CbtExam>; Insert: Insert<CbtExam>; Update: Update<CbtExam>; Relationships: [] };
      cbt_exam_questions: { Row: Row<CbtExamQuestion>; Insert: Insert<CbtExamQuestion>; Update: Update<CbtExamQuestion>; Relationships: [] };
      cbt_attempts: { Row: Row<CbtAttempt>; Insert: Insert<CbtAttempt>; Update: Update<CbtAttempt>; Relationships: [] };
      cbt_answers: { Row: Row<CbtAnswer>; Insert: Insert<CbtAnswer>; Update: Update<CbtAnswer>; Relationships: [] };
      library_settings: { Row: Row<LibrarySettings>; Insert: Insert<LibrarySettings>; Update: Update<LibrarySettings>; Relationships: [] };
      library_books: { Row: Row<LibraryBook>; Insert: Insert<LibraryBook>; Update: Update<LibraryBook>; Relationships: [] };
      library_loans: { Row: Row<LibraryLoan>; Insert: Insert<LibraryLoan>; Update: Update<LibraryLoan>; Relationships: [] };
      notifications: { Row: Row<Notification>; Insert: Insert<Notification>; Update: Update<Notification>; Relationships: [] };
      messages: { Row: Row<Message>; Insert: Insert<Message>; Update: Update<Message>; Relationships: [] };
      message_templates: { Row: Row<MessageTemplate>; Insert: Insert<MessageTemplate>; Update: Update<MessageTemplate>; Relationships: [] };
      documents: { Row: Row<Document>; Insert: Insert<Document>; Update: Update<Document>; Relationships: [] };
      hostels: { Row: Row<Hostel>; Insert: Insert<Hostel>; Update: Update<Hostel>; Relationships: [] };
      hostel_rooms: { Row: Row<HostelRoom>; Insert: Insert<HostelRoom>; Update: Update<HostelRoom>; Relationships: [] };
      hostel_allocations: { Row: Row<HostelAllocation>; Insert: Insert<HostelAllocation>; Update: Update<HostelAllocation>; Relationships: [] };
      vehicles: { Row: Row<Vehicle>; Insert: Insert<Vehicle>; Update: Update<Vehicle>; Relationships: [] };
      transport_routes: { Row: Row<TransportRoute>; Insert: Insert<TransportRoute>; Update: Update<TransportRoute>; Relationships: [] };
      route_stops: { Row: Row<RouteStop>; Insert: Insert<RouteStop>; Update: Update<RouteStop>; Relationships: [] };
      transport_assignments: { Row: Row<TransportAssignment>; Insert: Insert<TransportAssignment>; Update: Update<TransportAssignment>; Relationships: [] };
      inventory_categories: { Row: Row<InventoryCategory>; Insert: Insert<InventoryCategory>; Update: Update<InventoryCategory>; Relationships: [] };
      inventory_items: { Row: Row<InventoryItem>; Insert: Insert<InventoryItem>; Update: Update<InventoryItem>; Relationships: [] };
      stock_movements: { Row: Row<StockMovement>; Insert: Insert<StockMovement>; Update: Update<StockMovement>; Relationships: [] };
      admission_applications: { Row: Row<AdmissionApplication>; Insert: Insert<AdmissionApplication>; Update: Update<AdmissionApplication>; Relationships: [] };
      lesson_materials: { Row: Row<LessonMaterial>; Insert: Insert<LessonMaterial>; Update: Update<LessonMaterial>; Relationships: [] };
      assignments: { Row: Row<Assignment>; Insert: Insert<Assignment>; Update: Update<Assignment>; Relationships: [] };
      assignment_submissions: { Row: Row<AssignmentSubmission>; Insert: Insert<AssignmentSubmission>; Update: Update<AssignmentSubmission>; Relationships: [] };
      scholarships: { Row: Row<Scholarship>; Insert: Insert<Scholarship>; Update: Update<Scholarship>; Relationships: [] };
      student_scholarships: { Row: Row<StudentScholarship>; Insert: Insert<StudentScholarship>; Update: Update<StudentScholarship>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      verify_document: {
        Args: { _token: string };
        Returns: {
          valid: boolean;
          institution_name: string;
          institution_logo: string | null;
          document_type: string;
          title: string | null;
          payload: Json;
          issued_at: string;
          revoked: boolean;
        }[];
      };
      save_attendance: {
        Args: {
          _institution: string; _date: string; _class_arm: string | null;
          _subject: string | null; _session: string | null; _term: string | null; _records: Json;
        };
        Returns: undefined;
      };
      set_result_status: {
        Args: {
          _institution: string; _session: string; _term: string; _arm: string | null;
          _programme: string | null; _level: string | null; _status: ResultStatus;
        };
        Returns: undefined;
      };
      get_report_card_token: { Args: { _student: string; _term: string }; Returns: string };
      student_position: { Args: { _student: string; _term: string }; Returns: number | null };
      generate_invoices: {
        Args: {
          _institution: string; _session: string; _term: string | null; _arm: string | null;
          _programme: string | null; _level: string | null; _title: string; _due: string | null;
        };
        Returns: number;
      };
      get_receipt_token: { Args: { _payment: string }; Returns: string };
      save_question: { Args: { _q: Json; _options: Json }; Returns: string };
      start_attempt: { Args: { _exam_id: string }; Returns: Json };
      save_answer: { Args: { _attempt: string; _question: string; _option_ids: string[]; _text: string | null }; Returns: undefined };
      bump_focus: { Args: { _attempt: string }; Returns: undefined };
      submit_attempt: { Args: { _attempt: string }; Returns: Json };
      get_attempt_review: { Args: { _attempt: string }; Returns: Json };
      admin_dashboard: { Args: Record<string, never>; Returns: Json };
      unread_count: { Args: Record<string, never>; Returns: number };
      mark_read: { Args: { _ids: string[] }; Returns: undefined };
      mark_all_read: { Args: Record<string, never>; Returns: undefined };
      send_announcement: { Args: { _audience: string; _scope_id: string | null; _level: string | null; _title: string; _body: string | null; _category: string; _link: string | null; _channels: string[]; _include_guardians: boolean }; Returns: Json };
      get_student_course_totals: { Args: { _student: string }; Returns: Json };
      submit_application: { Args: { _institution_id: string; _first: string; _last: string; _email: string | null; _phone: string | null; _dob: string | null; _gender: string | null; _address: string | null; _prior_school: string | null; _intended: string | null }; Returns: string };
      admit_application: { Args: { _application_id: string }; Returns: Json };
      finance_report: { Args: Record<string, never>; Returns: Json };
      submit_assignment: { Args: { _assignment: string; _content: string | null; _file_url: string | null; _file_path: string | null }; Returns: undefined };
      my_student_id: { Args: Record<string, never>; Returns: string | null };
      get_public_institution: { Args: { _slug: string }; Returns: { id: string; slug: string; name: string; type: InstitutionType; logo_url: string | null; primary_color: string | null; secondary_color: string | null; motto: string | null }[] };
      demo_load: { Args: { _scenario?: string }; Returns: Json };
      demo_delete: { Args: Record<string, never>; Returns: Json };
      demo_reload: { Args: { _scenario?: string }; Returns: Json };
      demo_status: { Args: Record<string, never>; Returns: Json };
      can_view_audit: { Args: Record<string, never>; Returns: boolean };
      audit_actions: { Args: Record<string, never>; Returns: { action: string }[] };
      audit_list: { Args: { _search?: string; _action?: string; _limit?: number; _offset?: number }; Returns: { id: number; actor_id: string | null; actor_name: string; actor_email: string; action: string; entity: string | null; entity_id: string | null; metadata: Json; created_at: string }[] };
      grade_submission: { Args: { _submission: string; _grade: number; _feedback: string | null }; Returns: undefined };
      compute_student_discount: { Args: { _student: string; _session: string; _gross: number }; Returns: number };
      apply_scholarships_for_student: { Args: { _student: string; _session: string }; Returns: number };
      set_invoice_discount: { Args: { _invoice: string; _amount: number }; Returns: undefined };
    };
    Enums: {
      institution_type: InstitutionType;
      app_role: AppRole;
      record_status: RecordStatus;
      subscription_status: SubscriptionStatus;
      student_status: StudentStatus;
      staff_status: StaffStatus;
      employment_type: EmploymentType;
      programme_award: ProgrammeAward;
      enrollment_status: EnrollmentStatus;
      attendance_status: AttendanceStatus;
      staff_attendance_status: StaffAttendanceStatus;
      result_status: ResultStatus;
      payment_method: PaymentMethod;
      invoice_status: InvoiceStatus;
      question_type: QuestionType;
      question_difficulty: QuestionDifficulty;
      cbt_exam_status: CbtExamStatus;
      attempt_status: AttemptStatus;
      message_channel: MessageChannel;
      message_status: MessageStatus;
      hostel_gender: HostelGender;
      vehicle_status: VehicleStatus;
      movement_type: MovementType;
      application_status: ApplicationStatus;
      material_kind: MaterialKind;
      discount_type: DiscountType;
    };
    CompositeTypes: Record<string, never>;
  };
}
