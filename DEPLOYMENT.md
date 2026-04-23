# 🚀 دليل النشر — تطبيق محاسبة محل التجميل

تطبيق كامل (React + FastAPI + MongoDB) جاهز للنشر كخدمة واحدة على أي منصة تدعم Docker.

---

## ⚡ الطريقة الموصى بها: Railway + MongoDB Atlas

**التكلفة التقريبية:** $5/شهر (Railway) + مجاني (Atlas) = **~$5/شهر**

### 1) تجهيز قاعدة البيانات (MongoDB Atlas)

1. سجّل مجاناً على [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. أنشئ **Cluster جديد** واختر الطبقة المجانية **M0 Free** (512MB)
3. من **Database Access** → أضف مستخدم جديد (احفظ كلمة المرور)
4. من **Network Access** → أضف `0.0.0.0/0` (للسماح بالوصول من Railway)
5. اضغط **Connect** → **Drivers** → انسخ رابط الاتصال (Connection String):
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### 2) رفع الكود على GitHub

- من داخل Emergent، اضغط **"Save to GitHub"** واختر مستودعاً جديداً أو موجوداً.

### 3) النشر على Railway

1. سجّل على [railway.app](https://railway.app) بحساب GitHub
2. **New Project** → **Deploy from GitHub repo** → اختر مستودعك
3. Railway سيكتشف `Dockerfile` تلقائياً ويبدأ البناء
4. بعد البناء، اذهب إلى **Variables** وأضف:

   | المفتاح | القيمة |
   |---------|--------|
   | `MONGO_URL` | رابط Atlas من الخطوة 1 |
   | `DB_NAME` | `salon_db` |
   | `JWT_SECRET` | أي نص عشوائي طويل (مثل: `change-this-to-a-long-random-string-2026`) |
   | `CORS_ORIGINS` | `*` (أو ضع دومينك لاحقاً) |

5. من تبويب **Settings** → **Networking** → اضغط **Generate Domain**
   - ستحصل على رابط مثل: `salon-production.up.railway.app`

6. افتح الرابط → ستجد صفحة الدخول
   - البريد: `admin@salon.com`
   - كلمة المرور: `admin123`
   - **(مهم)** غيّر كلمة المرور فوراً من إعدادات المستخدمين.

### 4) (اختياري) دومين مخصص

- من Railway → **Settings** → **Custom Domain** → أضف دومينك
- حدّث سجل `CNAME` عند مزوّد الدومين (Namecheap / GoDaddy) كما يرشدك Railway
- SSL يُفعَّل تلقائياً عبر Let's Encrypt

---

## 🔁 بدائل منصات النشر

نفس الـ Dockerfile يعمل على:

### Render.com
- **New** → **Web Service** → Connect GitHub → Environment: **Docker**
- أضف نفس متغيرات البيئة أعلاه
- السعر: Free tier متاح لكن ينام بعد 15 دقيقة خمول. $7/شهر للخطة الدائمة.

### Fly.io
```bash
fly launch
fly secrets set MONGO_URL="..." DB_NAME="salon_db" JWT_SECRET="..."
fly deploy
```

### VPS (DigitalOcean, Hetzner, AWS Lightsail)
```bash
# على السيرفر
git clone <your-repo> && cd <repo>
docker build -t salon-app .
docker run -d -p 80:8000 \
  -e MONGO_URL="mongodb+srv://..." \
  -e DB_NAME="salon_db" \
  -e JWT_SECRET="change-me-long-random" \
  --name salon salon-app
```

---

## 🛠️ التشغيل محلياً بـ Docker

```bash
docker build -t salon-app .
docker run -p 8000:8000 \
  -e MONGO_URL="mongodb://host.docker.internal:27017" \
  -e DB_NAME="salon_db" \
  -e JWT_SECRET="local-dev-secret" \
  salon-app
```
ثم افتح `http://localhost:8000`

---

## 📋 متغيرات البيئة المطلوبة

| المتغير | الوصف | مثال |
|---------|-------|-------|
| `MONGO_URL` | رابط الاتصال بقاعدة MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net` |
| `DB_NAME` | اسم قاعدة البيانات | `salon_db` |
| `JWT_SECRET` | مفتاح توقيع الجلسات (سرّي وطويل) | `a-very-long-random-string-...` |
| `CORS_ORIGINS` | الدومينات المسموحة (اختياري) | `*` أو `https://my-salon.com` |
| `PORT` | المنفذ (تضبطه Railway تلقائياً) | `8000` |

---

## 🔐 نصائح الأمان بعد النشر

1. **غيّر كلمة مرور الأدمن فوراً** من `admin123` إلى كلمة قوية
2. اجعل `JWT_SECRET` نصاً عشوائياً طويلاً (30+ حرف)
3. بدّل `CORS_ORIGINS` من `*` إلى دومينك الفعلي بعد ربط الدومين
4. فعّل **IP Whitelist** في MongoDB Atlas وضع فقط عناوين Railway (متقدم)
5. خذ نسخة احتياطية دورية من قاعدة البيانات (Atlas يوفّر Backup تلقائي في الخطط المدفوعة)

---

## ❓ استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| "Application failed to respond" | تأكد من أن `PORT` يُستخدم — Railway يضبطه تلقائياً. لا تعدّل أمر التشغيل يدوياً. |
| "Cannot connect to MongoDB" | تحقق من صحة `MONGO_URL` ومن إضافة `0.0.0.0/0` في Network Access على Atlas |
| الواجهة تفتح لكن الـ API يعطي خطأ | تأكد أن `CORS_ORIGINS=*` مؤقتاً، وراجع Logs في Railway |
| 404 على الصفحات الفرعية بعد refresh | هذا محلول تلقائياً — FastAPI يعيد `index.html` لأي مسار غير `/api` |

---

**🎉 بالتوفيق!** إذا واجهتك أي مشكلة، راجع Logs في Railway Dashboard أو اطلب المساعدة.
