import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";

const SettingsContext = createContext(null);

const DEFAULTS = {
  shop_name: "صالون",
  tagline: "نظام محاسبة التجميل",
  logo_url: "",
  address: "",
  phone: "",
  email: "",
  tax_id: "",
  receipt_footer: "شكراً لزيارتكم • نتطلع لرؤيتكم مجدداً",
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/settings");
      setSettings({ ...DEFAULTS, ...r.data });
    } catch {
      setSettings(DEFAULTS);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Update document title when shop name changes
  useEffect(() => {
    document.title = `${settings.shop_name} — ${settings.tagline}`;
  }, [settings.shop_name, settings.tagline]);

  return (
    <SettingsContext.Provider value={{ settings, reload: load, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext) || { settings: DEFAULTS, reload: () => {}, setSettings: () => {} };
