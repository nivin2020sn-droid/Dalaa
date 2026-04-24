# Dalaa Beauty — TSE / KassenSichV Backend

Backend تجريبي (Mock) يوقّع كل فاتورة بتوقيع TSE مزيّف لكنه يحاكي تماماً
صيغة Fiskaly الحقيقية (QR-Code V0). عند جاهزية بيانات Fiskaly الحقيقية،
يكفي استبدال الدالة `_sign_with_mock` — العقد الخارجي (HTTP API) يبقى كما هو.

---

## Endpoints

| Method | Path | الوصف |
|--------|------|-------|
| GET    | `/api/tse/health`            | فحص الاتصال + حالة الخادم |
| POST   | `/api/tse/sign`              | توقيع فاتورة جديدة |
| POST   | `/api/tse/storno`            | توقيع فاتورة Storno (إلغاء GoBD-متوافق) |
| GET    | `/api/tse/export-dsfinvk?from=YYYY-MM-DD&to=YYYY-MM-DD` | تصدير ZIP بصيغة DSFinV-K |
| GET    | `/api/tse/debug/transactions` | (للتطوير فقط) قائمة المعاملات المسجّلة |

---

## تشغيل محلي

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

---

## نشر على Railway

1. ارفع مجلد `backend/` إلى Git repo (أو استخدم نفس الـ monorepo — Railway يسمح باختيار `Root Directory`).
2. على [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo**.
3. اختر الريبو، ثم **Settings → Root Directory = `backend`**.
4. اذهب إلى **Variables** وأضف (كلها اختيارية للـ mock):
   ```
   TSE_MOCK_MODE=true
   CORS_ORIGINS=*
   FISKALY_API_KEY=          # ← لاحقاً
   FISKALY_API_SECRET=       # ← لاحقاً
   FISKALY_TSS_ID=           # ← لاحقاً
   FISKALY_CLIENT_ID=        # ← لاحقاً
   FISKALY_ENVIRONMENT=sandbox
   ```
5. Railway سيستخدم تلقائياً `railway.json` ويبني التطبيق ويفحص `/api/tse/health`.
6. بعد النشر: ستحصل على URL مثل `https://dalaa-tse-backend-production.up.railway.app`.
7. ضع هذا الرابط في تطبيق Dalaa Beauty → **الإعدادات → TSE → Backend URL**.

---

## متى ننتقل من Mock إلى Fiskaly الحقيقي؟

ملف `server.py` فيه دالة واحدة اسمها `_sign_with_mock()`. عند الجاهزية:

1. احصل على credentials من [dashboard.fiskaly.com](https://dashboard.fiskaly.com).
2. ضعها في Railway Variables (**ليس في الكود**).
3. استبدل محتوى الدالة بـ:
   - `POST https://kassensichv.fiskaly.com/api/v2/tss/{tss_id}/tx/{uuid}?tx_revision=1` بإمريمّك OAuth2 (key/secret).
   - ارجع الرد كـ `SignResponse`.
4. غيّر `TSE_MOCK_MODE=false` في Railway.
5. أعد النشر — لا تعديلات مطلوبة على تطبيق الجوال.

---

## الأمان

- **لا أسرار في الكود.** كل المفاتيح الحقيقية تُخزَّن حصرياً في Railway Environment Variables.
- **CORS**: ضعه على `CORS_ORIGINS=https://your-domain-only.com` في الإنتاج بدلاً من `*`.
- **HTTPS**: Railway يوفّره تلقائياً. لا تقبل اتصالات `http://` في الإنتاج.
- **سجلات المعاملات** تُحفظ في مجلد داخل الحاوية. لحفظها لـ 10 سنوات (متطلب GoBD) سيلزم Volume دائم على Railway أو نقلها إلى MongoDB/Postgres لاحقاً.
