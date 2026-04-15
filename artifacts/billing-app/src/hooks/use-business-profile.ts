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
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: "Your Business Name",
  address: "Business Address, Street",
  city: "City, State - PIN",
  phone: "",
  email: "",
  gstin: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  termsAndConditions: "Goods once sold will not be taken back. E & O.E.",
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
