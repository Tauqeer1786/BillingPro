import { useState, useCallback } from "react";

export interface BusinessProfile {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  gstin: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  termsAndConditions: string;
  printPageSize: "A4" | "A5";
  fyStartMonth: number;
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: "Sharma Traders",
  address: "12, MG Road, Laxmi Nagar",
  city: "New Delhi, Delhi - 110092",
  phone: "+91 98110 45678",
  email: "sharma.traders@gmail.com",
  gstin: "07AABCS1429B1ZX",
  bankName: "State Bank of India",
  bankAccount: "32145678901234",
  bankIfsc: "SBIN0001234",
  termsAndConditions: "Goods once sold will not be taken back. Payment due within 30 days. E & O.E.",
  printPageSize: "A4",
  fyStartMonth: 4,
};

const STORAGE_KEY = "billing_business_profile";

function loadProfile(): BusinessProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PROFILE };
}

function saveProfile(profile: BusinessProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useBusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfile>(loadProfile);

  const updateProfile = useCallback((updates: Partial<BusinessProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      saveProfile(next);
      return next;
    });
  }, []);

  return { profile, updateProfile };
}
