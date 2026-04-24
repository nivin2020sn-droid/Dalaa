import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";

const SettingsContext = createContext(null);

const DEFAULT_WHATSAPP_TEMPLATE_DE = `Hallo 👋
Ihre Rechnung von {{shop_name}} ist fertig.

Rechnungsnummer: {{invoice_number}}
Betrag: {{total_amount}} €

Wenn Sie eine PDF-Version wünschen, geben Sie bitte kurz Bescheid.

Vielen Dank für Ihren Besuch 🌸`;

const DEFAULTS = {
  shop_name: "Dalaa Beauty",
  tagline: "Salon & Beauty",
  logo_url: "",
  background_url: "",
  address: "",
  phone: "",
  email: "",
  tax_id: "",
  receipt_footer: "Vielen Dank für Ihren Besuch — شكراً لزيارتكم",
  whatsapp_template: DEFAULT_WHATSAPP_TEMPLATE_DE,
  update_url: "",
};

export const DEFAULT_WHATSAPP_TEMPLATE = DEFAULT_WHATSAPP_TEMPLATE_DE;

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

  useEffect(() => { load(); }, [load]);

  // Update document title when shop name changes
  useEffect(() => {
    document.title = `${settings.shop_name} — ${settings.tagline}`;
  }, [settings.shop_name, settings.tagline]);

  // Apply background image globally when set
  useEffect(() => {
    const root = document.documentElement;
    if (settings.background_url) {
      root.style.setProperty("--app-bg-image", `url('${settings.background_url.replace(/'/g, "\\'")}')`);
      root.classList.add("has-custom-bg");
    } else {
      root.style.removeProperty("--app-bg-image");
      root.classList.remove("has-custom-bg");
    }
  }, [settings.background_url]);

  return (
    <SettingsContext.Provider value={{ settings, reload: load, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext) || {
  settings: DEFAULTS, reload: () => {}, setSettings: () => {},
};
