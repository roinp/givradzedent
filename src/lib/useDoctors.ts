"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Doctor } from "./types";

export function useDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  useEffect(() => {
    supabase
      .from("doctors")
      .select("*")
      .order("name")
      .then(({ data }) => setDoctors(data ?? []));
  }, []);
  return doctors;
}
