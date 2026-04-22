import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface BusinessProfile {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  gstin: string;
  fssaiNumber: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  termsAndConditions: string;
  printPageSize: "A4" | "A5";
  printOrientation: "portrait" | "landscape";
  fyStartMonth: number;
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  gstin: "",
  fssaiNumber: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  termsAndConditions: "Goods once sold will not be taken back. E & O.E.",
  printPageSize: "A4",
  printOrientation: "portrait",
  fyStartMonth: 4,
};

function settingsToProfile(settings: Record<string, string>): BusinessProfile {
  return {
    name: settings.businessName || DEFAULT_PROFILE.name,
    address: settings.address || DEFAULT_PROFILE.address,
    city: settings.city || DEFAULT_PROFILE.city,
    phone: settings.phone || DEFAULT_PROFILE.phone,
    email: settings.email || DEFAULT_PROFILE.email,
    gstin: settings.gstin || DEFAULT_PROFILE.gstin,
    fssaiNumber: settings.fssaiNumber || DEFAULT_PROFILE.fssaiNumber,
    bankName: settings.bankName || DEFAULT_PROFILE.bankName,
    bankAccount: settings.bankAccount || DEFAULT_PROFILE.bankAccount,
    bankIfsc: settings.bankIfsc || DEFAULT_PROFILE.bankIfsc,
    termsAndConditions: settings.termsAndConditions || DEFAULT_PROFILE.termsAndConditions,
    printPageSize: (settings.printPageSize as "A4" | "A5") || DEFAULT_PROFILE.printPageSize,
    printOrientation: (settings.printOrientation as "portrait" | "landscape") || DEFAULT_PROFILE.printOrientation,
    fyStartMonth: settings.fyStartMonth ? parseInt(settings.fyStartMonth) : DEFAULT_PROFILE.fyStartMonth,
  };
}

function profileToSettings(profile: Partial<BusinessProfile>): Record<string, string> {
  const settings: Record<string, string> = {};
  if (profile.name !== undefined) settings.businessName = profile.name;
  if (profile.address !== undefined) settings.address = profile.address;
  if (profile.city !== undefined) settings.city = profile.city;
  if (profile.phone !== undefined) settings.phone = profile.phone;
  if (profile.email !== undefined) settings.email = profile.email;
  if (profile.gstin !== undefined) settings.gstin = profile.gstin;
  if (profile.fssaiNumber !== undefined) settings.fssaiNumber = profile.fssaiNumber;
  if (profile.bankName !== undefined) settings.bankName = profile.bankName;
  if (profile.bankAccount !== undefined) settings.bankAccount = profile.bankAccount;
  if (profile.bankIfsc !== undefined) settings.bankIfsc = profile.bankIfsc;
  if (profile.termsAndConditions !== undefined) settings.termsAndConditions = profile.termsAndConditions;
  if (profile.printPageSize !== undefined) settings.printPageSize = profile.printPageSize;
  if (profile.printOrientation !== undefined) settings.printOrientation = profile.printOrientation;
  if (profile.fyStartMonth !== undefined) settings.fyStartMonth = String(profile.fyStartMonth);
  return settings;
}

export function useBusinessProfile() {
  const queryClient = useQueryClient();

  const { data: rawSettings } = useQuery<Record<string, string>>({
    queryKey: ["business-settings"],
    queryFn: () => customFetch<Record<string, string>>("/api/business-settings"),
    staleTime: 30_000,
  });

  const profile: BusinessProfile = rawSettings
    ? settingsToProfile(rawSettings)
    : { ...DEFAULT_PROFILE };

  const mutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      customFetch("/api/business-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-settings"] });
    },
  });

  function updateProfile(updates: Partial<BusinessProfile>) {
    const settings = profileToSettings(updates);
    mutation.mutate(settings);
  }

  return { profile, updateProfile };
}
