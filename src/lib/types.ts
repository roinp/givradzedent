export type Doctor = {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
};

export type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  personal_id: string | null;
  phone: string | null;
  date_of_birth: string | null;
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  date: string;
  time: string;
  reason: string | null;
  notes: string | null;
  patients?: Pick<Patient, "id" | "first_name" | "last_name" | "phone"> | null;
  doctors?: Pick<Doctor, "id" | "name"> | null;
};

export type Treatment = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  date: string;
  procedure: string;
  tooth_number: string | null;
  notes: string | null;
  price: number;
  xray_path: string | null;
  paid: number;
  doctors?: Pick<Doctor, "id" | "name"> | null;
};

export type Expense = {
  id: string;
  date: string;
  item: string;
  category: string | null;
  unit_price: number;
  quantity: number;
  supplier: string | null;
  paid: number;
  notes: string | null;
};
